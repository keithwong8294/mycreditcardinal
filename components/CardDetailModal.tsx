"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { CATEGORIES } from "@/lib/categories";
import { CURRENCY_MAP } from "@/lib/currencies";
import type { Card } from "@/types";
import { cardGradient, isLightBackground } from "@/lib/utils";
import { useProCheck } from "@/lib/useProCheck";
import { UpgradeModal } from "@/components/UpgradeModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString();
}

function ficoLabel(min: number | null): string {
  if (min == null) return "—";
  if (min >= 750) return `Excellent (${min}+)`;
  if (min >= 700) return `Good (${min}+)`;
  if (min >= 660) return `Fair (${min}+)`;
  return `Building (${min}+)`;
}

function cppLabel(cpp: number): string {
  return `${(cpp / 100).toFixed(2)}¢`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CardDetailModal({
  card,
  open,
  onOpenChange,
}: {
  card: Card | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const people = useStore((s) => s.people);
  const toggleCardForPerson = useStore((s) => s.toggleCardForPerson);
  const { isPro } = useProCheck();
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  if (!card) return null;

  const currency = CURRENCY_MAP[card.currency];
  const annualCredits = card.perks_json.reduce(
    (sum, p) => sum + (p.annual_credit ?? 0),
    0
  );
  const netFee = card.fee - annualCredits;
  const cardId = card.id;

  function handleToggle(personId: string) {
    const person = people.find((p) => p.id === personId);
    if (!person) return;
    const alreadyIn = person.cards.some((wc) => wc.card.id === cardId);
    if (!alreadyIn && !isPro && person.cards.length >= 5) {
      setUpgradeOpen(true);
      return;
    }
    toggleCardForPerson(cardId, personId);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto p-0">
          {/* Card face */}
          <div
            className="h-28 flex flex-col justify-end p-4 relative"
            style={{ background: cardGradient(card.color_json) }}
          >
            {(() => {
              const light = isLightBackground(card.color_json);
              const shadow = "0 1px 2px rgba(0,0,0,0.3)";
              return (
                <>
                  <div
                    className="text-[10px] uppercase tracking-widest font-medium"
                    style={{ color: light ? "#1a1a2eaa" : "rgba(255,255,255,0.6)", textShadow: shadow }}
                  >
                    {card.issuer}
                  </div>
                  <div
                    className="text-[20px] font-semibold leading-tight"
                    style={{ color: light ? "#1a1a2e" : "white", textShadow: shadow }}
                  >
                    {card.name}
                  </div>
                </>
              );
            })()}
          </div>

          <div className="p-4 space-y-5">
            <DialogHeader>
              <DialogTitle className="sr-only">{card.name}</DialogTitle>
            </DialogHeader>

            {/* Meta row */}
            <div className="grid grid-cols-3 gap-2">
              <MetaCell label="Network" value={card.network} />
              <MetaCell label="Credit score" value={ficoLabel(card.fico_min)} />
              <div className="bg-surface rounded-lg p-2.5">
                <div className="text-[10px] uppercase tracking-wider text-tertiary font-semibold mb-0.5">
                  Annual fee
                </div>
                <div className="text-[13px] font-medium text-primary">
                  {card.fee === 0 ? (
                    <span className="text-green">No fee</span>
                  ) : (
                    `$${card.fee}`
                  )}
                </div>
                {annualCredits > 0 && (
                  <div className="text-[11px] text-secondary mt-0.5">
                    Net: {netFee <= 0 ? <span className="text-green">+${Math.abs(netFee)}</span> : `$${netFee}`}
                    {" "}after credits
                  </div>
                )}
              </div>
            </div>

            {/* Currency */}
            {currency && (
              <Section label="Rewards currency">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-primary">{currency.name}</span>
                  <span className="text-[12px] text-secondary">
                    {cppLabel(currency.floor)} – {cppLabel(currency.composite)} – {cppLabel(currency.ceiling)}
                  </span>
                </div>
                <div className="text-[11px] text-tertiary mt-0.5">
                  Floor · MCC Composite · Ceiling
                </div>
              </Section>
            )}

            {/* Sign-up bonus */}
            {card.sub_json && (
              <Section label="Sign-up bonus">
                <div className="text-[13px] font-medium text-primary">
                  {fmt(card.sub_json.points)}{" "}
                  <span className="font-normal text-secondary">
                    {currency ? currency.name : "pts"}
                  </span>
                </div>
                <div className="text-[12px] text-secondary mt-0.5">
                  Spend ${fmt(card.sub_json.spend_requirement)} in{" "}
                  {card.sub_json.timeframe_months} months
                </div>
                {card.sub_hi_json && card.sub_hi_json.points > card.sub_json.points && (
                  <div className="text-[11px] text-amber mt-1">
                    All-time high: {fmt(card.sub_hi_json.points)} pts
                    {card.sub_hi_json.year ? ` (${card.sub_hi_json.year})` : ""}
                  </div>
                )}
              </Section>
            )}

            {/* Earn rates */}
            <Section label="Earn rates">
              {card.rotating && (
                <div className="mb-2 px-2.5 py-1.5 bg-purple/10 rounded-lg text-[11px] text-purple font-medium">
                  5x rotating quarterly bonus (on top of base rate) · ${card.rot_cap?.toLocaleString()}/quarter cap
                </div>
              )}
              {card.custom_select && card.custom_rate != null && (
                <div className="mb-2 px-2.5 py-1.5 bg-purple/10 rounded-lg text-[11px] text-purple font-medium">
                  {card.custom_rate}x on up to {card.custom_max} chosen{" "}
                  {card.custom_max === 1 ? "category" : "categories"}
                  {"custom" in card.caps_json
                    ? ` · $${card.caps_json["custom"]?.toLocaleString()}/mo cap`
                    : ""}
                </div>
              )}
              <div className="border border-subtle rounded-lg overflow-hidden">
                <div className="grid grid-cols-[1fr_auto] text-[10px] uppercase tracking-wider text-tertiary font-semibold bg-surface border-b border-subtle px-3 py-1.5">
                  <span>Category</span>
                  <span>Rate</span>
                </div>
                {CATEGORIES.map((cat, i) => {
                  const rate = card.earn_json[cat.id] ?? 1;
                  const isLast = i === CATEGORIES.length - 1;
                  return (
                    <div
                      key={cat.id}
                      className={`grid grid-cols-[1fr_auto] px-3 py-2 text-[13px] ${
                        !isLast ? "border-b border-subtle" : ""
                      }`}
                    >
                      <span className="text-primary">{cat.label}</span>
                      <span
                        className={`font-medium tabular-nums ${
                          rate >= 3
                            ? "text-green"
                            : rate >= 2
                            ? "text-primary"
                            : "text-tertiary"
                        }`}
                      >
                        {rate}x
                      </span>
                    </div>
                  );
                })}
              </div>
            </Section>

            {/* Perks */}
            {card.perks_json.length > 0 && (
              <Section label="Perks & benefits">
                <div className="space-y-1.5">
                  {card.perks_json.map((perk, i) => (
                    <div key={i} className="flex items-start justify-between gap-3">
                      <span className="text-[13px] text-primary">{perk.label}</span>
                      <span className="text-[12px] text-secondary text-right shrink-0">
                        {perk.value}
                      </span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Per-person wallet actions */}
            <Section label="Add to wallet">
              {people.length === 0 ? (
                <p className="text-[12px] text-tertiary">No household members yet.</p>
              ) : (
                <div className="space-y-2">
                  {people.map((person) => {
                    const inWallet = person.cards.some((wc) => wc.card.id === card.id);
                    return (
                      <div key={person.id} className="flex items-center justify-between">
                        <span className="text-[13px] text-primary font-medium">{person.name}</span>
                        <button
                          onClick={() => handleToggle(person.id)}
                          className={`text-[12px] font-medium px-3 py-1.5 rounded-md transition-colors duration-150 ${
                            inWallet
                              ? "bg-red/10 text-red hover:bg-red/20 border border-red/20"
                              : "bg-green hover:bg-green/90 text-white"
                          }`}
                        >
                          {inWallet ? `Remove from ${person.name}'s wallet` : `Add to ${person.name}'s wallet`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>
          </div>
        </DialogContent>
      </Dialog>

      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        reason="card_limit"
      />
    </>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface rounded-lg p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-tertiary font-semibold mb-0.5">
        {label}
      </div>
      <div className="text-[13px] font-medium text-primary">{value}</div>
    </div>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-secondary uppercase tracking-wider mb-2">
        {label}
      </div>
      {children}
    </div>
  );
}
