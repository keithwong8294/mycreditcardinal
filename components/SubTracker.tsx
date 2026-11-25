"use client";

import { useMemo, useState } from "react";
import { useStore, HOUSEHOLD_ID } from "@/lib/store";
import { CURRENCY_MAP } from "@/lib/currencies";
import { parseDateKey, projectSub, toDateKey, yearSpendByCard, type SubProjection } from "@/lib/subTracker";
import type { WalletCard } from "@/types";

const NO_SPEND = Array<number>(12).fill(0);
const EMPTY: Record<string, never> = {};

function money(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

function day(d: Date, withYear = false): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(withYear ? { year: "numeric" } : {}) });
}

/**
 * Spend routed to every wallet card, Jan–Dec this year, at the simulator's
 * spending (per person, or pooled in household mode).
 */
export function useCardSpend(): Map<string, number[]> {
  const people = useStore((s) => s.people);
  const spend = useStore((s) => s.spend);
  const monthly = useStore((s) => s.monthlySpend);
  const overrides = useStore((s) => s.overrides);
  const tier = useStore((s) => s.valuationTier);
  const spendMode = useStore((s) => s.spendMode);
  const [year] = useState(() => new Date().getFullYear());
  return useMemo(() => {
    const profiles =
      spendMode === "household" && people.length > 1
        ? [{ cards: people.flatMap((p) => p.cards), defaults: spend[HOUSEHOLD_ID] ?? EMPTY, monthly: monthly[HOUSEHOLD_ID] ?? EMPTY }]
        : people.map((p) => ({ cards: p.cards, defaults: spend[p.id] ?? EMPTY, monthly: monthly[p.id] ?? EMPTY }));
    return yearSpendByCard(profiles, overrides, tier, year);
  }, [people, spend, monthly, overrides, tier, spendMode, year]);
}

function statusLine(p: SubProjection): { text: string; tone: string } {
  const dl = p.deadline;
  switch (p.status) {
    case "met":
      return {
        text: p.projected ? `Minimum spend reached around ${day(p.projected, true)}. Check it off once the bonus posts.` : "Minimum spend reached. Check it off once the bonus posts.",
        tone: "text-green",
      };
    case "expired":
      return { text: `The window closed ${dl ? day(dl, true) : ""} with ${money(p.remaining)} still to go.`, tone: "text-red" };
    case "no_spend":
      return {
        text: `None of your simulator spending goes to this card yet.${p.neededPerMonth ? ` Put about ${money(p.neededPerMonth)}/mo on it to make the deadline.` : ""}`,
        tone: "text-amber",
      };
    case "late": {
      const lateBy = Math.round((p.projected!.getTime() - dl!.getTime()) / 86_400_000);
      return {
        text: `At ${money(p.monthlyRate)}/mo you'd hit it ${day(p.projected!, true)}, ${lateBy} day${lateBy === 1 ? "" : "s"} after the ${day(dl!)} deadline. Put about ${money(p.neededPerMonth ?? 0)}/mo on it instead.`,
        tone: "text-red",
      };
    }
    case "on_track":
      return {
        text: dl
          ? `On track: hits around ${day(p.projected!, true)}, ${Math.round((dl.getTime() - p.projected!.getTime()) / 86_400_000)} days before the ${day(dl)} deadline.`
          : `On track: hits around ${day(p.projected!, true)}.`,
        tone: "text-green",
      };
  }
}

/** Minimum-spend progress and projected bonus date for one card. */
export function SubTrackerRow({ wc, monthly }: { wc: WalletCard; monthly: number[] | undefined }) {
  const progress = useStore((s) => s.subProgress[wc.id]);
  const setSubProgress = useStore((s) => s.setSubProgress);
  const [today] = useState(() => new Date());
  const sub = wc.card.sub_json!;

  const openedKey = progress?.opened ?? toDateKey(today);
  const p = useMemo(
    () =>
      projectSub({
        requirement: sub.spend_requirement,
        timeframeMonths: sub.timeframe_months,
        opened: parseDateKey(openedKey) ?? today,
        monthly: monthly ?? NO_SPEND,
        spentSoFar: progress?.spent,
        today,
      }),
    [sub, openedKey, monthly, progress?.spent, today]
  );
  const line = statusLine(p);
  const bar = p.status === "met" ? "bg-green" : p.status === "on_track" ? "bg-ink" : p.status === "late" || p.status === "expired" ? "bg-red" : "bg-amber";

  return (
    <div className="mt-2 space-y-2">
      <div>
        <div className="flex justify-between text-[12px] text-secondary mb-1 tabular-nums">
          <span>
            {money(p.spent)} of {money(sub.spend_requirement)}
            {p.spentIsEstimate && p.spent > 0 && <span className="text-tertiary"> (estimated)</span>}
          </span>
          {p.deadline && p.daysLeft != null && p.daysLeft >= 0 && p.status !== "met" && (
            <span>
              {p.daysLeft} day{p.daysLeft === 1 ? "" : "s"} left
            </span>
          )}
        </div>
        <div className="h-1.5 rounded-full bg-field overflow-hidden" role="progressbar" aria-valuenow={Math.round(p.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.round(p.progress * 100)}%` }} />
        </div>
      </div>
      <p className={`text-[12px] leading-snug ${line.tone}`}>{line.text}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-secondary">
        <label className="flex items-center gap-1.5">
          Opened
          <input
            type="date"
            value={openedKey}
            max={toDateKey(today)}
            onChange={(e) => e.target.value && setSubProgress(wc.id, { opened: e.target.value })}
            className="px-1.5 py-0.5 bg-field border border-subtle rounded text-[12px] text-primary"
          />
        </label>
        <label className="flex items-center gap-1.5">
          Spent so far $
          <input
            type="number"
            inputMode="decimal"
            min={0}
            value={progress?.spent ?? ""}
            placeholder={String(Math.round(p.spentIsEstimate ? p.spent : 0))}
            onChange={(e) => setSubProgress(wc.id, { spent: e.target.value === "" ? null : Math.max(0, Number(e.target.value)) })}
            className="w-20 px-1.5 py-0.5 bg-field border border-subtle rounded text-[12px] text-primary tabular-nums"
          />
        </label>
        {progress?.spent != null && (
          <button onClick={() => setSubProgress(wc.id, { spent: null })} className="text-tertiary hover:text-secondary">
            Use simulator estimate
          </button>
        )}
      </div>
    </div>
  );
}

/** Bonuses in progress (not checked off yet) with where each one stands. */
export function SubTrackerList({ cards, spend }: { cards: WalletCard[]; spend: Map<string, number[]> }) {
  const subEarned = useStore((s) => s.subEarned);
  const toggleSub = useStore((s) => s.toggleSub);
  const open = cards.filter((wc) => wc.card.sub_json && !subEarned.includes(wc.id));
  if (open.length === 0) return null;

  return (
    <div className="bg-white border border-subtle rounded-lg overflow-hidden divide-y divide-subtle">
      {open.map((wc) => {
        const sub = wc.card.sub_json!;
        return (
          <div key={wc.id} className="px-3 py-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[14px] font-medium text-primary truncate">{wc.card.name}</div>
                <div className="text-[12px] text-secondary">
                  {sub.points.toLocaleString()} {CURRENCY_MAP[wc.card.currency]?.name ?? "pts"} · Spend {money(sub.spend_requirement)}
                  {sub.timeframe_months > 0 && ` in ${sub.timeframe_months}mo`}
                </div>
              </div>
              <button onClick={() => toggleSub(wc.id)} className="text-[12px] font-medium text-cardinal hover:text-cardinal-dark shrink-0">
                Mark earned
              </button>
            </div>
            <SubTrackerRow wc={wc} monthly={spend.get(wc.id)} />
          </div>
        );
      })}
    </div>
  );
}
