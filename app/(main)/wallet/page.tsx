"use client";

import { useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { CATEGORIES } from "@/lib/categories";
import { CURRENCY_MAP } from "@/lib/currencies";
import { announcedRotation, currentQuarter } from "@/lib/engine";
import type { WalletCard } from "@/types";
import { Checkbox } from "@/components/ui/checkbox";
import { UpgradeModal } from "@/components/UpgradeModal";
import { CardArt } from "@/components/CardArt";
import { useProCheck } from "@/lib/useProCheck";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function subDollarValue(wc: WalletCard, tier: "floor" | "composite" | "ceiling"): number {
  const sub = wc.card.sub_json;
  if (!sub) return 0;
  const currency = CURRENCY_MAP[wc.card.currency];
  if (!currency) return 0;
  const cpp = tier === "floor" ? currency.floor : tier === "ceiling" ? currency.ceiling : currency.composite;
  return (sub.points * cpp) / 10000;
}

function fmt(n: number): string {
  return n.toLocaleString();
}

const QUARTERS = [1, 2, 3, 4] as const;

// ─── Rotation config ──────────────────────────────────────────────────────────

function RotationConfig({ wc }: { wc: WalletCard }) {
  const setRotation = useStore((s) => s.setRotation);
  const opts = wc.card.rot_opts ?? [];
  const year = new Date().getFullYear();
  const nowQ = currentQuarter();
  const label = (id: string) => CATEGORIES.find((c) => c.id === id)?.label ?? id;

  return (
    <div className="mt-2 pt-2 border-t border-subtle">
      <div className="flex items-center gap-2 mb-1.5">
        <div className="text-[13px] text-purple font-medium">Rotating 5% quarters</div>
        <span className="text-[11px] text-tertiary">· {year} issuer calendar</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        {QUARTERS.map((q) => {
          const announced = announcedRotation(wc.card, q, year);
          const current = wc.config.rotQ[q - 1] ?? null;
          return (
            <div key={q}>
              <div className="text-[11px] text-tertiary mb-0.5 text-center">
                Q{q}
                {q === nowQ && <span className="text-purple font-medium"> · now</span>}
              </div>
              {announced ? (
                <div
                  className={`min-h-7 rounded-md border px-1.5 py-1 text-[12px] leading-tight text-center ${
                    q === nowQ ? "border-purple/40 bg-purple/10 text-primary" : "border-subtle text-secondary"
                  }`}
                  title="Announced by the issuer"
                >
                  {announced.map(label).join(" + ")}
                </div>
              ) : (
                <Select
                  value={current ?? "__none__"}
                  onValueChange={(v) => setRotation(wc.id, q, v === "__none__" ? null : v)}
                >
                  <SelectTrigger className="h-7 text-[12px] w-full px-1.5">
                    <SelectValue placeholder="Not announced" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Not announced</SelectItem>
                    {opts.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {label(opt)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Custom-select config ─────────────────────────────────────────────────────

function CustomSelectConfig({ wc }: { wc: WalletCard }) {
  const setCustomCategory = useStore((s) => s.setCustomCategory);
  const opts = wc.card.custom_opts ?? [];
  const max = wc.card.custom_max ?? 1;
  const selected = wc.config.custom;

  return (
    <div className="mt-2 pt-2 border-t border-subtle">
      <div className="text-[13px] text-purple font-medium mb-1.5">
        Pick {max === 1 ? "1 category" : `up to ${max} categories`}
      </div>
      <div className="flex flex-wrap gap-1">
        {opts.map((opt) => {
          const cat = CATEGORIES.find((c) => c.id === opt);
          const isSelected = selected.includes(opt);
          return (
            <button
              key={opt}
              onClick={() => setCustomCategory(wc.id, opt, !isSelected)}
              className={`px-2 py-0.5 rounded-full text-[12px] font-medium border transition-colors duration-150 ${
                isSelected
                  ? "bg-purple/10 text-purple border-purple/30"
                  : "bg-surface text-secondary border-subtle hover:border-medium"
              }`}
            >
              {cat?.label ?? opt}
            </button>
          );
        })}
      </div>
      <div className="text-[11px] text-tertiary mt-1">
        {selected.length}/{max} selected
        {wc.card.caps_json["custom"] != null &&
          ` · $${wc.card.caps_json["custom"].toLocaleString()}/mo cap`}
      </div>
    </div>
  );
}

// ─── Wallet card row ──────────────────────────────────────────────────────────

function WalletCardRow({ wc }: { wc: WalletCard }) {
  const toggleCard = useStore((s) => s.toggleCard);
  const currency = CURRENCY_MAP[wc.card.currency];

  return (
    <div className="bg-white border border-subtle rounded-lg p-3">
      <div className="flex items-center gap-3">
        {/* Mini card face */}
        <CardArt card={wc.card} className="w-16 h-10 rounded shadow-[0_1px_2px_rgba(0,0,0,0.12)]" />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-medium text-primary truncate">
            {wc.card.name}
          </div>
          <div className="text-[12px] text-secondary">
            {wc.card.issuer}
            {" · "}
            {wc.card.fee === 0 ? "No fee" : `$${wc.card.fee}/yr`}
            {currency && ` · ${currency.name}`}
          </div>
        </div>

        {/* Remove */}
        <button
          onClick={() => toggleCard(wc.card.id)}
          className="text-[13px] text-tertiary hover:text-red transition-colors px-1 py-0.5 shrink-0"
        >
          Remove
        </button>
      </div>

      {/* Rotating config */}
      {wc.card.rotating && <RotationConfig wc={wc} />}

      {/* Custom-select config */}
      {wc.card.custom_select && <CustomSelectConfig wc={wc} />}
    </div>
  );
}

// ─── SUB section ──────────────────────────────────────────────────────────────

function SubSection({
  walletCards,
  valuationTier,
}: {
  walletCards: WalletCard[];
  valuationTier: "floor" | "composite" | "ceiling";
}) {
  const subEarned = useStore((s) => s.subEarned);
  const toggleSub = useStore((s) => s.toggleSub);

  const cardsWithSub = walletCards.filter((wc) => wc.card.sub_json !== null);
  if (cardsWithSub.length === 0) return null;

  const totalEarned = cardsWithSub
    .filter((wc) => subEarned.includes(wc.id))
    .reduce((sum, wc) => sum + subDollarValue(wc, valuationTier), 0);

  return (
    <section>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-[20px] font-semibold text-ink">
          Sign-up Bonuses
        </h2>
        {totalEarned > 0 && (
          <span className="text-[13px] text-green font-medium">
            ${fmt(Math.round(totalEarned))} earned
          </span>
        )}
      </div>
      <div className="bg-white border border-subtle rounded-lg overflow-hidden divide-y divide-subtle">
        {cardsWithSub.map((wc) => {
          const isEarned = subEarned.includes(wc.id);
          const value = subDollarValue(wc, valuationTier);
          const sub = wc.card.sub_json!;
          return (
            <label
              key={wc.id}
              className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-surface transition-colors"
            >
              <Checkbox
                checked={isEarned}
                onCheckedChange={() => toggleSub(wc.id)}
              />
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-medium text-primary truncate">
                  {wc.card.name}
                </div>
                <div className="text-[12px] text-secondary">
                  {fmt(sub.points)} {CURRENCY_MAP[wc.card.currency]?.name ?? "pts"}
                  {" · "}
                  Spend ${fmt(sub.spend_requirement)} in {sub.timeframe_months}mo
                </div>
              </div>
              <span className={`text-[13px] font-medium shrink-0 ${isEarned ? "text-green" : "text-secondary"}`}>
                ${Math.round(value).toLocaleString()}
              </span>
            </label>
          );
        })}
      </div>
      <p className="text-[11px] text-tertiary mt-1.5">
        Check off SUBs you&apos;ve earned to track their value.
      </p>
    </section>
  );
}

// ─── Wallet page ──────────────────────────────────────────────────────────────

export default function WalletPage() {
  const people = useStore((s) => s.people);
  const activePersonId = useStore((s) => s.activePersonId);
  const setActivePerson = useStore((s) => s.setActivePerson);
  const addPerson = useStore((s) => s.addPerson);
  const removePerson = useStore((s) => s.removePerson);
  const renamePerson = useStore((s) => s.renamePerson);
  const valuationTier = useStore((s) => s.valuationTier);
  const { isPro } = useProCheck();

  const activePerson = people.find((p) => p.id === activePersonId);
  const walletCards = activePerson?.cards ?? [];

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [addingPerson, setAddingPerson] = useState(false);
  const [newPersonName, setNewPersonName] = useState("");
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  function startRename(id: string, current: string) {
    setRenamingId(id);
    setRenameValue(current);
  }

  function commitRename() {
    if (renamingId && renameValue.trim()) {
      renamePerson(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  }

  return (
    <div className="px-4 sm:px-8 lg:px-10 pt-6 sm:pt-8 pb-14 mx-auto max-w-[1180px] space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-[40px] sm:text-[44px] leading-none text-ink mb-5">Wallet</h1>

        {/* Person chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          {people.map((person) => (
            <div key={person.id} className="flex items-center gap-1">
              {renamingId === person.id ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename();
                    if (e.key === "Escape") setRenamingId(null);
                  }}
                  className="px-2 py-1 text-[13px] bg-field border border-medium rounded-lg w-24 focus:outline-none"
                />
              ) : (
                <button
                  onClick={() => setActivePerson(person.id)}
                  className={`px-3.5 py-2 min-h-10 rounded-full text-[14px] transition-colors duration-150 ${
                    activePersonId === person.id
                      ? "bg-ink text-paper border border-ink"
                      : "bg-white border border-medium text-ink hover:border-strong"
                  }`}
                >
                  {person.name}
                  <span className="text-[11px] ml-1 opacity-60">
                    {person.cards.length}
                  </span>
                </button>
              )}
            </div>
          ))}

          {/* Add person */}
          {addingPerson ? (
            <form
              className="flex items-center gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = newPersonName.trim();
                if (trimmed) {
                  addPerson(trimmed);
                  setNewPersonName("");
                  setAddingPerson(false);
                }
              }}
            >
              <input
                autoFocus
                value={newPersonName}
                onChange={(e) => setNewPersonName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setAddingPerson(false);
                    setNewPersonName("");
                  }
                }}
                placeholder="Name…"
                className="px-2 py-1 text-[13px] bg-field border border-medium rounded-lg w-28 focus:outline-none"
              />
              <button type="submit" className="px-2 py-1 text-[13px] font-medium text-green hover:text-green/70 transition-colors">
                Add
              </button>
              <button type="button" onClick={() => { setAddingPerson(false); setNewPersonName(""); }} className="text-[13px] text-tertiary hover:text-secondary transition-colors">
                ✕
              </button>
            </form>
          ) : (
            <button
              onClick={() => {
                if (!isPro && people.length >= 1) {
                  setUpgradeOpen(true);
                  return;
                }
                setAddingPerson(true);
              }}
              className="px-2 py-1 text-[13px] text-tertiary hover:text-secondary border border-dashed border-subtle rounded-lg transition-colors"
            >
              + Add
            </button>
          )}
        </div>

        {/* Active person actions */}
        {activePerson && (
          <div className="flex items-center gap-3 mt-2">
            <span className="text-[13px] text-tertiary">
              {walletCards.length} card{walletCards.length !== 1 ? "s" : ""}
            </span>
            <button
              onClick={() => startRename(activePerson.id, activePerson.name)}
              className="text-[12px] text-tertiary hover:text-secondary transition-colors"
            >
              Rename
            </button>
            {people.length > 1 && (
              <button
                onClick={() => removePerson(activePerson.id)}
                className="text-[12px] text-tertiary hover:text-red transition-colors"
              >
                Remove person
              </button>
            )}
          </div>
        )}
      </div>

      {/* Cards section */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[20px] font-semibold text-ink">Cards</h2>
          <Link
            href="/browse"
            className="text-[14px] font-medium text-cardinal hover:text-cardinal-dark"
          >
            Add a card
          </Link>
        </div>

        {walletCards.length === 0 ? (
          <div className="bg-white border border-subtle rounded-lg py-10 text-center">
            <p className="text-[14px] text-tertiary mb-2">No cards yet.</p>
            <Link href="/browse" className="text-[14px] text-cardinal font-medium hover:text-cardinal-dark">
              Browse cards to add some
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {walletCards.map((wc) => (
              <WalletCardRow key={wc.id} wc={wc} />
            ))}
          </div>
        )}
      </section>

      {/* SUB tracking */}
      <SubSection walletCards={walletCards} valuationTier={valuationTier} />

      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        reason="person_limit"
      />
    </div>
  );
}
