"use client";

import { Fragment, useState, useMemo, useDeferredValue } from "react";
import { CARDS } from "@/lib/cards";
import { useStore } from "@/lib/store";
import { CATEGORIES } from "@/lib/categories";
import { CURRENCIES } from "@/lib/currencies";
import type { Card } from "@/types";
import { cardKind, earnLines, feeLabel } from "@/lib/cardDisplay";
import { useProCheck } from "@/lib/useProCheck";
import { trackCardAdded } from "@/lib/analytics";
import { CardDetailModal } from "@/components/CardDetailModal";
import { CardArt } from "@/components/CardArt";
import { UpgradeModal } from "@/components/UpgradeModal";
import { RequestCardDialog } from "@/components/RequestCardDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─── Filters ──────────────────────────────────────────────────────────────────

type Chip = "all" | "nofee" | "travel" | "cash" | "cobrand" | "business";

const CHIPS: { id: Chip; label: string }[] = [
  { id: "all", label: "All" },
  { id: "nofee", label: "No annual fee" },
  { id: "travel", label: "Travel points" },
  { id: "cash", label: "Cash back" },
  { id: "cobrand", label: "Hotel & airline" },
  { id: "business", label: "Business" },
];

function matchesChip(card: Card, chip: Chip): boolean {
  switch (chip) {
    case "all": return true;
    case "nofee": return card.fee === 0;
    case "business": return !!card.business;
    default: return cardKind(card) === chip;
  }
}

// ─── Card tile ────────────────────────────────────────────────────────────────

function CardTile({
  card,
  inWallet,
  onDetails,
  onAdd,
}: {
  card: Card;
  inWallet: boolean;
  onDetails: () => void;
  onAdd: () => void;
}) {
  const lines = earnLines(card);

  return (
    <article className="bg-white border border-subtle rounded-xl p-4 flex flex-col gap-3.5">
      <button
        onClick={onDetails}
        className="flex gap-3.5 items-center text-left rounded-lg -m-1 p-1 hover:bg-paper transition-colors"
      >
        <CardArt card={card} className="w-20 h-[50px] rounded-[5px] shadow-[0_1px_2px_rgba(0,0,0,0.12)]" />
        <div className="min-w-0">
          <h2 className="text-[16px] font-semibold leading-snug text-ink">{card.name}</h2>
          <div className="text-[13px] text-secondary mt-0.5">
            {card.issuer} · {feeLabel(card.fee)}
          </div>
        </div>
      </button>

      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-[14px]">
        {lines.map((l, i) => (
          <Fragment key={i}>
            <dt className="font-mono text-ink tabular-nums">{l.rate}</dt>
            <dd className="text-[#44403c]">{l.label}</dd>
          </Fragment>
        ))}
      </dl>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-subtle pt-3">
        <button
          onClick={onDetails}
          className="text-[14px] text-[#44403c] hover:text-ink py-2 min-h-10"
        >
          Details
        </button>
        {inWallet ? (
          <span className="flex items-center gap-1.5 text-[14px] text-green min-h-10">
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 8.5l3 3 7-7" />
            </svg>
            In wallet
          </span>
        ) : (
          <button
            onClick={onAdd}
            className="text-[14px] font-medium text-ink bg-white border border-medium hover:border-ink rounded-lg px-3.5 py-2 min-h-10 transition-colors"
          >
            Add
          </button>
        )}
      </div>
    </article>
  );
}

// ─── Custom card dialog ───────────────────────────────────────────────────────

const EMPTY_EARN = Object.fromEntries(CATEGORIES.map((c) => [c.id, 1]));

function CustomCardForm({
  onSave,
  onCancel,
}: {
  onSave: (partial: Omit<Card, "id" | "status">) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [issuer, setIssuer] = useState("");
  const [currency, setCurrency] = useState("cash");
  const [fee, setFee] = useState("0");
  const [earn, setEarn] = useState<Record<string, number>>({ ...EMPTY_EARN });
  const [error, setError] = useState("");

  function handleSave() {
    if (!name.trim()) { setError("Card name is required."); return; }
    if (!issuer.trim()) { setError("Issuer is required."); return; }
    onSave({
      name: name.trim(),
      issuer: issuer.trim(),
      network: "Visa",
      currency,
      fee: parseInt(fee) || 0,
      earn_json: earn,
      caps_json: {},
      sub_json: null,
      sub_hi_json: null,
      score: 0,
      perks_json: [],
      color_json: ["#1a1a2e", "#2d2d5e"],
      rotating: false,
      rot_cap: null,
      rot_opts: null,
      custom_select: false,
      custom_max: null,
      custom_rate: null,
      custom_opts: null,
      fico_min: null,
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <label className="block text-[11px] font-medium text-secondary mb-1">
            Card name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. My Custom Card"
            className="w-full px-3 py-1.5 bg-field border border-subtle rounded-md text-[13px] text-primary placeholder:text-tertiary focus:outline-none focus:border-medium"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-secondary mb-1">
            Issuer
          </label>
          <input
            value={issuer}
            onChange={(e) => setIssuer(e.target.value)}
            placeholder="e.g. Chase"
            className="w-full px-3 py-1.5 bg-field border border-subtle rounded-md text-[13px] text-primary placeholder:text-tertiary focus:outline-none focus:border-medium"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-secondary mb-1">
            Annual fee ($)
          </label>
          <input
            type="number"
            min="0"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            className="w-full px-3 py-1.5 bg-field border border-subtle rounded-md text-[13px] text-primary focus:outline-none focus:border-medium"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-[11px] font-medium text-secondary mb-1">
            Rewards currency
          </label>
          <Select value={currency} onValueChange={(v) => v && setCurrency(v)}>
            <SelectTrigger className="w-full h-8 text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Earn rates */}
      <div>
        <div className="text-[11px] font-medium text-secondary mb-2">
          Earn rates (multiplier per $1)
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {CATEGORIES.map((cat) => (
            <div key={cat.id} className="flex items-center justify-between gap-2">
              <span className="text-[12px] text-primary truncate">{cat.label}</span>
              <input
                type="number"
                min="1"
                step="0.5"
                value={earn[cat.id] ?? 1}
                onChange={(e) =>
                  setEarn((prev) => ({
                    ...prev,
                    [cat.id]: parseFloat(e.target.value) || 1,
                  }))
                }
                className="w-14 px-2 py-1 bg-field border border-subtle rounded-md text-right text-[12px] text-primary focus:outline-none focus:border-medium"
              />
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-red text-[11px]">{error}</p>}

      <div className="flex justify-end gap-2 pt-1">
        <button
          onClick={onCancel}
          className="px-4 py-1.5 text-[13px] text-secondary border border-subtle rounded-lg hover:bg-hover transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="px-4 py-1.5 text-[13px] font-medium bg-ink hover:bg-ink/85 text-paper rounded-lg transition-colors"
        >
          Save card
        </button>
      </div>
    </div>
  );
}

// ─── Browse page ──────────────────────────────────────────────────────────────

export default function BrowsePage() {
  const customCards = useStore((s) => s.customCards);
  const addCustomCard = useStore((s) => s.addCustomCard);
  const people = useStore((s) => s.people);
  const activePersonId = useStore((s) => s.activePersonId);
  const toggleCardForPerson = useStore((s) => s.toggleCardForPerson);
  const { isPro } = useProCheck();

  const activePerson = useMemo(
    () => people.find((p) => p.id === activePersonId),
    [people, activePersonId]
  );

  const walletCardIds = useMemo(() => {
    return new Set(activePerson?.cards.map((wc) => wc.card.id) ?? []);
  }, [activePerson]);

  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [chip, setChip] = useState<Chip>("all");
  const [issuerFilter, setIssuerFilter] = useState("all");
  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  const [detailCard, setDetailCard] = useState<Card | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);

  const allCards = useMemo(() => [...CARDS, ...customCards], [customCards]);

  const issuers = useMemo(
    () => Array.from(new Set(CARDS.map((c) => c.issuer))).sort(),
    []
  );

  const filtered = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    return allCards.filter((card) => {
      if (card.status !== "active") return false;
      if (q && !card.name.toLowerCase().includes(q) && !card.issuer.toLowerCase().includes(q)) return false;
      if (issuerFilter !== "all" && card.issuer !== issuerFilter) return false;
      return matchesChip(card, chip);
    });
  }, [allCards, deferredSearch, issuerFilter, chip]);

  function addToWallet(card: Card) {
    if (!activePerson) return;
    if (!isPro && activePerson.cards.length >= 5) {
      setUpgradeOpen(true);
      return;
    }
    toggleCardForPerson(card.id, activePerson.id);
    trackCardAdded(card.id, card.name, activePerson.id);
  }

  const owner = !activePerson || people.length <= 1 ? "your" : `${activePerson.name}\u2019s`;
  const filtering = deferredSearch.trim() !== "" || chip !== "all" || issuerFilter !== "all";

  return (
    <div className="px-4 sm:px-8 lg:px-10 pt-6 sm:pt-8 pb-14">
      <div className="max-w-[1100px] mx-auto flex flex-col gap-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-[40px] sm:text-[44px] leading-none text-ink">Browse cards</h1>
            <p className="mt-2 text-[15px] text-secondary">
              {filtered.length} card{filtered.length !== 1 ? "s" : ""}
              {filtering ? " match" : ""}. Adding one puts it in {owner} wallet.{" "}
              <button
                onClick={() => setRequestOpen(true)}
                className="text-cardinal hover:text-cardinal-dark font-medium"
              >
                Missing a card?
              </button>
            </p>
          </div>
          <div className="flex items-center gap-2 flex-[0_1_420px] min-w-0 w-full sm:w-auto">
            <label className="flex items-center gap-2 bg-white border border-medium rounded-[10px] px-3 min-h-11 flex-1 min-w-0 focus-within:border-ink">
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="#57534e" strokeWidth="1.6" strokeLinecap="round">
                <circle cx="7" cy="7" r="4.5" />
                <path d="M10.5 10.5L14 14" />
              </svg>
              <span className="sr-only">Search cards</span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by card or issuer"
                className="border-0 outline-none bg-transparent text-[15px] w-full text-ink placeholder:text-tertiary"
              />
            </label>
            <Dialog open={customDialogOpen} onOpenChange={setCustomDialogOpen}>
              <DialogTrigger className="shrink-0 min-h-11 px-3.5 text-[14px] text-ink bg-white border border-medium rounded-[10px] hover:border-ink transition-colors">
                Custom card
              </DialogTrigger>
              <DialogContent showCloseButton={false} className="sm:max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add custom card</DialogTitle>
                </DialogHeader>
                <CustomCardForm
                  onSave={(partial) => {
                    addCustomCard(partial);
                    setCustomDialogOpen(false);
                  }}
                  onCancel={() => setCustomDialogOpen(false)}
                />
              </DialogContent>
            </Dialog>
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-2">
          {CHIPS.map((c) => {
            const on = chip === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setChip(c.id)}
                aria-pressed={on}
                className={`text-[14px] px-3.5 py-2 min-h-10 rounded-full border transition-colors ${
                  on ? "bg-ink text-paper border-ink" : "bg-white text-ink border-medium hover:border-strong"
                }`}
              >
                {c.label}
              </button>
            );
          })}
          <label className="sm:ml-auto flex items-center gap-2 text-[14px] text-secondary">
            Issuer
            <select
              value={issuerFilter}
              onChange={(e) => setIssuerFilter(e.target.value)}
              className="text-[14px] text-ink px-2.5 py-2 min-h-10 border border-medium rounded-lg bg-white"
            >
              <option value="all">All issuers</option>
              {issuers.map((issuer) => (
                <option key={issuer} value={issuer}>{issuer}</option>
              ))}
            </select>
          </label>
        </div>

        {filtered.length === 0 ? (
          <div className="py-14 flex flex-col items-center gap-4 text-center">
            <p className="text-secondary text-[15px]">
              No cards match{search.trim() ? <> &ldquo;{search.trim()}&rdquo;</> : null}.{" "}
              <button
                onClick={() => { setSearch(""); setChip("all"); setIssuerFilter("all"); }}
                className="text-cardinal hover:text-cardinal-dark font-medium"
              >
                Clear filters
              </button>
            </p>
            <div className="bg-white border border-subtle rounded-xl px-5 py-4 max-w-md">
              <p className="text-[15px] text-ink font-medium">Not in our catalog yet?</p>
              <p className="text-[14px] text-secondary mt-1">
                Send us the details and we&apos;ll add it for everyone.
              </p>
              <button
                onClick={() => setRequestOpen(true)}
                className="mt-3 px-4 py-2 min-h-10 text-[14px] font-medium bg-cardinal hover:bg-cardinal-dark text-white rounded-lg transition-colors"
              >
                Request this card
              </button>
            </div>
          </div>
        ) : (
          <section aria-label="Cards" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((card) => (
              <CardTile
                key={card.id}
                card={card}
                inWallet={walletCardIds.has(card.id)}
                onDetails={() => setDetailCard(card)}
                onAdd={() => addToWallet(card)}
              />
            ))}
          </section>
        )}

        {filtered.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-t border-subtle pt-6 text-[15px] text-secondary">
            Can&apos;t find your card?
            <button
              onClick={() => setRequestOpen(true)}
              className="text-cardinal hover:text-cardinal-dark font-medium min-h-10"
            >
              Request it
            </button>
          </div>
        )}
      </div>

      <RequestCardDialog
        open={requestOpen}
        onOpenChange={setRequestOpen}
        initialName={filtered.length === 0 ? search.trim() : ""}
        onUseCustomCard={() => { setRequestOpen(false); setCustomDialogOpen(true); }}
      />

      <CardDetailModal
        card={detailCard}
        open={detailCard !== null}
        onOpenChange={(open) => { if (!open) setDetailCard(null); }}
      />
      <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} reason="card_limit" />
    </div>
  );
}
