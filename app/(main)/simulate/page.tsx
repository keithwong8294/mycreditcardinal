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

// Stable empty spend record — used as fallback so selectors never return a new
// object reference, which would cause infinite re-renders.
const EMPTY_SPEND: Record<string, number> = {};

function fmt(n: number): string {
  return n.toLocaleString();
}
function fmtDollar(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

type ViewMode = "individual" | "sideBySide" | "stacked";

// ─── Spend row ────────────────────────────────────────────────────────────────
// Renders one category row. `spend` is the user's stored input amount (not the
// capped/allocated amount from the engine). `routingRow` is optional — if absent
// the card / rate / points columns show "—" so the user can still set spend even
// when no cards are in the wallet yet.

function SpendRow({
  categoryId,
  spend,
  routingRow,
  walletCards,
  overrides,
  onSpendChange,
  onOverrideChange,
}: {
  categoryId: string;
  spend: number;
  routingRow?: RoutingRow;
  walletCards: WalletCard[];
  overrides: Record<string, string | null>;
  onSpendChange: (catId: string, val: number) => void;
  onOverrideChange: (catId: string, walletCardId: string | null) => void;
}) {
  const cat = CATEGORIES.find((c) => c.id === categoryId)!;
  const [inputVal, setInputVal] = useState(String(Math.round(spend)));
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync local input when the stored value changes externally (e.g. person switch)
  const prevSpend = useRef(spend);
  if (prevSpend.current !== spend) {
    prevSpend.current = spend;
    setInputVal(String(Math.round(spend)));
  }

  function commitInput() {
    const n = parseInt(inputVal.replace(/[^0-9]/g, ""), 10);
    const clamped = isNaN(n) ? 0 : Math.max(0, Math.min(n, cat.sliderMax));
    onSpendChange(categoryId, clamped);
    setInputVal(String(clamped));
  }

  const overrideId = overrides[categoryId] ?? null;
  const hasCards = walletCards.length > 0;

  return (
    <div className="border-b border-subtle last:border-b-0">
      {/* Primary row */}
      <div className="grid grid-cols-[120px_1fr_160px_80px_90px] items-center gap-2 px-3 py-2">
        {/* Category */}
        <span className="text-[12px] text-primary font-medium truncate">{cat.label}</span>

        {/* Slider + text input */}
        <div className="flex items-center gap-2 min-w-0">
          <input
            type="range"
            min={0}
            max={cat.sliderMax}
            step={10}
            value={Math.round(spend)}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              onSpendChange(categoryId, v);
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
        {hasCards && routingRow ? (
          <Select
            value={overrideId ?? "__auto__"}
            onValueChange={(v) =>
              onOverrideChange(categoryId, v === "__auto__" ? null : v)
            }
          >
            <SelectTrigger className="h-7 text-[11px] w-full px-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__auto__">
                Auto: {routingRow.walletCard.card.name} {routingRow.earnRate}x
              </SelectItem>
              {walletCards.map((wc: WalletCard) => (
                <SelectItem key={wc.id} value={wc.id}>
                  {wc.card.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-[11px] text-tertiary px-2">—</span>
        )}

        {/* Rate */}
        {routingRow && spend > 0 ? (
          <span
            className={`text-[12px] font-medium tabular-nums text-right ${
              routingRow.earnRate >= 3
                ? "text-green"
                : routingRow.earnRate >= 2
                ? "text-primary"
                : "text-tertiary"
            }`}
          >
            {routingRow.earnRate}x
            {routingRow.capHit && (
              <span className="ml-1 text-amber text-[10px]" title="Cap reached">⚠</span>
            )}
          </span>
        ) : (
          <span className="text-[11px] text-tertiary text-right">—</span>
        )}

        {/* Points + dollar */}
        {routingRow && spend > 0 ? (
          <div className="text-right">
            <div className="text-[12px] font-medium text-primary tabular-nums">
              {fmt(Math.round(routingRow.points))}
            </div>
            <div className="text-[10px] text-tertiary tabular-nums">
              {fmtDollar(routingRow.dollarValue)}
            </div>
          </div>
        ) : (
          <span className="text-[11px] text-tertiary text-right">—</span>
        )}
      </div>

      {/* Overflow rows */}
      {routingRow?.overflow.map((ov, i) => (
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

// ─── Table column headers ─────────────────────────────────────────────────────

function TableHeaders() {
  return (
    <div className="grid grid-cols-[120px_1fr_160px_80px_90px] gap-2 px-3 py-2 bg-surface border-b border-subtle">
      <span className="text-[10px] uppercase tracking-wider text-tertiary font-semibold">Category</span>
      <span className="text-[10px] uppercase tracking-wider text-tertiary font-semibold">Monthly spend</span>
      <span className="text-[10px] uppercase tracking-wider text-tertiary font-semibold">Card</span>
      <span className="text-[10px] uppercase tracking-wider text-tertiary font-semibold text-right">Rate</span>
      <span className="text-[10px] uppercase tracking-wider text-tertiary font-semibold text-right">Pts / Value</span>
    </div>
  );
}

// ─── Person routing table (household modes) ───────────────────────────────────

function PersonTable({
  personId,
  personName,
  valuationTier,
  viewQuarter,
}: {
  personId: string;
  personName: string;
  valuationTier: ValuationTier;
  viewQuarter: 1 | 2 | 3 | 4;
}) {
  const people = useStore((s) => s.people);
  const overrides = useStore((s) => s.overrides);
  const personSpend = useStore((s) => s.spend[personId]) ?? EMPTY_SPEND;
  const setSpend = useStore((s) => s.setSpend);
  const setOverride = useStore((s) => s.setOverride);

  const walletCards = useMemo(
    () => people.find((p) => p.id === personId)?.cards ?? [],
    [people, personId]
  );

  const result = useMemo(
    () => routeMonth(walletCards, personSpend, overrides, viewQuarter, valuationTier),
    [walletCards, personSpend, overrides, viewQuarter, valuationTier]
  );

  // Map categoryId → routing row for O(1) lookup
  const routingMap = useMemo(
    () => Object.fromEntries(result.rows.map((r) => [r.categoryId, r])),
    [result.rows]
  );

  const monthlyPoints = result.currencyTotals.reduce((s, ct) => s + ct.points, 0);

  const handleSpendChange = useCallback(
    (catId: string, val: number) => setSpend(personId, catId, val),
    [setSpend, personId]
  );

  const handleOverrideChange = useCallback(
    (catId: string, walletCardId: string | null) => setOverride(catId, walletCardId),
    [setOverride]
  );

  return (
    <div className="bg-white border border-subtle rounded-lg overflow-hidden min-w-[520px]">
      {/* Person header */}
      <div className="px-3 py-2 border-b border-subtle bg-[#0f1219] flex items-center justify-between">
        <span className="text-[12px] font-semibold text-white">{personName}</span>
        <span className="text-[11px] text-white/40">
          {walletCards.length} card{walletCards.length !== 1 ? "s" : ""}
        </span>
      </div>

      <TableHeaders />

      {/* All 12 categories — always rendered so spend is editable even without cards */}
      {CATEGORIES.map((cat) => (
        <SpendRow
          key={`${personId}-${cat.id}`}
          categoryId={cat.id}
          spend={personSpend[cat.id] ?? 0}
          routingRow={routingMap[cat.id]}
          walletCards={walletCards}
          overrides={overrides}
          onSpendChange={handleSpendChange}
          onOverrideChange={handleOverrideChange}
        />
      ))}

      {/* Monthly totals */}
      {monthlyPoints > 0 && (
        <div className="grid grid-cols-[120px_1fr_160px_80px_90px] gap-2 px-3 py-2 bg-surface border-t border-subtle">
          <span className="text-[11px] font-semibold text-secondary">Monthly</span>
          <div /><div /><div />
          <div className="text-right">
            <div className="text-[12px] font-semibold text-primary tabular-nums">
              {fmt(Math.round(monthlyPoints))}
            </div>
            <div className="text-[10px] text-green font-medium tabular-nums">
              {fmtDollar(result.totalDollarValue)}
            </div>
          </div>
        </div>
      )}
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
    accent === "green" ? "text-green" : accent === "red" ? "text-red" : "text-primary";

  return (
    <div className="bg-white border border-subtle rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-wider text-tertiary font-semibold mb-1">
        {label}
      </div>
      <div className={`text-[20px] font-semibold tabular-nums ${valueClass}`}>{value}</div>
      {sub && <div className="text-[11px] text-tertiary mt-0.5">{sub}</div>}
    </div>
  );
}

// ─── Simulate page ────────────────────────────────────────────────────────────

export default function SimulatePage() {
  const people = useStore((s) => s.people);
  const activePersonId = useStore((s) => s.activePersonId);
  const allSpend = useStore((s) => s.spend);
  const overrides = useStore((s) => s.overrides);
  const subEarned = useStore((s) => s.subEarned);
  const setSpend = useStore((s) => s.setSpend);
  const setOverride = useStore((s) => s.setOverride);
  const storeValuationTier = useStore((s) => s.valuationTier);
  const setValuation = useStore((s) => s.setValuation);
  const viewQuarter = useStore((s) => s.viewQuarter);
  const setViewQuarter = useStore((s) => s.setViewQuarter);

  const [viewMode, setViewMode] = useState<ViewMode>("individual");

  const valuationTier: ValuationTier = storeValuationTier;

  const activePerson = people.find((p) => p.id === activePersonId);
  const walletCards = activePerson?.cards ?? [];
  const activeSpend = allSpend[activePersonId] ?? EMPTY_SPEND;

  // ── Individual mode calculations ─────────────────────────────────────────────

  const result = useMemo(
    () => routeMonth(walletCards, activeSpend, overrides, viewQuarter, valuationTier),
    [walletCards, activeSpend, overrides, viewQuarter, valuationTier]
  );

  // Map categoryId → routing row for O(1) lookup
  const routingMap = useMemo(
    () => Object.fromEntries(result.rows.map((r) => [r.categoryId, r])),
    [result.rows]
  );

  const annualResult = useMemo(
    () => routeAnnual(walletCards, activeSpend, overrides, {}, valuationTier),
    [walletCards, activeSpend, overrides, valuationTier]
  );

  const fees = useMemo(() => calculateFees(walletCards), [walletCards]);

  const subValue = useMemo(
    () => calculateSubValue(walletCards, new Set(subEarned), valuationTier),
    [walletCards, subEarned, valuationTier]
  );

  const netTotal = annualResult.totalDollarValue + subValue - fees.netFees;

  const handleSpendChange = useCallback(
    (catId: string, val: number) => setSpend(activePersonId, catId, val),
    [setSpend, activePersonId]
  );

  const handleOverrideChange = useCallback(
    (catId: string, walletCardId: string | null) => setOverride(catId, walletCardId),
    [setOverride]
  );

  // Monthly points total for the totals footer
  const monthlyPoints = result.currencyTotals.reduce((s, ct) => s + ct.points, 0);

  // ── Household mode calculations ───────────────────────────────────────────────

  const householdStats = useMemo(() => {
    if (viewMode === "individual") return null;
    const subEarnedSet = new Set(subEarned);
    let totalAnnualValue = 0;
    let totalGrossFees = 0;
    let totalCredits = 0;
    let totalNetFees = 0;
    let totalSubValue = 0;
    const mergedCurrencies: Record<string, { points: number; dollarValue: number }> = {};

    for (const person of people) {
      const personSpend = allSpend[person.id] ?? EMPTY_SPEND;
      const cards = person.cards;
      const annual = routeAnnual(cards, personSpend, overrides, {}, valuationTier);
      const personFees = calculateFees(cards);
      const personSubVal = calculateSubValue(cards, subEarnedSet, valuationTier);

      totalAnnualValue += annual.totalDollarValue;
      totalGrossFees += personFees.grossFees;
      totalCredits += personFees.estimatedCredits;
      totalNetFees += personFees.netFees;
      totalSubValue += personSubVal;

      for (const ct of annual.currencyTotals) {
        if (!mergedCurrencies[ct.currencyId]) {
          mergedCurrencies[ct.currencyId] = { points: 0, dollarValue: 0 };
        }
        mergedCurrencies[ct.currencyId].points += ct.points;
        mergedCurrencies[ct.currencyId].dollarValue += ct.dollarValue;
      }
    }

    return {
      totalAnnualValue,
      totalGrossFees,
      totalCredits,
      totalNetFees,
      totalSubValue,
      netTotal: totalAnnualValue + totalSubValue - totalNetFees,
      currencyTotals: Object.entries(mergedCurrencies).map(([currencyId, v]) => ({
        currencyId,
        ...v,
      })),
    };
  }, [viewMode, people, allSpend, overrides, valuationTier, subEarned]);

  // ── Display stats (individual or household) ───────────────────────────────────

  const isHousehold = viewMode !== "individual";
  const displayStats = isHousehold && householdStats
    ? householdStats
    : {
        totalAnnualValue: annualResult.totalDollarValue,
        totalGrossFees: fees.grossFees,
        totalCredits: fees.estimatedCredits,
        totalNetFees: fees.netFees,
        totalSubValue: subValue,
        netTotal,
        currencyTotals: annualResult.currencyTotals,
      };

  // ── Empty state ───────────────────────────────────────────────────────────────

  const hasAnyCards = people.some((p) => p.cards.length > 0);
  if (!hasAnyCards) {
    return (
      <div className="p-6">
        <div className="bg-white border border-subtle rounded-lg py-16 text-center">
          <p className="text-[13px] text-tertiary mb-2">No cards in wallet yet.</p>
          <a href="/browse" className="text-[13px] text-green font-medium hover:underline">
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
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-[14px] font-semibold text-secondary uppercase tracking-wider">
            Spend Simulator
          </h1>

          {/* Household view toggle — only shown when multiple people exist */}
          {people.length > 1 && (
            <div className="flex rounded-lg border border-subtle overflow-hidden">
              {(
                [
                  { mode: "individual" as ViewMode, label: "Individual" },
                  { mode: "sideBySide" as ViewMode, label: "Side by Side" },
                  { mode: "stacked" as ViewMode, label: "Stacked" },
                ] as const
              ).map(({ mode, label }) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1.5 text-[12px] font-medium transition-colors duration-150 ${
                    viewMode === mode
                      ? "bg-[#0f1219] text-white"
                      : "bg-white text-secondary hover:bg-surface"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

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

      {/* Routing table(s) */}
      <section>
        {/* Individual mode — always shows all 12 categories */}
        {viewMode === "individual" && (
          <div className="bg-white border border-subtle rounded-lg overflow-hidden">
            <TableHeaders />

            {CATEGORIES.map((cat) => (
              <SpendRow
                key={`${activePersonId}-${cat.id}`}
                categoryId={cat.id}
                spend={activeSpend[cat.id] ?? 0}
                routingRow={routingMap[cat.id]}
                walletCards={walletCards}
                overrides={overrides}
                onSpendChange={handleSpendChange}
                onOverrideChange={handleOverrideChange}
              />
            ))}

            {/* Monthly totals footer */}
            {monthlyPoints > 0 && (
              <div className="grid grid-cols-[120px_1fr_160px_80px_90px] gap-2 px-3 py-2 bg-surface border-t border-subtle">
                <span className="text-[11px] font-semibold text-secondary">Monthly</span>
                <div /><div /><div />
                <div className="text-right">
                  <div className="text-[12px] font-semibold text-primary tabular-nums">
                    {fmt(Math.round(monthlyPoints))}
                  </div>
                  <div className="text-[10px] text-green font-medium tabular-nums">
                    {fmtDollar(result.totalDollarValue)}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Side by Side mode */}
        {viewMode === "sideBySide" && (
          <div className="overflow-x-auto">
            <div className="flex gap-4" style={{ minWidth: `${people.length * 540}px` }}>
              {people.map((person) => (
                <div key={person.id} className="flex-1">
                  <PersonTable
                    personId={person.id}
                    personName={person.name}
                    valuationTier={valuationTier}
                    viewQuarter={viewQuarter}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stacked mode */}
        {viewMode === "stacked" && (
          <div className="space-y-4">
            {people.map((person) => (
              <PersonTable
                key={person.id}
                personId={person.id}
                personName={person.name}
                valuationTier={valuationTier}
                viewQuarter={viewQuarter}
              />
            ))}
          </div>
        )}
      </section>

      {/* Annual summary metrics */}
      <section>
        <h2 className="text-[14px] font-semibold text-secondary uppercase tracking-wider mb-3">
          {isHousehold ? "Household Annual Summary" : "Annual Summary"}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <MetricCard
            label="Points value"
            value={fmtDollar(displayStats.totalAnnualValue)}
            sub="Annual rewards"
            accent="green"
          />
          <MetricCard
            label="Annual fees"
            value={fmtDollar(displayStats.totalNetFees)}
            sub={
              displayStats.totalCredits > 0
                ? `${fmtDollar(displayStats.totalGrossFees)} − ${fmtDollar(displayStats.totalCredits)} credits`
                : isHousehold
                ? `${people.reduce((n, p) => n + p.cards.length, 0)} cards total`
                : `${walletCards.length} card${walletCards.length !== 1 ? "s" : ""}`
            }
            accent={displayStats.totalNetFees > 0 ? "red" : "green"}
          />
          <MetricCard
            label="SUBs earned"
            value={fmtDollar(displayStats.totalSubValue)}
            sub="Sign-up bonuses"
            accent={displayStats.totalSubValue > 0 ? "green" : "default"}
          />
          <MetricCard
            label="Net total value"
            value={fmtDollar(displayStats.netTotal)}
            sub="Rewards + SUBs − fees"
            accent={displayStats.netTotal >= 0 ? "green" : "red"}
          />
        </div>
      </section>

      {/* Currency breakdown */}
      {displayStats.currencyTotals.length > 0 && (
        <section>
          <h2 className="text-[14px] font-semibold text-secondary uppercase tracking-wider mb-3">
            {isHousehold ? "Household Currency Breakdown" : "Annual Currency Breakdown"}
          </h2>
          <div className="bg-white border border-subtle rounded-lg overflow-hidden divide-y divide-subtle">
            {displayStats.currencyTotals
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
