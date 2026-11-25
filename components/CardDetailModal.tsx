"use client";

import { useMemo, useState } from "react";
import { planningContextOf, useStore } from "@/lib/store";
import { whatIfAdd } from "@/lib/sandbox";
import { candidateConfig } from "@/lib/engine";
import { CATEGORIES } from "@/lib/categories";
import { CURRENCY_MAP } from "@/lib/currencies";
import type { Card } from "@/types";
import { cardGradient, isLightBackground } from "@/lib/utils";
import { announcedRotation, currentQuarter } from "@/lib/engine";

const PERIOD_WORD = { month: "mo", quarter: "quarter", year: "yr" } as const;
import { useProCheck } from "@/lib/useProCheck";
import { UpgradeModal } from "@/components/UpgradeModal";
import { CardArt } from "@/components/CardArt";
import { cardImageSrc } from "@/lib/cardImages";
import { trackCardAdded, trackCardRemoved } from "@/lib/analytics";
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
  const cardName = card.name;

  function handleToggle(personId: string) {
    const person = people.find((p) => p.id === personId);
    if (!person) return;
    const alreadyIn = person.cards.some((wc) => wc.card.id === cardId);
    if (!alreadyIn && !isPro && person.cards.length >= 5) {
      setUpgradeOpen(true);
      return;
    }
    toggleCardForPerson(cardId, personId);
    if (alreadyIn) {
      trackCardRemoved(cardId, cardName, personId);
    } else {
      trackCardAdded(cardId, cardName, personId);
    }
  }

  const hasImage = cardImageSrc(card.id) !== null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto p-0">
          {/* Card face */}
          <div
            className={`h-28 flex flex-col justify-end p-4 relative ${hasImage ? "pr-36" : ""}`}
            style={{ background: cardGradient(card.color_json) }}
          >
            {hasImage && (
              <CardArt
                card={card}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-28 h-[70px] rounded-md shadow-[0_4px_12px_rgba(0,0,0,0.35)]"
              />
            )}
            {(() => {
              const light = isLightBackground(card.color_json);
              const shadow = "0 1px 2px rgba(0,0,0,0.3)";
              return (
                <>
                  <div
                    className="text-[11px] uppercase tracking-widest font-medium"
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <MetaCell label="Network" value={card.network} />
              <MetaCell label="Credit score" value={ficoLabel(card.fico_min)} />
              <MetaCell
                label="Foreign fee"
                value={card.ftf == null ? "—" : card.ftf === 0 ? "None" : `${card.ftf}%`}
              />
              <div className="bg-surface rounded-lg p-2.5">
                <div className="text-[13px] text-tertiary font-medium mb-0.5">
                  Annual fee
                </div>
                <div className="text-[14px] font-medium text-primary">
                  {card.fee === 0 ? (
                    <span className="text-green">No fee</span>
                  ) : (
                    `$${card.fee}`
                  )}
                </div>
                {annualCredits > 0 && (
                  <div className="text-[12px] text-secondary mt-0.5">
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
                  <span className="text-[14px] text-primary">{currency.name}</span>
                  <span className="text-[13px] text-secondary">
                    {cppLabel(currency.floor)} – {cppLabel(currency.composite)} – {cppLabel(currency.ceiling)}
                  </span>
                </div>
                <div className="text-[12px] text-tertiary mt-0.5">
                  Floor · MCC Composite · Ceiling
                </div>
              </Section>
            )}

            {/* Sign-up bonus */}
            {card.sub_json && (
              <Section label="Sign-up bonus">
                <div className="text-[14px] font-medium text-primary">
                  {fmt(card.sub_json.points)}{" "}
                  <span className="font-normal text-secondary">
                    {currency ? currency.name : "pts"}
                  </span>
                </div>
                <div className="text-[13px] text-secondary mt-0.5">
                  Spend ${fmt(card.sub_json.spend_requirement)} in{" "}
                  {card.sub_json.timeframe_months} months
                </div>
                {card.sub_hi_json && card.sub_hi_json.points > card.sub_json.points && (
                  <div className="text-[12px] text-amber mt-1">
                    All-time high: {fmt(card.sub_hi_json.points)} pts
                    {card.sub_hi_json.year ? ` (${card.sub_hi_json.year})` : ""}
                  </div>
                )}
              </Section>
            )}

            {/* Earn rates */}
            <Section label="Earn rates">
              {card.rotating && (
                <div className="mb-2 px-2.5 py-1.5 bg-purple/10 rounded-lg text-[12px] text-purple font-medium">
                  +4% on rotating quarterly categories (5% total, more where the card already earns extra) · first ${card.rot_cap?.toLocaleString()} a quarter
                  {(() => {
                    const q = currentQuarter();
                    const cats = announcedRotation(card, q);
                    if (!cats) return null;
                    const names = cats.map((id) => CATEGORIES.find((c) => c.id === id)?.label ?? id);
                    return (
                      <div className="mt-0.5 font-normal text-primary">
                        Q{q} {new Date().getFullYear()}: {names.join(", ")}
                      </div>
                    );
                  })()}
                </div>
              )}
              {card.custom_select && card.custom_rate != null && (
                <div className="mb-2 px-2.5 py-1.5 bg-purple/10 rounded-lg text-[12px] text-purple font-medium">
                  {card.custom_rate}x on up to {card.custom_max} chosen{" "}
                  {card.custom_max === 1 ? "category" : "categories"}
                  {"custom" in card.caps_json
                    ? ` · $${card.caps_json["custom"]?.toLocaleString()}/${PERIOD_WORD[card.cap_period ?? "month"]} cap`
                    : ""}
                </div>
              )}
              <div className="border border-subtle rounded-lg overflow-hidden">
                <div className="grid grid-cols-[1fr_auto] text-[13px] text-tertiary font-medium bg-surface border-b border-subtle px-3 py-1.5">
                  <span>Category</span>
                  <span>Rate</span>
                </div>
                {CATEGORIES.map((cat, i) => {
                  const rate = card.earn_json[cat.id] ?? 1;
                  const isLast = i === CATEGORIES.length - 1;
                  return (
                    <div
                      key={cat.id}
                      className={`grid grid-cols-[1fr_auto] px-3 py-2 text-[14px] ${
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
                      <span className="text-[14px] text-primary">{perk.label}</span>
                      <span className="text-[13px] text-secondary text-right shrink-0">
                        {perk.value}
                      </span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            <WhatIfSection card={card} />

            {/* Per-person wallet actions */}
            <Section label="Add to wallet">
              {people.length === 0 ? (
                <p className="text-[13px] text-tertiary">No household members yet.</p>
              ) : (
                <div className="space-y-2">
                  {people.map((person) => {
                    const inWallet = person.cards.some((wc) => wc.card.id === card.id);
                    return (
                      <div key={person.id} className="flex items-center justify-between">
                        <span className="text-[14px] text-primary font-medium">{person.name}</span>
                        <button
                          onClick={() => handleToggle(person.id)}
                          className={`text-[13px] font-medium px-3 py-1.5 rounded-md transition-colors duration-150 ${
                            inWallet
                              ? "bg-red/10 text-red hover:bg-red/20 border border-red/20"
                              : "bg-ink hover:bg-ink/85 text-paper"
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

// ─── What if I added this card? ───────────────────────────────────────────────

function WhatIfSection({ card }: { card: Card }) {
  const people = useStore((s) => s.people);
  const activePersonId = useStore((s) => s.activePersonId);
  const spend = useStore((s) => s.spend);
  const spendMode = useStore((s) => s.spendMode);
  const tier = useStore((s) => s.valuationTier);
  const creditUsage = useStore((s) => s.optimizerAnswers.creditUsage);
  const sandboxOn = useStore((s) => s.sandbox.active);
  const enterSandbox = useStore((s) => s.enterSandbox);
  const toggleCard = useStore((s) => s.toggleCard);

  const ctx = useMemo(
    () => planningContextOf({ people, activePersonId, spend, spendMode, monthlySpend: {}, overrides: {}, subEarned: [], subProgress: {}, cardConfigs: {} }),
    [people, activePersonId, spend, spendMode]
  );
  const held = ctx.walletCards.some((w) => w.card.id === card.id);
  const result = useMemo(
    () => (held ? null : whatIfAdd(ctx.walletCards, ctx.spend, card, tier, creditUsage)),
    [held, ctx, card, tier, creditUsage]
  );
  if (!result) return null;

  const delta = Math.round(result.delta);
  const whose = sandboxOn ? "your sandbox wallet" : "your wallet";

  return (
    <Section label="What if I added this card?">
      <div className="rounded-lg bg-surface p-3 flex items-center justify-between gap-3">
        <p className="text-[14px] text-primary leading-snug">
          {delta > 0 ? (
            <>
              Adds about <span className="font-semibold text-green">${delta.toLocaleString()} a year</span> to {whose}{" "}
              at your spending, after fees.
            </>
          ) : (
            <>Wouldn’t add value to {whose} at your spending{card.fee ? " once the fee is counted" : ""}.</>
          )}
        </p>
        {!sandboxOn && (
          <button
            onClick={() => {
              enterSandbox();
              toggleCard(card.id, candidateConfig(card, ctx.spend));
            }}
            className="shrink-0 text-[13px] font-medium px-3 py-1.5 rounded-md border border-medium bg-white hover:border-strong"
          >
            Try in sandbox
          </button>
        )}
      </div>
    </Section>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface rounded-lg p-2.5">
      <div className="text-[13px] text-tertiary font-medium mb-0.5">
        {label}
      </div>
      <div className="text-[14px] font-medium text-primary">{value}</div>
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
      <div className="text-[14px] font-semibold text-ink mb-2">
        {label}
      </div>
      {children}
    </div>
  );
}
