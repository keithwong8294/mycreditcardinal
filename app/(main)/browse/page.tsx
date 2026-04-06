"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
import { CARDS } from "@/lib/cards";
import { CATEGORIES } from "@/lib/categories";
import { CURRENCIES } from "@/lib/currencies";
import type { Card } from "@/types";
import { cardGradient, isLightBackground } from "@/lib/utils";
import { CardDetailModal } from "@/components/CardDetailModal";
import { UpgradeModal } from "@/components/UpgradeModal";
import { useProCheck } from "@/lib/useProCheck";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface EarnPill {
  label: string;
  highlight: boolean;
}

function getEarnPills(card: Card): EarnPill[] {
  const pills: EarnPill[] = [];

  if (card.rotating) {
    pills.push({ label: "5x Rotating +", highlight: true });
  }
  if (card.custom_select && card.custom_rate != null) {
    pills.push({ label: `${card.custom_rate}x Custom`, highlight: true });
  }

  const entries = Object.entries(card.earn_json)
    .filter(([, rate]) => rate > 1)
    .sort(([, a], [, b]) => b - a)
    .slice(0, card.rotating || card.custom_select ? 2 : 4);

  for (const [catId, rate] of entries) {
    const cat = CATEGORIES.find((c) => c.id === catId);
    if (!cat) continue;
    pills.push({ label: `${rate}x ${cat.label}`, highlight: rate >= 3 });
  }

  const baseRate = card.earn_json["other"] ?? 1;
  if (baseRate > 1) {
    pills.push({ label: `${baseRate}x Everything`, highlight: baseRate >= 2 });
  }

  return pills.slice(0, 5);
}

const FEE_OPTIONS = [
  { label: "Any fee", value: "any" },
  { label: "No fee", value: "0" },
  { label: "Under $100", value: "100" },
  { label: "Under $250", value: "250" },
  { label: "Under $500", value: "500" },
];

// ─── Card tile ────────────────────────────────────────────────────────────────

function CardTile({
  card,
  inWallet,
  onToggle,
  onDetails,
}: {
  card: Card;
  inWallet: boolean;
  onToggle: () => void;
  onDetails: () => void;
}) {
  const pills = getEarnPills(card);

  return (
    <div
      className={`bg-white rounded-lg overflow-hidden border transition-all duration-150 ${
        inWallet
          ? "ring-1 ring-green border-green"
          : "border-subtle hover:border-medium"
      }`}
    >
      {/* Card face — click toggles wallet */}
      <button
        onClick={onToggle}
        className="w-full text-left relative h-20 flex flex-col justify-end p-2"
        style={{ background: cardGradient(card.color_json) }}
      >
        {inWallet && (
          <span className="absolute top-1.5 right-1.5 bg-green text-white rounded-full text-[10px] font-semibold px-1.5 py-px leading-tight">
            ✓
          </span>
        )}
        {(() => {
          const light = isLightBackground(card.color_json);
          const shadow = "0 1px 2px rgba(0,0,0,0.3)";
          return (
            <>
              <div
                className="text-[9px] uppercase tracking-wide font-medium"
                style={{ color: light ? "#1a1a2eaa" : "rgba(255,255,255,0.6)", textShadow: shadow }}
              >
                {card.issuer}
              </div>
              <div
                className="text-[13px] font-medium leading-tight truncate"
                style={{ color: light ? "#1a1a2e" : "rgba(255,255,255,0.95)", textShadow: shadow }}
              >
                {card.name}
              </div>
            </>
          );
        })()}
      </button>

      {/* Body */}
      <div className="p-2.5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] text-secondary">
            {card.fee === 0 ? (
              <span className="text-green font-medium">No annual fee</span>
            ) : (
              `$${card.fee}/yr`
            )}
          </span>
          {/* Details button */}
          <button
            onClick={onDetails}
            className="text-[11px] text-tertiary hover:text-secondary transition-colors px-1"
            aria-label="Card details"
          >
            Details
          </button>
        </div>
        <div className="flex flex-wrap gap-1">
          {pills.map((pill, i) => (
            <span
              key={i}
              className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium border ${
                pill.highlight
                  ? "bg-green/10 text-green border-transparent"
                  : "bg-[#f1f5f9] text-[#475569] border-[rgba(0,0,0,0.08)]"
              }`}
            >
              {pill.label}
            </span>
          ))}
        </div>
      </div>
    </div>
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
          className="px-4 py-1.5 text-[13px] font-medium bg-green hover:bg-green/90 text-white rounded-lg transition-colors"
        >
          Save card
        </button>
      </div>
    </div>
  );
}

// ─── Browse page ──────────────────────────────────────────────────────────────

export default function BrowsePage() {
  const toggleCard = useStore((s) => s.toggleCard);
  const customCards = useStore((s) => s.customCards);
  const addCustomCard = useStore((s) => s.addCustomCard);
  const people = useStore((s) => s.people);
  const activePersonId = useStore((s) => s.activePersonId);
  const { isPro } = useProCheck();

  const activePerson = useMemo(
    () => people.find((p) => p.id === activePersonId),
    [people, activePersonId]
  );

  const walletCardIds = useMemo(() => {
    return new Set(activePerson?.cards.map((wc) => wc.card.id) ?? []);
  }, [activePerson]);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [issuerFilter, setIssuerFilter] = useState("all");
  const [feeFilter, setFeeFilter] = useState("any");
  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  const [detailCard, setDetailCard] = useState<Card | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  // Debounce search 200ms
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  const allCards = useMemo(() => [...CARDS, ...customCards], [customCards]);

  const issuers = useMemo(
    () => Array.from(new Set(CARDS.map((c) => c.issuer))).sort(),
    []
  );

  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    return allCards.filter((card) => {
      if (card.status !== "active") return false;
      if (
        q &&
        !card.name.toLowerCase().includes(q) &&
        !card.issuer.toLowerCase().includes(q)
      )
        return false;
      if (issuerFilter !== "all" && card.issuer !== issuerFilter) return false;
      if (feeFilter !== "any") {
        const max = parseInt(feeFilter);
        if (max === 0 && card.fee !== 0) return false;
        if (max > 0 && card.fee >= max) return false;
      }
      return true;
    });
  }, [allCards, debouncedSearch, issuerFilter, feeFilter]);

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[14px] font-semibold text-secondary uppercase tracking-wider">
            Browse Cards
          </h1>
          <p className="text-[12px] text-tertiary mt-0.5">
            {filtered.length} card{filtered.length !== 1 ? "s" : ""}
            {debouncedSearch || issuerFilter !== "all" || feeFilter !== "any"
              ? " matching filters"
              : " in database"}
          </p>
        </div>

        {/* Custom card dialog */}
        <Dialog open={customDialogOpen} onOpenChange={setCustomDialogOpen}>
          <DialogTrigger className="px-3 py-1.5 text-[12px] font-medium text-secondary border border-subtle rounded-lg hover:bg-hover transition-colors">
            + Custom card
          </DialogTrigger>
          <DialogContent
            showCloseButton={false}
            className="sm:max-w-md max-h-[90vh] overflow-y-auto"
          >
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

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          placeholder="Search cards…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-52 px-3 py-1.5 bg-white border border-subtle rounded-lg text-[13px] text-primary placeholder:text-tertiary focus:outline-none focus:border-medium transition-colors"
        />

        <Select value={issuerFilter} onValueChange={(v) => v && setIssuerFilter(v)}>
          <SelectTrigger className="h-8 text-[13px] min-w-[120px]">
            <SelectValue placeholder="Issuer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All issuers</SelectItem>
            {issuers.map((issuer) => (
              <SelectItem key={issuer} value={issuer}>
                {issuer}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={feeFilter} onValueChange={(v) => v && setFeeFilter(v)}>
          <SelectTrigger className="h-8 text-[13px] min-w-[120px]">
            <SelectValue placeholder="Fee" />
          </SelectTrigger>
          <SelectContent>
            {FEE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center text-tertiary text-[13px]">
          No cards match your filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {filtered.map((card) => (
            <CardTile
              key={card.id}
              card={card}
              inWallet={walletCardIds.has(card.id)}
              onToggle={() => {
                const alreadyIn = walletCardIds.has(card.id);
                if (!alreadyIn && !isPro && (activePerson?.cards.length ?? 0) >= 5) {
                  setUpgradeOpen(true);
                  return;
                }
                toggleCard(card.id);
              }}
              onDetails={() => setDetailCard(card)}
            />
          ))}
        </div>
      )}

      {/* Card detail modal */}
      <CardDetailModal
        card={detailCard}
        open={detailCard !== null}
        onOpenChange={(open) => { if (!open) setDetailCard(null); }}
      />

      {/* Upgrade modal */}
      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        reason="card_limit"
      />
    </div>
  );
}
