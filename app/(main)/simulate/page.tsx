"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { useStore } from "@/lib/store";
import { CATEGORIES } from "@/lib/categories";
import { CURRENCY_MAP } from "@/lib/currencies";
import { routeMonth, routeAnnual, calculateFees, calculateSubValue } from "@/lib/engine";
import type { ValuationTier } from "@/lib/engine";
import type { RoutingRow, WalletCard } from "@/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString();
}

function fmtDollar(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

// ─── Spend row ────────────────────────────────────────────────────────────────

function SpendRow({
  row,
  walletCards,
  overrides,
  quarter,
  onSpendChange,
  onOverrideChange,
}: {
  row: RoutingRow;
  walletCards: WalletCard[];
  overrides: Record<string, string | null>;
  quarter: 1 | 2 | 3 | 4;
  onSpendChange: (catId: string, val: number) => void;
  onOverrideChange: (catId: string, walletCardId: string | null) => void;
}) {
  const cat = CATEGORIES.find((c) => c.id === row.categoryId)!;
  const [inputVal, setInputVal] = useState(String(Math.round(row.spend)));
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep input in sync when row.spend changes externally
  const prevSpend = useRef(row.spend);
  if (prevSpend.current !== row.spend) {
    prevSpend.current = row.spend;
    setInputVal(String(Math.round(row.spend)));
  }

  function commitInput() {
    const n = parseInt(inputVal.replace(/[^0-9]/g, ""), 10);
    const clamped = isNaN(n) ? 0 : Math.max(0, Math.min(n, cat.sliderMax));
    onSpendChange(row.categoryId, clamped);
    setInputVal(String(clamped));
  }

  const primaryCard = row.walletCard;
  const overrideId = overrides[row.categoryId] ?? null;

  return (
    <div className="border-b border-subtle last:border-b-0">
      {/* Primary row */}
      <div className="grid grid-cols-[120px_1fr_160px_80px_90px] items-center gap-2 px-3 py-2">
        {/* Category */}
        <span className="text-[12px] text-primary font-medium truncate">{cat.label}</span>

        {/* Slider + input */}
        <div className="flex items-center gap-2 min-w-0">
          <input
            type="range"
            min={0}
            max={cat.sliderMax}
            step={10}
            value={Math.round(row.spend)}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              onSpendChange(row.categoryId, v);
              setInputVal(String(v));
            }}
            className="flex-1 h-1.5 accent-green"
          />
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-tertiary pointer-events-none">
              $
            </span>
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              value={inputVal}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setInputVal(e.target.value)}
              onBlur={commitInput}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  commitInput();
                  inputRef.current?.blur();
                }
              }}
              className="w-20 pl-5 pr-2 py-1 bg-field border border-subtle rounded-md text-[12px] text-primary text-right focus:outline-none focus:border-medium"
            />
          </div>
        </div>

        {/* Card dropdown */}
        <Select
          value={overrideId ?? "__auto__"}
          onValueChange={(v) =>
            onOverrideChange(row.categoryId, v === "__auto__" ? null : v)
          }
        >
          <SelectTrigger className="h-7 text-[11px] w-full px-2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__auto__">
              Auto: {primaryCard.card.name} {row.earnRate}x
            </SelectItem>
            {walletCards.map((wc: WalletCard) => (
              <SelectItem key={wc.id} value={wc.id}>
                {wc.card.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Rate */}
        <span
          className={`text-[12px] font-medium tabular-nums text-right ${
            row.earnRate >= 3
              ? "text-green"
              : row.earnRate >= 2
              ? "text-primary"
              : "text-tertiary"
          }`}
        >
          {row.earnRate}x
          {row.capHit && (
            <span className="ml-1 text-amber text-[10px]" title="Cap reached">
              ⚠
            </span>
          )}
        </span>

        {/* Points + dollar */}
        <div className="text-right">
          <div className="text-[12px] font-medium text-primary tabular-nums">
            {fmt(Math.round(row.points))}
          </div>
          <div className="text-[10px] text-tertiary tabular-nums">
            {fmtDollar(row.dollarValue)}
          </div>
        </div>
      </div>

      {/* Overflow rows */}
      {row.overflow.map((ov, i) => (
        <div
          key={i}
          className="grid grid-cols-[120px_1fr_160px_80px_90px] items-center gap-2 px-3 py-1 bg-surface/50"
        >
          <span className="text-[10px] text-tertiary pl-2">↳ overflow</span>
          <span className="text-[11px] text-secondary truncate">
            {ov.walletCard.card.name}
          </span>
          <div />
          <span className="text-[11px] text-secondary tabular-nums text-right">
            {ov.earnRate}x
          </span>
          <div className="text-right">
            <div className="text-[11px] text-secondary tabular-nums">
              {fmt(Math.round(ov.points))}
            </div>
            <div className="text-[10px] text-tertiary tabular-nums">
              {fmtDollar(ov.dollarValue)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Metric card ──────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "green" | "red" | "default";
}) {
  const valueClass =
    accent === "green"
      ? "text-green"
      : accent === "red"
      ? "text-red"
      : "text-primary";

  return (
    <div className="bg-white border border-subtle rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-wider text-tertiary font-semibold mb-1">
        {label}
      </div>
      <div className={`text-[20px] font-semibold tabular-nums ${valueClass}`}>
        {value}
      </div>
      {sub && <div className="text-[11px] text-tertiary mt-0.5">{sub}</div>}
    </div>
  );
}

// ─── Simulate page ────────────────────────────────────────────────────────────

export default function SimulatePage() {
  const people = useStore((s) => s.people);
  const activePersonId = useStore((s) => s.activePersonId);
  const spend = useStore((s) => s.spend);
  const overrides = useStore((s) => s.overrides);
  const subEarned = useStore((s) => s.subEarned);
  const setSpend = useStore((s) => s.setSpend);
  const setOverride = useStore((s) => s.setOverride);
  const storeValuationTier = useStore((s) => s.valuationTier);
  const setValuation = useStore((s) => s.setValuation);
  const viewQuarter = useStore((s) => s.viewQuarter);
  const setViewQuarter = useStore((s) => s.setViewQuarter);

  const activePerson = people.find((p) => p.id === activePersonId);
  const walletCards = activePerson?.cards ?? [];

  // Local valuation tier (mirrors store but also drives the page)
  const valuationTier: ValuationTier = storeValuationTier;

  // Route current month
  const result = useMemo(
    () =>
      routeMonth(walletCards, spend, overrides, viewQuarter, valuationTier),
    [walletCards, spend, overrides, viewQuarter, valuationTier]
  );

  // Annual result (for metric cards)
  const annualResult = useMemo(
    () =>
      routeAnnual(walletCards, spend, overrides, {}, valuationTier),
    [walletCards, spend, overrides, valuationTier]
  );

  const fees = useMemo(() => calculateFees(walletCards), [walletCards]);

  const subValue = useMemo(
    () => calculateSubValue(walletCards, new Set(subEarned), valuationTier),
    [walletCards, subEarned, valuationTier]
  );

  const netTotal =
    annualResult.totalDollarValue + subValue - fees.netFees;

  const handleSpendChange = useCallback(
    (catId: string, val: number) => setSpend(catId, val),
    [setSpend]
  );

  const handleOverrideChange = useCallback(
    (catId: string, walletCardId: string | null) =>
      setOverride(catId, walletCardId),
    [setOverride]
  );

  if (walletCards.length === 0) {
    return (
      <div className="p-6">
        <div className="bg-white border border-subtle rounded-lg py-16 text-center">
          <p className="text-[13px] text-tertiary mb-2">No cards in wallet yet.</p>
          <a href="/wallet" className="text-[13px] text-green font-medium hover:underline">
            Go to Wallet to add cards →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[14px] font-semibold text-secondary uppercase tracking-wider">
          Spend Simulator
        </h1>

        <div className="flex items-center gap-2">
          {/* Quarter selector */}
          <div className="flex rounded-lg border border-subtle overflow-hidden">
            {([1, 2, 3, 4] as const).map((q) => (
              <button
                key={q}
                onClick={() => setViewQuarter(q)}
                className={`px-3 py-1.5 text-[12px] font-medium transition-colors duration-150 ${
                  viewQuarter === q
                    ? "bg-green text-white"
                    : "bg-white text-secondary hover:bg-surface"
                }`}
              >
                Q{q}
              </button>
            ))}
          </div>

          {/* Valuation toggle */}
          <div className="flex rounded-lg border border-subtle overflow-hidden">
            {(["floor", "composite", "ceiling"] as const).map((tier) => (
              <button
                key={tier}
                onClick={() => setValuation(tier)}
                className={`px-3 py-1.5 text-[12px] font-medium transition-colors duration-150 capitalize ${
                  valuationTier === tier
                    ? "bg-blue/10 text-blue border-blue/20"
                    : "bg-white text-secondary hover:bg-surface"
                }`}
              >
                {tier === "composite" ? "MCC" : tier.charAt(0).toUpperCase() + tier.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Routing table */}
      <section>
        <div className="bg-white border border-subtle rounded-lg overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[120px_1fr_160px_80px_90px] gap-2 px-3 py-2 bg-surface border-b border-subtle">
            <span className="text-[10px] uppercase tracking-wider text-tertiary font-semibold">
              Category
            </span>
            <span className="text-[10px] uppercase tracking-wider text-tertiary font-semibold">
              Monthly spend
            </span>
            <span className="text-[10px] uppercase tracking-wider text-tertiary font-semibold">
              Card
            </span>
            <span className="text-[10px] uppercase tracking-wider text-tertiary font-semibold text-right">
              Rate
            </span>
            <span className="text-[10px] uppercase tracking-wider text-tertiary font-semibold text-right">
              Pts / Value
            </span>
          </div>

          {result.rows.map((row) => (
            <SpendRow
              key={row.categoryId}
              row={row}
              walletCards={walletCards}
              overrides={overrides}
              quarter={viewQuarter}
              onSpendChange={handleSpendChange}
              onOverrideChange={handleOverrideChange}
            />
          ))}

          {result.rows.length === 0 && (
            <div className="py-8 text-center text-[13px] text-tertiary">
              No spending configured.
            </div>
          )}

          {/* Totals row */}
          {result.rows.length > 0 && (
            <div className="grid grid-cols-[120px_1fr_160px_80px_90px] gap-2 px-3 py-2 bg-surface border-t border-subtle">
              <span className="text-[11px] font-semibold text-secondary">Monthly</span>
              <div />
              <div />
              <div />
              <div className="text-right">
                <div className="text-[12px] font-semibold text-primary tabular-nums">
                  {fmt(Math.round(result.currencyTotals.reduce((s, ct) => s + ct.points, 0)))}
                </div>
                <div className="text-[10px] text-green font-medium tabular-nums">
                  {fmtDollar(result.totalDollarValue)}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Metric cards */}
      <section>
        <h2 className="text-[14px] font-semibold text-secondary uppercase tracking-wider mb-3">
          Annual Summary
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <MetricCard
            label="Points value"
            value={fmtDollar(annualResult.totalDollarValue)}
            sub="Annual rewards"
            accent="green"
          />
          <MetricCard
            label="Annual fees"
            value={fmtDollar(fees.netFees)}
            sub={
              fees.estimatedCredits > 0
                ? `${fmtDollar(fees.grossFees)} − ${fmtDollar(fees.estimatedCredits)} credits`
                : `${walletCards.length} card${walletCards.length !== 1 ? "s" : ""}`
            }
            accent={fees.netFees > 0 ? "red" : "green"}
          />
          <MetricCard
            label="SUBs earned"
            value={fmtDollar(subValue)}
            sub="Sign-up bonuses"
            accent={subValue > 0 ? "green" : "default"}
          />
          <MetricCard
            label="Net total value"
            value={fmtDollar(netTotal)}
            sub="Rewards + SUBs − fees"
            accent={netTotal >= 0 ? "green" : "red"}
          />
        </div>
      </section>

      {/* Currency breakdown */}
      {annualResult.currencyTotals.length > 0 && (
        <section>
          <h2 className="text-[14px] font-semibold text-secondary uppercase tracking-wider mb-3">
            Annual Currency Breakdown
          </h2>
          <div className="bg-white border border-subtle rounded-lg overflow-hidden divide-y divide-subtle">
            {annualResult.currencyTotals
              .slice()
              .sort((a, b) => b.dollarValue - a.dollarValue)
              .map((ct) => {
                const currency = CURRENCY_MAP[ct.currencyId];
                const floorVal = currency
                  ? (ct.points * currency.floor) / 10000
                  : ct.dollarValue;
                const ceilVal = currency
                  ? (ct.points * currency.ceiling) / 10000
                  : ct.dollarValue;
                return (
                  <div
                    key={ct.currencyId}
                    className="flex items-center justify-between px-4 py-2.5"
                  >
                    <div>
                      <div className="text-[13px] font-medium text-primary">
                        {currency?.name ?? ct.currencyId}
                      </div>
                      <div className="text-[11px] text-tertiary mt-0.5">
                        {fmt(Math.round(ct.points))} pts
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[13px] font-semibold text-primary tabular-nums">
                        {fmtDollar(ct.dollarValue)}
                      </div>
                      <div className="text-[11px] text-tertiary tabular-nums">
                        {fmtDollar(floorVal)} – {fmtDollar(ceilVal)}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </section>
      )}
    </div>
  );
}
