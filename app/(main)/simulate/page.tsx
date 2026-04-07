"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { trackSpendUpdated } from "@/lib/analytics";
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
} from "@/components/ui/select";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ─── Constants ────────────────────────────────────────────────────────────────

const EMPTY_SPEND: Record<string, number> = {};

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const CURRENT_YEAR = 2026;

const MONTHS_OF_YEAR = MONTH_LABELS.map((_, i) => {
  const mm = String(i + 1).padStart(2, "0");
  return `${CURRENT_YEAR}-${mm}`;
});

function monthToQuarter(yearMonth: string): 1 | 2 | 3 | 4 {
  const month = parseInt(yearMonth.split("-")[1], 10);
  return (Math.ceil(month / 3)) as 1 | 2 | 3 | 4;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  sliderMax,
  selectedMonth,
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
  sliderMax?: number;
  selectedMonth?: string | null;
}) {
  const cat = CATEGORIES.find((c) => c.id === categoryId)!;
  const effectiveMax = sliderMax ?? cat.sliderMax;
  const [inputVal, setInputVal] = useState(String(Math.round(spend)));
  const inputRef = useRef<HTMLInputElement>(null);

  const prevSpend = useRef(spend);
  if (prevSpend.current !== spend) {
    prevSpend.current = spend;
    setInputVal(String(Math.round(spend)));
  }

  function commitInput() {
    const n = parseInt(inputVal.replace(/[^0-9]/g, ""), 10);
    const clamped = isNaN(n) ? 0 : Math.max(0, Math.min(n, effectiveMax));
    onSpendChange(categoryId, clamped);
    setInputVal(String(clamped));
    trackSpendUpdated(categoryId, clamped, selectedMonth ?? null);
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
            max={effectiveMax}
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

// ─── Profile block (self-contained per person) ──────────────────────────────

function ProfileBlock({
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
      <div className="px-3 py-2 border-b border-subtle bg-[#0f1219] flex items-center justify-between cursor-grab active:cursor-grabbing">
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
            selectedMonth={selectedMonth}
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

// ─── Sortable profile block wrapper ─────────────────────────────────────────

function SortableProfileBlock({
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
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: personId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex-1 min-w-0">
      {/* Drag handle layer over the header */}
      <div className="relative">
        <div {...attributes} {...listeners} className="absolute inset-x-0 top-0 h-[38px] z-10 cursor-grab active:cursor-grabbing" />
        <ProfileBlock
          personId={personId}
          personName={personName}
          valuationTier={valuationTier}
          quarter={quarter}
          selectedMonth={selectedMonth}
        />
      </div>
    </div>
  );
}

// ─── Add person placeholder ─────────────────────────────────────────────────

function AddPersonPlaceholder() {
  const addPerson = useStore((s) => s.addPerson);
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function handleAdd() {
    const trimmed = name.trim();
    if (trimmed) {
      addPerson(trimmed);
      setName("");
      setIsAdding(false);
    }
  }

  return (
    <div className="flex-1 min-w-[520px] border-2 border-dashed border-subtle rounded-lg flex flex-col items-center justify-center py-16 gap-3">
      {isAdding ? (
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            autoFocus
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
              if (e.key === "Escape") { setIsAdding(false); setName(""); }
            }}
            placeholder="Name"
            className="px-3 py-1.5 text-[13px] border border-subtle rounded-lg bg-field focus:outline-none focus:border-medium w-36"
          />
          <button
            onClick={handleAdd}
            className="px-3 py-1.5 text-[12px] font-medium bg-[#059669] text-white rounded-lg hover:bg-[#059669]/90 transition-colors"
          >
            Add
          </button>
          <button
            onClick={() => { setIsAdding(false); setName(""); }}
            className="px-2 py-1.5 text-[12px] text-tertiary hover:text-secondary transition-colors"
          >
            Cancel
          </button>
        </div>
      ) : (
        <>
          <p className="text-[13px] text-tertiary">Add a person to compare</p>
          <button
            onClick={() => setIsAdding(true)}
            className="px-3 py-1.5 text-[12px] font-medium bg-[#059669] text-white rounded-lg hover:bg-[#059669]/90 transition-colors"
          >
            + Add
          </button>
        </>
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
  const allSpend = useStore((s) => s.spend);
  const allMonthlySpend = useStore((s) => s.monthlySpend);
  const overrides = useStore((s) => s.overrides);
  const subEarned = useStore((s) => s.subEarned);
  const resetMonthForPerson = useStore((s) => s.resetMonthForPerson);
  const storeValuationTier = useStore((s) => s.valuationTier);
  const setValuation = useStore((s) => s.setValuation);
  const reorderPeople = useStore((s) => s.reorderPeople);

  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  const valuationTier: ValuationTier = storeValuationTier;

  // Derive quarter from selected month
  const viewQuarter: 1 | 2 | 3 | 4 = selectedMonth ? monthToQuarter(selectedMonth) : 1;

  // True if the selected month has at least one spend override for any person
  const selectedMonthHasOverrides = selectedMonth
    ? people.some((p) =>
        Object.values(allMonthlySpend[p.id] ?? {}).some((catMap) => selectedMonth in catMap)
      )
    : false;

  // ── DnD sensors ─────────────────────────────────────────────────────────────

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = people.findIndex((p) => p.id === active.id);
    const newIndex = people.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(people.map((p) => p.id), oldIndex, newIndex);
    reorderPeople(reordered);
  }

  // ── Household-level aggregation ─────────────────────────────────────────────

  const householdStats = useMemo(() => {
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
        personAnnual = {
          totalDollarValue: mr.totalDollarValue * 12,
          currencyTotals: mr.currencyTotals.map(ct => ({
            ...ct,
            points: ct.points * 12,
            dollarValue: ct.dollarValue * 12,
          })),
        };
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
        personAnnual = {
          totalDollarValue: tv,
          currencyTotals: Object.entries(cmap).map(([c, v]) => ({ currencyId: c, ...v })),
        };
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
  }, [people, overrides, valuationTier, subEarned, selectedMonth, allSpend, allMonthlySpend]);

  // ── Household monthly totals (for the bottom summary bar) ─────────────────

  const householdMonthlyTotals = useMemo(() => {
    let totalPoints = 0;
    let totalValue = 0;

    for (const person of people) {
      const cards = person.cards;
      const personDefaults = allSpend[person.id] ?? EMPTY_SPEND;
      const personMonthly = allMonthlySpend[person.id] ?? {};
      const monthSpend: Record<string, number> = {};
      for (const cat of CATEGORIES) {
        if (selectedMonth) {
          const ov = personMonthly[cat.id]?.[selectedMonth];
          monthSpend[cat.id] = ov !== undefined ? ov : (personDefaults[cat.id] ?? cat.defaultAmount);
        } else {
          monthSpend[cat.id] = personDefaults[cat.id] ?? cat.defaultAmount;
        }
      }
      const q = selectedMonth ? monthToQuarter(selectedMonth) : viewQuarter;
      const mr = routeMonth(cards, monthSpend, overrides, q, valuationTier);
      totalPoints += mr.currencyTotals.reduce((s, ct) => s + ct.points, 0);
      totalValue += mr.totalDollarValue;
    }

    return { totalPoints, totalValue };
  }, [people, allSpend, allMonthlySpend, overrides, valuationTier, selectedMonth, viewQuarter]);

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

  const displayStats = householdStats;
  const totalCards = people.reduce((n, p) => n + p.cards.length, 0);

  return (
    <div className="p-6 space-y-6">
      {/* ── Global controls ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-[14px] font-semibold text-secondary uppercase tracking-wider">
          Spend Simulator
        </h1>

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

          {/* Reset month overrides */}
          {selectedMonth && selectedMonthHasOverrides && (
            <button
              onClick={() => people.forEach((p) => resetMonthForPerson(p.id, selectedMonth))}
              className="px-2.5 py-1.5 text-[11px] font-medium text-red-500 hover:text-red-600 border border-red-200 hover:border-red-300 rounded-lg transition-colors duration-150 whitespace-nowrap"
              title="Reset all spend for this month to your annual averages"
            >
              ↺ Reset {MONTH_LABELS[MONTHS_OF_YEAR.indexOf(selectedMonth)]}
            </button>
          )}

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

          {/* Quarter selector */}
          {!selectedMonth && (
            <div className="flex rounded-lg border border-subtle overflow-hidden">
              {([1, 2, 3, 4] as const).map((q) => (
                <button
                  key={q}
                  onClick={() => {
                    // Set a month in that quarter so viewQuarter updates
                    const monthIdx = (q - 1) * 3; // 0,3,6,9
                    setSelectedMonth(null); // stay on annual — quarter only used for rotating cards when annual
                  }}
                  className={`px-2.5 py-1.5 text-[12px] font-medium transition-colors duration-150 ${
                    viewQuarter === q && !selectedMonth
                      ? "bg-[#0f1219] text-white"
                      : "bg-white text-secondary hover:bg-surface"
                  }`}
                  disabled
                  title="Quarter is auto-derived from selected month"
                >
                  Q{q}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Monthly override hint */}
      {selectedMonth && (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue/5 border border-blue/15 rounded-lg text-[12px] text-blue/80">
          <span>Editing spend for <strong>{monthLabel}</strong>. Changes save as monthly overrides. Tap ↺ next to a category to reset it to your default average.</span>
        </div>
      )}

      {/* ── Profile blocks (drag-and-drop) ─────────────────────────────────── */}
      <section>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={people.map((p) => p.id)}
            strategy={horizontalListSortingStrategy}
          >
            <div className="flex flex-col md:flex-row gap-4 overflow-x-auto">
              {people.map((person) => (
                <SortableProfileBlock
                  key={person.id}
                  personId={person.id}
                  personName={person.name}
                  valuationTier={valuationTier}
                  quarter={selectedMonth ? monthToQuarter(selectedMonth) : viewQuarter}
                  selectedMonth={selectedMonth}
                />
              ))}
              {people.length === 1 && <AddPersonPlaceholder />}
            </div>
          </SortableContext>
        </DndContext>
      </section>

      {/* ── Household Total bar ────────────────────────────────────────────── */}
      {people.length > 1 && householdMonthlyTotals.totalPoints > 0 && (
        <div className="bg-[#0f1219] rounded-lg px-4 py-3 flex items-center justify-between">
          <span className="text-[13px] font-semibold text-white">Household Total</span>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Monthly pts</div>
              <div className="text-[14px] font-semibold text-white tabular-nums">
                {fmt(Math.round(householdMonthlyTotals.totalPoints))}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Monthly value</div>
              <div className="text-[14px] font-semibold text-[#34d399] tabular-nums">
                {fmtDollar(householdMonthlyTotals.totalValue)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Annual fees</div>
              <div className="text-[14px] font-semibold text-white tabular-nums">
                {fmtDollar(displayStats.totalNetFees)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Annual net</div>
              <div className={`text-[14px] font-semibold tabular-nums ${displayStats.netTotal >= 0 ? "text-[#34d399]" : "text-red-400"}`}>
                {fmtDollar(displayStats.netTotal)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Annual summary metrics ─────────────────────────────────────────── */}
      <section>
        <h2 className="text-[14px] font-semibold text-secondary uppercase tracking-wider mb-3">
          {people.length > 1 ? "Household Annual Summary" : "Annual Summary"}
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
                : `${totalCards} card${totalCards !== 1 ? "s" : ""} total`
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

      {/* ── Currency breakdown ──────────────────────────────────────────────── */}
      {displayStats.currencyTotals.length > 0 && (
        <section>
          <h2 className="text-[14px] font-semibold text-secondary uppercase tracking-wider mb-3">
            {people.length > 1 ? "Household Currency Breakdown" : "Annual Currency Breakdown"}
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
