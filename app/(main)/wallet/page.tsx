"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { CATEGORIES } from "@/lib/categories";
import { CURRENCY_MAP } from "@/lib/currencies";
import { cardGradient } from "@/lib/utils";
import type { WalletCard } from "@/types";
import { Checkbox } from "@/components/ui/checkbox";
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

  return (
    <div className="mt-2 pt-2 border-t border-subtle">
      <div className="text-[10px] uppercase tracking-wider text-purple font-semibold mb-1.5">
        Rotating quarters
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {QUARTERS.map((q) => (
          <div key={q}>
            <div className="text-[10px] text-tertiary mb-0.5 text-center">Q{q}</div>
            <Select
              value={wc.config.rotQ[q - 1] ?? "__none__"}
              onValueChange={(v) =>
                setRotation(wc.id, q, v === "__none__" ? null : v)
              }
            >
              <SelectTrigger className="h-7 text-[11px] w-full px-1.5">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">—</SelectItem>
                {opts.map((opt) => {
                  const cat = CATEGORIES.find((c) => c.id === opt);
                  return (
                    <SelectItem key={opt} value={opt}>
                      {cat?.label ?? opt}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        ))}
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
      <div className="text-[10px] uppercase tracking-wider text-purple font-semibold mb-1.5">
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
              className={`px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors duration-150 ${
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
      <div className="text-[10px] text-tertiary mt-1">
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
        <div
          className="w-12 h-[30px] rounded shrink-0"
          style={{ background: cardGradient(wc.card.color_json) }}
        />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium text-primary truncate">
            {wc.card.name}
          </div>
          <div className="text-[11px] text-secondary">
            {wc.card.issuer}
            {" · "}
            {wc.card.fee === 0 ? "No fee" : `$${wc.card.fee}/yr`}
            {currency && ` · ${currency.name}`}
          </div>
        </div>

        {/* Remove */}
        <button
          onClick={() => toggleCard(wc.card.id)}
          className="text-[12px] text-tertiary hover:text-red transition-colors px-1 py-0.5 shrink-0"
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
        <h2 className="text-[14px] font-semibold text-secondary uppercase tracking-wider">
          Sign-up Bonuses
        </h2>
        {totalEarned > 0 && (
          <span className="text-[12px] text-green font-medium">
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
                <div className="text-[13px] font-medium text-primary truncate">
                  {wc.card.name}
                </div>
                <div className="text-[11px] text-secondary">
                  {fmt(sub.points)} {CURRENCY_MAP[wc.card.currency]?.name ?? "pts"}
                  {" · "}
                  Spend ${fmt(sub.spend_requirement)} in {sub.timeframe_months}mo
                </div>
              </div>
              <span className={`text-[12px] font-medium shrink-0 ${isEarned ? "text-green" : "text-secondary"}`}>
                ${Math.round(value).toLocaleString()}
              </span>
            </label>
          );
        })}
      </div>
      <p className="text-[10px] text-tertiary mt-1.5">
        Check off SUBs you've earned to track their value.
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

  const activePerson = people.find((p) => p.id === activePersonId);
  const walletCards = activePerson?.cards ?? [];

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-[14px] font-semibold text-secondary uppercase tracking-wider mb-3">
          My Wallet
        </h1>

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
                  className="px-2 py-1 text-[12px] bg-field border border-medium rounded-lg w-24 focus:outline-none"
                />
              ) : (
                <button
                  onClick={() => setActivePerson(person.id)}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors duration-150 ${
                    activePersonId === person.id
                      ? "bg-green/10 text-green border border-green/30"
                      : "bg-white border border-subtle text-secondary hover:border-medium"
                  }`}
                >
                  {person.name}
                  <span className="text-[10px] ml-1 opacity-60">
                    {person.cards.length}
                  </span>
                </button>
              )}
            </div>
          ))}

          {/* Add person */}
          <button
            onClick={() => {
              const name = prompt("Enter a name:");
              if (name?.trim()) addPerson(name.trim());
            }}
            className="px-2 py-1 text-[12px] text-tertiary hover:text-secondary border border-dashed border-subtle rounded-lg transition-colors"
          >
            + Add
          </button>
        </div>

        {/* Active person actions */}
        {activePerson && (
          <div className="flex items-center gap-3 mt-2">
            <span className="text-[12px] text-tertiary">
              {walletCards.length} card{walletCards.length !== 1 ? "s" : ""}
            </span>
            <button
              onClick={() => startRename(activePerson.id, activePerson.name)}
              className="text-[11px] text-tertiary hover:text-secondary transition-colors"
            >
              Rename
            </button>
            {people.length > 1 && (
              <button
                onClick={() => removePerson(activePerson.id)}
                className="text-[11px] text-tertiary hover:text-red transition-colors"
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
          <h2 className="text-[14px] font-semibold text-secondary uppercase tracking-wider">
            Cards
          </h2>
          <a
            href="/browse"
            className="text-[12px] text-blue hover:underline"
          >
            Browse cards →
          </a>
        </div>

        {walletCards.length === 0 ? (
          <div className="bg-white border border-subtle rounded-lg py-10 text-center">
            <p className="text-[13px] text-tertiary mb-2">No cards yet.</p>
            <a href="/browse" className="text-[13px] text-green font-medium hover:underline">
              Browse cards to add some →
            </a>
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
    </div>
  );
}
