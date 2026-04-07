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

// ─── Constants ────────────────────────────────────────────────────────────────

const EMPTY_SPEND: Record<string, number> = {};

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const CURRENT_YEAR = 2026;

// Build list of "YYYY-MM" strings for the current year
const MONTHS_OF_YEAR = MONTH_LABELS.map((_, i) => {
  const mm = String(i + 1).padStart(2, "0");
  return `${CURRENT_YEAR}-${mm}`;
});

function monthToQuarter(yearMonth: string): 1 | 2 | 3 | 4 {
  const month = parseInt(yearMonth.split("-")[1], 10); // 1-12
  return (Math.ceil(month / 3)) as 1 | 2 | 3 | 4;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type ViewMode = "individual" | "combined" | "compare";

function fmt(n: number): string {
  return n.toLocaleString();
}
function fmtDollar(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

// ─── Spend row ────────────────────────────────────────────────────────────────

function SpendRow({
  categoryId,
  spend,
  routingRow,
  walletCards,
  overrides,
  onSpendChange,
  onOverrideChange,
  defaultAmount,
  isMonthlyOverride,
  onClearOverride,
}: {
  categoryId: string;
  spend: number;
  routingRow?: RoutingRow;
  walletCards: WalletCard[];
  overrides: Record<string, string | null>;
  onSpendChange: (catId: string, val: number) => void;
  onOverrideChange: (catId: string, walletCardId: string | null) => void;
  defaultAmount?: number;
  isMonthlyOverride?: boolean;
  onClearOverride?: () => void;
}) {
  const cat = CATEGORIES.find((c) => c.id === categoryId)!;
  const [inputVal, setInputVal] = useState(String(Math.round(spend)));
  const inputRef = useRef<HTMLInputElement>(null);

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
      <div className="grid grid-cols-[130px_1fr_170px_60px_100px] items-center gap-2 px-3 py-2">
        {/* Category */}
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-[12px] text-primary font-medium truncate">{cat.label}</span>
          {isMonthlyOverride && onClearOverride && (
            <button
              onClick={onClearOverride}
              title="Reset to average"
              className="shrink-0 text-[10px] text-blue hover:text-blue/70 transition-colors leading-none"
            >
              ↺
            </button>
          )}
        </div>

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
            className="flex-1 cursor-pointer accent-green"
            style={{ minWidth: 0 }}
          />
          <div className="relative shrink-0">
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
                if (e.key === "Enter") { commitInput(); inputRef.current?.blur(); }
              }}
              className={`w-20 pl-5 pr-2 py-1 border rounded-md text-[12px] text-primary text-right focus:outline-none focus:border-medium ${
                isMonthlyOverride
                  ? "bg-blue/5 border-blue/30"
                  : "bg-field border-subtle"
              }`}
            />
          </div>
          {isMonthlyOverride && defaultAmount !== undefined && (
            <span className="text-[10px] text-blue/60 shrink-0 tabular-nums hidden sm:inline">
              avg ${defaultAmount}
            </span>
          )}
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
              {/* Render display text explicitly — Base UI mirrors ItemText which
                  can fail with JSX expressions, so we control the trigger label */}
              <span className="truncate flex-1 text-left">
                {overrideId
                  ? (walletCards.find((wc) => wc.id === overrideId)?.card.name ?? "Card")
                  : `Auto: ${routingRow.walletCard.card.name} ${routingRow.earnRate}x`}
              </span>
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
          className="grid grid-cols-[130px_1fr_170px_60px_100px] items-center gap-2 px-3 py-1 bg-surface/50"
        >
          <span className="text-[10px] text-tertiary pl-2">↳ overflow</span>
          <span className="text-[11px] text-secondary truncate">{ov.walletCard.card.name}</span>
          <div />
          <span className="text-[11px] text-secondary tabular-nums text-right">{ov.earnRate}x</span>
          <div className="text-right">
            <div className="text-[11px] text-secondary tabular-nums">{fmt(Math.round(ov.points))}</div>
            <div className="text-[10px] text-tertiary tabular-nums">{fmtDollar(ov.dollarValue)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Table headers ────────────────────────────────────────────────────────────

function TableHeaders() {
  return (
    <div className="grid grid-cols-[130px_1fr_170px_60px_100px] gap-2 px-3 py-2 bg-surface border-b border-subtle">
      <span className="text-[10px] uppercase tracking-wider text-tertiary font-semibold">Category</span>
      <span className="text-[10px] uppercase tracking-wider text-tertiary font-semibold">Monthly spend</span>
      <span className="text-[10px] uppercase tracking-wider text-tertiary font-semibold">Card</span>
      <span className="text-[10px] uppercase tracking-wider text-tertiary font-semibold text-right">Rate</span>
      <span className="text-[10px] uppercase tracking-wider text-tertiary font-semibold text-right">Pts / Value</span>
    </div>
  );
}

// ─── Person routing table (compare mode) ─────────────────────────────────────

function PersonTable({
  personId,
  personName,
  valuationTier,
  quarter,
  selectedMonth,
}: {
  personId: string;
  personName: string;
  valuationTier: ValuationTier;
  quarter: 1 | 2 | 3 | 4;
  selectedMonth: string | null;
}) {
  const people = useStore((s) => s.people);
  const overrides = useStore((s) => s.overrides);
  const defaultSpend = useStore((s) => s.spend[personId] ?? EMPTY_SPEND);
  const monthlySpendStore = useStore((s) => s.monthlySpend[personId] ?? {} as Record<string, Record<string, number>>);
  const setSpend = useStore((s) => s.setSpend);
  const setMonthlySpend = useStore((s) => s.setMonthlySpend);
  const clearMonthlySpend = useStore((s) => s.clearMonthlySpend);
  const getSpendForMonth = useStore((s) => s.getSpendForMonth);
  const setOverride = useStore((s) => s.setOverride);

  const walletCards = useMemo(
    () => people.find((p) => p.id === personId)?.cards ?? [],
    [people, personId]
  );

  const effectiveSpend = useMemo(() => {
    if (!selectedMonth) return defaultSpend as Record<string, number>;
    const result: Record<string, number> = {};
    for (const cat of CATEGORIES) {
      const override = monthlySpendStore[cat.id]?.[selectedMonth];
      result[cat.id] = override !== undefined ? override : (defaultSpend[cat.id] ?? cat.defaultAmount);
    }
    return result;
  }, [selectedMonth, defaultSpend, monthlySpendStore]);

  const result = useMemo(
    () => routeMonth(walletCards, effectiveSpend, overrides, quarter, valuationTier),
    [walletCards, effectiveSpend, overrides, quarter, valuationTier]
  );

  const routingMap = useMemo(
    () => Object.fromEntries(result.rows.map((r) => [r.categoryId, r])),
    [result.rows]
  );

  const monthlyPoints = result.currencyTotals.reduce((s, ct) => s + ct.points, 0);

  const handleSpendChange = useCallback(
    (catId: string, val: number) => {
      if (selectedMonth) {
        const def = defaultSpend[catId] ?? CATEGORIES.find(c => c.id === catId)?.defaultAmount ?? 0;
        if (val === def) {
          clearMonthlySpend(personId, catId, selectedMonth);
        } else {
          setMonthlySpend(personId, catId, selectedMonth, val);
        }
      } else {
        setSpend(personId, catId, val);
      }
    },
    [personId, selectedMonth, defaultSpend, setSpend, setMonthlySpend, clearMonthlySpend]
  );

  const handleOverrideChange = useCallback(
    (catId: string, walletCardId: string | null) => setOverride(catId, walletCardId),
    [setOverride]
  );

  return (
    <div className="bg-white border border-subtle rounded-lg overflow-hidden min-w-[520px]">
      <div className="px-3 py-2 border-b border-subtle bg-[#0f1219] flex items-center justify-between">
        <span className="text-[12px] font-semibold text-white">{personName}</span>
        <span className="text-[11px] text-white/40">
          {walletCards.length} card{walletCards.length !== 1 ? "s" : ""}
        </span>
      </div>
      <TableHeaders />
      {CATEGORIES.map((cat) => {
        const hasMonthlyOverride = selectedMonth
          ? monthlySpendStore[cat.id]?.[selectedMonth] !== undefined
          : false;
        return (
          <SpendRow
            key={`${personId}-${cat.id}-${selectedMonth ?? "annual"}`}
            categoryId={cat.id}
            spend={effectiveSpend[cat.id] ?? 0}
            routingRow={routingMap[cat.id]}
            walletCards={walletCards}
            overrides={overrides}
            onSpendChange={handleSpendChange}
            onOverrideChange={handleOverrideChange}
            defaultAmount={selectedMonth ? (defaultSpend[cat.id] ?? 0) : undefined}
            isMonthlyOverride={hasMonthlyOverride}
            onClearOverride={hasMonthlyOverride && selectedMonth
              ? () => clearMonthlySpend(personId, cat.id, selectedMonth)
              : undefined}
          />
        );
      })}
      {monthlyPoints > 0 && (
        <div className="grid grid-cols-[130px_1fr_170px_60px_100px] gap-2 px-3 py-2 bg-surface border-t border-subtle">
          <span className="text-[11px] font-semibold text-secondary">Monthly</span>
          <div /><div /><div />
          <div className="text-right">
            <div className="text-[12px] font-semibold text-primary tabular-nums">{fmt(Math.round(monthlyPoints))}</div>
            <div className="text-[10px] text-green font-medium tabular-nums">{fmtDollar(result.totalDollarValue)}</div>
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
      <div className="text-[10px] uppercase tracking-wider text-tertiary font-semibold mb-1">{label}</div>
      <div className={`text-[20px] font-semibold tabular-nums ${valueClass}`}>{value}</div>
      {sub && <div className="text-[11px] text-tertiary mt-0.5">{sub}</div>}
    </div>
  );
}

// ─── Simulate page ────────────────────────────────────────────────────────────

export default function SimulatePage() {
  const people = useStore((s) => s.people);
  const activePersonId = useStore((s) => s.activePersonId);
  const setActivePerson = useStore((s) => s.setActivePerson);
  const allSpend = useStore((s) => s.spend);
  const allMonthlySpend = useStore((s) => s.monthlySpend);
  const overrides = useStore((s) => s.overrides);
  const subEarned = useStore((s) => s.subEarned);
  const setSpend = useStore((s) => s.setSpend);
  const setMonthlySpend = useStore((s) => s.setMonthlySpend);
  const clearMonthlySpend = useStore((s) => s.clearMonthlySpend);
  const getSpendForMonth = useStore((s) => s.getSpendForMonth);
  const setOverride = useStore((s) => s.setOverride);
  const storeValuationTier = useStore((s) => s.valuationTier);
  const setValuation = useStore((s) => s.setValuation);

  const [viewMode, setViewMode] = useState<ViewMode>("individual");
  // null = annual summary; "YYYY-MM" = specific month view
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  const valuationTier: ValuationTier = storeValuationTier;

  const activePerson = people.find((p) => p.id === activePersonId);
  const walletCards = activePerson?.cards ?? [];
  const activeDefaultSpend = allSpend[activePersonId] ?? EMPTY_SPEND as Record<string, number>;
  const activeMonthlySpend = allMonthlySpend[activePersonId] ?? {};

  // Derive quarter from selected month (for rotating card logic)
  const viewQuarter: 1 | 2 | 3 | 4 = selectedMonth ? monthToQuarter(selectedMonth) : 1;

  // Effective spend for the active person (monthly override or default)
  const activeSpend = useMemo(() => {
    if (!selectedMonth) return activeDefaultSpend as Record<string, number>;
    const result: Record<string, number> = {};
    for (const cat of CATEGORIES) {
      const override = activeMonthlySpend[cat.id]?.[selectedMonth];
      result[cat.id] = override !== undefined ? override : (activeDefaultSpend[cat.id] ?? cat.defaultAmount);
    }
    return result;
  }, [selectedMonth, activeDefaultSpend, activeMonthlySpend]);

  // ── Individual mode calculations ─────────────────────────────────────────────

  const result = useMemo(
    () => routeMonth(walletCards, activeSpend, overrides, viewQuarter, valuationTier),
    [walletCards, activeSpend, overrides, viewQuarter, valuationTier]
  );

  const routingMap = useMemo(
    () => Object.fromEntries(result.rows.map((r) => [r.categoryId, r])),
    [result.rows]
  );

  // Annual result: route all 12 months using per-month spend, sum results
  const annualResult = useMemo(() => {
    if (selectedMonth) {
      // In month view, show annualized estimate for this month
      return routeAnnual(walletCards, activeSpend, overrides, {}, valuationTier);
    }
    // True annual: sum each month using its override or default
    let totalDollarValue = 0;
    const currencyMap: Record<string, { points: number; dollarValue: number }> = {};
    for (const ym of MONTHS_OF_YEAR) {
      const defaults = allSpend[activePersonId] ?? EMPTY_SPEND;
      const memberMonthly = allMonthlySpend[activePersonId] ?? {};
      const monthSpend: Record<string, number> = {};
      for (const cat of CATEGORIES) {
        const ov = memberMonthly[cat.id]?.[ym];
        monthSpend[cat.id] = ov !== undefined ? ov : (defaults[cat.id] ?? cat.defaultAmount);
      }
      const q = monthToQuarter(ym);
      const monthResult = routeMonth(walletCards, monthSpend, overrides, q, valuationTier);
      totalDollarValue += monthResult.totalDollarValue;
      for (const ct of monthResult.currencyTotals) {
        if (!currencyMap[ct.currencyId]) currencyMap[ct.currencyId] = { points: 0, dollarValue: 0 };
        currencyMap[ct.currencyId].points += ct.points;
        currencyMap[ct.currencyId].dollarValue += ct.dollarValue;
      }
    }
    return {
      totalDollarValue,
      currencyTotals: Object.entries(currencyMap).map(([currencyId, v]) => ({ currencyId, ...v })),
      rows: [],
    };
  }, [selectedMonth, walletCards, activeSpend, overrides, valuationTier, activePersonId, allSpend, allMonthlySpend]);

  const fees = useMemo(() => calculateFees(walletCards), [walletCards]);

  const subValue = useMemo(
    () => calculateSubValue(walletCards, new Set(subEarned), valuationTier),
    [walletCards, subEarned, valuationTier]
  );

  const netTotal = annualResult.totalDollarValue + subValue - fees.netFees;

  const monthlyPoints = result.currencyTotals.reduce((s, ct) => s + ct.points, 0);

  // Spend change handlers
  const handleSpendChange = useCallback(
    (catId: string, val: number) => {
      if (selectedMonth) {
        const def = activeDefaultSpend[catId] ?? CATEGORIES.find(c => c.id === catId)?.defaultAmount ?? 0;
        if (val === def) {
          clearMonthlySpend(activePersonId, catId, selectedMonth);
        } else {
          setMonthlySpend(activePersonId, catId, selectedMonth, val);
        }
      } else {
        setSpend(activePersonId, catId, val);
      }
    },
    [activePersonId, selectedMonth, activeDefaultSpend, setSpend, setMonthlySpend, clearMonthlySpend]
  );

  const handleOverrideChange = useCallback(
    (catId: string, walletCardId: string | null) => setOverride(catId, walletCardId),
    [setOverride]
  );

  // ── Household stats (combined + compare modes) ────────────────────────────────

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
      const cards = person.cards;
      const personDefaults = allSpend[person.id] ?? EMPTY_SPEND;
      const personMonthly = allMonthlySpend[person.id] ?? {};
      const resolveSpend = (ym: string): Record<string, number> => {
        const result: Record<string, number> = {};
        for (const cat of CATEGORIES) {
          const ov = personMonthly[cat.id]?.[ym];
          result[cat.id] = ov !== undefined ? ov : (personDefaults[cat.id] ?? cat.defaultAmount);
        }
        return result;
      };
      let personAnnual;
      if (selectedMonth) {
        const monthSpend = resolveSpend(selectedMonth);
        const q = monthToQuarter(selectedMonth);
        const mr = routeMonth(cards, monthSpend, overrides, q, valuationTier);
        personAnnual = { totalDollarValue: mr.totalDollarValue * 12, currencyTotals: mr.currencyTotals.map(ct => ({ ...ct, points: ct.points * 12, dollarValue: ct.dollarValue * 12 })) };
      } else {
        let tv = 0;
        const cmap: Record<string, { points: number; dollarValue: number }> = {};
        for (const ym of MONTHS_OF_YEAR) {
          const ms = resolveSpend(ym);
          const q = monthToQuarter(ym);
          const mr = routeMonth(cards, ms, overrides, q, valuationTier);
          tv += mr.totalDollarValue;
          for (const ct of mr.currencyTotals) {
            if (!cmap[ct.currencyId]) cmap[ct.currencyId] = { points: 0, dollarValue: 0 };
            cmap[ct.currencyId].points += ct.points;
            cmap[ct.currencyId].dollarValue += ct.dollarValue;
          }
        }
        personAnnual = { totalDollarValue: tv, currencyTotals: Object.entries(cmap).map(([c, v]) => ({ currencyId: c, ...v })) };
      }

      const personFees = calculateFees(cards);
      const personSubVal = calculateSubValue(cards, subEarnedSet, valuationTier);
      totalAnnualValue += personAnnual.totalDollarValue;
      totalGrossFees += personFees.grossFees;
      totalCredits += personFees.estimatedCredits;
      totalNetFees += personFees.netFees;
      totalSubValue += personSubVal;

      for (const ct of personAnnual.currencyTotals) {
        if (!mergedCurrencies[ct.currencyId]) mergedCurrencies[ct.currencyId] = { points: 0, dollarValue: 0 };
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
      currencyTotals: Object.entries(mergedCurrencies).map(([currencyId, v]) => ({ currencyId, ...v })),
    };
  }, [viewMode, people, overrides, valuationTier, subEarned, selectedMonth, allSpend, allMonthlySpend]);

  // Combined mode: merged wallet + summed spend from all people
  const combinedData = useMemo(() => {
    if (viewMode !== "combined") return null;

    // Pool all wallet cards (deduplicate by walletCard.id — each person's is unique)
    const allCards = people.flatMap((p) => p.cards);

    // Sum spending by category
    const combinedSpend: Record<string, number> = {};
    for (const cat of CATEGORIES) {
      combinedSpend[cat.id] = people.reduce((sum, person) => {
        const personDefaults = allSpend[person.id] ?? EMPTY_SPEND;
        const personMonthly = allMonthlySpend[person.id] ?? {};
        if (selectedMonth) {
          const ov = personMonthly[cat.id]?.[selectedMonth];
          const val = ov !== undefined ? ov : (personDefaults[cat.id] ?? cat.defaultAmount);
          return sum + val;
        }
        return sum + (personDefaults[cat.id] ?? cat.defaultAmount);
      }, 0);
    }

    const q = selectedMonth ? monthToQuarter(selectedMonth) : viewQuarter;
    const result = routeMonth(allCards, combinedSpend, overrides, q, valuationTier);
    const routingMap = Object.fromEntries(result.rows.map((r) => [r.categoryId, r]));
    return { allCards, combinedSpend, result, routingMap };
  }, [viewMode, people, selectedMonth, viewQuarter, overrides, valuationTier, allSpend, allMonthlySpend]);

  // ── Display stats ─────────────────────────────────────────────────────────────

  const isHousehold = viewMode !== "individual";
  const displayStats = isHousehold && householdStats
    ? householdStats
    : { totalAnnualValue: annualResult.totalDollarValue, totalGrossFees: fees.grossFees, totalCredits: fees.estimatedCredits, totalNetFees: fees.netFees, totalSubValue: subValue, netTotal, currencyTotals: annualResult.currencyTotals };

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

  const monthLabel = selectedMonth
    ? `${MONTH_LABELS[parseInt(selectedMonth.split("-")[1], 10) - 1]} ${CURRENT_YEAR}`
    : null;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-[14px] font-semibold text-secondary uppercase tracking-wider">
              Spend Simulator
            </h1>

            {/* View mode toggle — only shown when multiple people */}
            {people.length > 1 && (
              <div className="flex rounded-lg border border-subtle overflow-hidden">
                {(
                  [
                    { mode: "individual" as ViewMode, label: "Individual" },
                    { mode: "combined" as ViewMode, label: "Combined" },
                    { mode: "compare" as ViewMode, label: "Compare" },
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

          {/* Person selector chips (individual mode only) */}
          {viewMode === "individual" && people.length > 1 && (
            <div className="flex gap-1.5">
              {people.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setActivePerson(p.id)}
                  className={`px-2.5 py-1 rounded-lg text-[12px] font-medium border transition-colors duration-150 ${
                    activePersonId === p.id
                      ? "bg-green/10 text-green border-green/30"
                      : "bg-white text-secondary border-subtle hover:border-medium"
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Month + valuation controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Month selector — scrollable */}
          <div className="flex rounded-lg border border-subtle overflow-x-auto text-[12px] max-w-full shrink-0">
            <button
              onClick={() => setSelectedMonth(null)}
              className={`px-3 py-1.5 font-medium transition-colors duration-150 whitespace-nowrap shrink-0 ${
                !selectedMonth ? "bg-[#0f1219] text-white" : "bg-white text-secondary hover:bg-surface"
              }`}
            >
              Annual
            </button>
            {MONTHS_OF_YEAR.map((ym, i) => (
              <button
                key={ym}
                onClick={() => setSelectedMonth(ym)}
                className={`px-2.5 py-1.5 font-medium transition-colors duration-150 border-l border-subtle whitespace-nowrap shrink-0 ${
                  selectedMonth === ym ? "bg-green text-white" : "bg-white text-secondary hover:bg-surface"
                }`}
              >
                {MONTH_LABELS[i]}
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

      {/* Monthly override hint */}
      {selectedMonth && (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue/5 border border-blue/15 rounded-lg text-[12px] text-blue/80">
          <span>Editing spend for <strong>{monthLabel}</strong>. Changes save as monthly overrides. Tap ↺ next to a category to reset it to your default average.</span>
        </div>
      )}

      {/* Routing table(s) */}
      <section>
        {/* Individual mode */}
        {viewMode === "individual" && (
          <div className="bg-white border border-subtle rounded-lg overflow-hidden">
            <TableHeaders />
            {CATEGORIES.map((cat) => {
              const hasMonthlyOverride = selectedMonth
                ? activeMonthlySpend[cat.id]?.[selectedMonth] !== undefined
                : false;
              return (
                <SpendRow
                  key={`${activePersonId}-${cat.id}-${selectedMonth ?? "annual"}`}
                  categoryId={cat.id}
                  spend={activeSpend[cat.id] ?? 0}
                  routingRow={routingMap[cat.id]}
                  walletCards={walletCards}
                  overrides={overrides}
                  onSpendChange={handleSpendChange}
                  onOverrideChange={handleOverrideChange}
                  defaultAmount={selectedMonth ? (activeDefaultSpend[cat.id] ?? 0) : undefined}
                  isMonthlyOverride={hasMonthlyOverride}
                  onClearOverride={hasMonthlyOverride && selectedMonth
                    ? () => clearMonthlySpend(activePersonId, cat.id, selectedMonth)
                    : undefined}
                />
              );
            })}
            {/* Monthly totals footer */}
            {monthlyPoints > 0 && (
              <div className="grid grid-cols-[130px_1fr_170px_60px_100px] gap-2 px-3 py-2 bg-surface border-t border-subtle">
                <span className="text-[11px] font-semibold text-secondary">
                  {selectedMonth ? monthLabel : "Monthly avg"}
                </span>
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

        {/* Combined mode — pooled cards + summed spend */}
        {viewMode === "combined" && combinedData && (
          <div className="bg-white border border-subtle rounded-lg overflow-hidden">
            <div className="px-3 py-2 border-b border-subtle bg-[#0f1219] flex items-center justify-between">
              <span className="text-[12px] font-semibold text-white">
                Household Combined
              </span>
              <span className="text-[11px] text-white/40">
                {people.reduce((n, p) => n + p.cards.length, 0)} cards across {people.length} people
              </span>
            </div>
            <TableHeaders />
            {CATEGORIES.map((cat) => (
              <SpendRow
                key={`combined-${cat.id}`}
                categoryId={cat.id}
                spend={combinedData.combinedSpend[cat.id] ?? 0}
                routingRow={combinedData.routingMap[cat.id]}
                walletCards={combinedData.allCards}
                overrides={overrides}
                onSpendChange={() => {}} // read-only in combined mode
                onOverrideChange={() => {}}
              />
            ))}
            {combinedData.result.totalDollarValue > 0 && (
              <div className="grid grid-cols-[130px_1fr_170px_60px_100px] gap-2 px-3 py-2 bg-surface border-t border-subtle">
                <span className="text-[11px] font-semibold text-secondary">
                  {selectedMonth ? monthLabel : "Monthly avg"}
                </span>
                <div /><div /><div />
                <div className="text-right">
                  <div className="text-[12px] font-semibold text-primary tabular-nums">
                    {fmt(Math.round(combinedData.result.currencyTotals.reduce((s, ct) => s + ct.points, 0)))}
                  </div>
                  <div className="text-[10px] text-green font-medium tabular-nums">
                    {fmtDollar(combinedData.result.totalDollarValue)}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Compare mode — each person in their own table, side by side */}
        {viewMode === "compare" && (
          <div className="overflow-x-auto">
            <div className="flex gap-4" style={{ minWidth: `${people.length * 540}px` }}>
              {people.map((person) => (
                <div key={person.id} className="flex-1">
                  <PersonTable
                    personId={person.id}
                    personName={person.name}
                    valuationTier={valuationTier}
                    quarter={selectedMonth ? monthToQuarter(selectedMonth) : 1}
                    selectedMonth={selectedMonth}
                  />
                </div>
              ))}
            </div>
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
                const floorVal = currency ? (ct.points * currency.floor) / 10000 : ct.dollarValue;
                const ceilVal = currency ? (ct.points * currency.ceiling) / 10000 : ct.dollarValue;
                return (
                  <div key={ct.currencyId} className="flex items-center justify-between px-4 py-2.5">
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
