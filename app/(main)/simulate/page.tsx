"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import { trackSpendUpdated } from "@/lib/analytics";
import { useStore, HOUSEHOLD_ID } from "@/lib/store";
import { CATEGORIES } from "@/lib/categories";
import { CURRENCY_MAP } from "@/lib/currencies";
import {
  routeYear,
  calculateFees,
  calculateSubValue,
  rotatingCategories,
  capPeriodLabel,
} from "@/lib/engine";
import type { CapStatus } from "@/lib/engine";
import type { RoutingResult, RoutingRow, WalletCard } from "@/types";
import { PageHeader } from "@/components/PageHeader";
import { AverageSpendPreset } from "@/components/AverageSpendPreset";
import { SubTrackerList } from "@/components/SubTracker";
import { spendByCard } from "@/lib/subTracker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

// ─── Calendar ─────────────────────────────────────────────────────────────────

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const QUARTER_SPANS = ["Jan–Mar", "Apr–Jun", "Jul–Sep", "Oct–Dec"];

/** "YYYY-MM" keys for every month of the given year. */
function monthsOf(year: number): string[] {
  return MONTH_LABELS.map((_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
}

function monthToQuarter(yearMonth: string): 1 | 2 | 3 | 4 {
  const month = parseInt(yearMonth.split("-")[1], 10);
  return Math.ceil(month / 3) as 1 | 2 | 3 | 4;
}

const EMPTY_SPEND: Record<string, number> = {};
const EMPTY_MONTHLY: Record<string, Record<string, number>> = {};

/** Default spend with this month's overrides applied. */
function resolveSpend(
  defaults: Record<string, number>,
  monthly: Record<string, Record<string, number>>,
  yearMonth: string | null
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const cat of CATEGORIES) {
    const ov = yearMonth ? monthly[cat.id]?.[yearMonth] : undefined;
    out[cat.id] = ov !== undefined ? ov : (defaults[cat.id] ?? cat.defaultAmount);
  }
  return out;
}

// ─── Formatting ───────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return Math.round(n).toLocaleString();
}
function fmtDollar(n: number): string {
  const r = Math.round(n);
  return `${r < 0 ? "-" : ""}$${Math.abs(r).toLocaleString()}`;
}
/** "Sapphire Preferred or Savor" when other cards earn the same rate. */
function cardNames(wc: WalletCard, alsoEarn?: WalletCard[]): string {
  return [wc, ...(alsoEarn ?? [])].map((c) => c.card.name).join(" or ");
}
function catLabel(id: string): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

// ─── Segmented control ────────────────────────────────────────────────────────

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: React.ReactNode;
  options: { value: T; label: React.ReactNode; title?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  // On a narrow screen the strip scrolls; keep the chosen option in view.
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = strip.current;
    const btn = el?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (el && btn && el.scrollWidth > el.clientWidth) {
      el.scrollLeft = btn.offsetLeft - (el.clientWidth - btn.offsetWidth) / 2;
    }
  }, [value]);
  return (
    <div className="min-w-0 max-w-full">
      <div className="text-[12px] font-medium text-tertiary mb-1">{label}</div>
      <div ref={strip} className="relative flex rounded-lg border border-subtle overflow-x-auto text-[13px] bg-white max-w-full">
        {options.map((o, i) => (
          <button
            key={o.value}
            type="button"
            title={o.title}
            aria-pressed={o.value === value}
            onClick={() => onChange(o.value)}
            className={`px-3 py-1.5 font-medium whitespace-nowrap shrink-0 transition-colors duration-150 ${
              i > 0 ? "border-l border-subtle" : ""
            } ${o.value === value ? "bg-ink text-paper" : "text-secondary hover:bg-surface"}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Spend row ────────────────────────────────────────────────────────────────

// Desktop: one line. Phone: category + value, then the slider, then card + rate.
const ROW_GRID =
  "grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[150px_minmax(0,1fr)_minmax(0,230px)_52px_92px] items-center gap-x-3 gap-y-2";

function SpendRow({
  categoryId,
  spend,
  routingRow,
  walletCards,
  overrideId,
  onSpendChange,
  onOverrideChange,
  defaultAmount,
  isMonthlyOverride,
  onClearOverride,
  selectedMonth,
}: {
  categoryId: string;
  spend: number;
  routingRow?: RoutingRow;
  walletCards: WalletCard[];
  overrideId: string | null;
  onSpendChange: (catId: string, val: number) => void;
  onOverrideChange: (catId: string, walletCardId: string | null) => void;
  defaultAmount?: number;
  isMonthlyOverride?: boolean;
  onClearOverride?: () => void;
  selectedMonth: string | null;
}) {
  const cat = CATEGORIES.find((c) => c.id === categoryId)!;
  const [inputVal, setInputVal] = useState(String(Math.round(spend)));
  const inputRef = useRef<HTMLInputElement>(null);

  // Re-sync the text box when spend changes externally.
  const [prevSpend, setPrevSpend] = useState(spend);
  if (prevSpend !== spend) {
    setPrevSpend(spend);
    setInputVal(String(Math.round(spend)));
  }

  function commitInput() {
    const n = parseInt(inputVal.replace(/[^0-9]/g, ""), 10);
    const clamped = isNaN(n) ? 0 : Math.max(0, Math.min(n, 100000));
    onSpendChange(categoryId, clamped);
    setInputVal(String(clamped));
    trackSpendUpdated(categoryId, clamped, selectedMonth);
  }

  const active = routingRow && spend > 0;
  const autoLabel = routingRow ? `Auto: ${cardNames(routingRow.walletCard, routingRow.alsoEarn)} ${routingRow.earnRate}x` : "";

  return (
    <div className="border-b border-subtle last:border-b-0 px-3 py-2.5">
      <div className={ROW_GRID}>
        {/* Category */}
        <div className="order-1 flex items-center gap-1 min-w-0">
          <span className="text-[13px] text-primary font-medium truncate">{cat.label}</span>
          {isMonthlyOverride && onClearOverride && (
            <button
              onClick={onClearOverride}
              title="Reset to your typical month"
              className="shrink-0 text-[12px] text-blue hover:text-blue/70 leading-none"
            >
              ↺
            </button>
          )}
        </div>

        {/* Points + dollar value */}
        <div className="order-2 md:order-5 text-right">
          {active ? (
            <>
              <div className="text-[13px] font-medium text-primary tabular-nums">{fmt(routingRow.points + routingRow.overflow.reduce((s, o) => s + o.points, 0))}</div>
              <div className="text-[11px] text-tertiary tabular-nums">
                {fmtDollar(routingRow.dollarValue + routingRow.overflow.reduce((s, o) => s + o.dollarValue, 0))}
              </div>
            </>
          ) : (
            <span className="text-[12px] text-tertiary">—</span>
          )}
        </div>

        {/* Slider + amount */}
        <div className="order-3 md:order-2 col-span-2 md:col-span-1 flex items-center gap-2 min-w-0">
          <input
            type="range"
            min={0}
            max={Math.max(cat.sliderMax, Math.round(spend))}
            step={10}
            value={Math.round(spend)}
            aria-label={`${cat.label} monthly spend`}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              onSpendChange(categoryId, v);
              setInputVal(String(v));
            }}
            className="flex-1 min-w-0 cursor-pointer accent-[#b3261e]"
          />
          <div className="relative shrink-0">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[12px] text-tertiary pointer-events-none">$</span>
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              value={inputVal}
              aria-label={`${cat.label} amount`}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setInputVal(e.target.value)}
              onBlur={commitInput}
              onKeyDown={(e) => {
                if (e.key === "Enter") { commitInput(); inputRef.current?.blur(); }
              }}
              className={`w-20 pl-5 pr-2 py-1 border rounded-md text-[13px] text-primary text-right focus:outline-none focus:border-medium ${
                isMonthlyOverride ? "bg-blue/5 border-blue/30" : "bg-field border-subtle"
              }`}
            />
          </div>
          {isMonthlyOverride && defaultAmount !== undefined && (
            <span className="text-[11px] text-blue/60 shrink-0 tabular-nums hidden lg:inline">
              usually ${defaultAmount}
            </span>
          )}
        </div>

        {/* Card */}
        <div className="order-4 md:order-3 min-w-0">
          {walletCards.length > 0 && routingRow ? (
            <Select
              value={overrideId ?? "__auto__"}
              onValueChange={(v) => onOverrideChange(categoryId, v === "__auto__" ? null : v)}
            >
              <SelectTrigger className="h-auto data-[size=default]:h-auto min-h-7 py-1 text-[12px] w-full px-2 whitespace-normal">
                <span className="line-clamp-2 flex-1 text-left leading-snug" title={overrideId ? undefined : autoLabel}>
                  {overrideId
                    ? (walletCards.find((wc) => wc.id === overrideId)?.card.name ?? "Card")
                    : autoLabel}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__auto__">{autoLabel}</SelectItem>
                {walletCards.map((wc) => (
                  <SelectItem key={wc.id} value={wc.id}>
                    {wc.card.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-[12px] text-tertiary">—</span>
          )}
        </div>

        {/* Rate */}
        <div className="order-5 md:order-4 text-right">
          {active ? (
            <span
              className={`text-[13px] font-medium tabular-nums ${
                routingRow.earnRate >= 3 ? "text-green" : routingRow.earnRate >= 2 ? "text-primary" : "text-tertiary"
              }`}
            >
              {routingRow.earnRate}x
              {routingRow.capHit && <span className="ml-1 text-amber text-[11px]" title="Bonus cap reached: the rest earns a lower rate (see below)">⚠</span>}
            </span>
          ) : (
            <span className="text-[12px] text-tertiary">—</span>
          )}
        </div>
      </div>

      {/* Spend past a bonus cap */}
      {active &&
        routingRow.overflow.map((ov, i) => (
          <div key={i} className="mt-1 text-[12px] text-secondary md:pl-[162px]">
            ↳ {fmtDollar(ov.spend)} past the cap earns {ov.earnRate}x on{" "}
            <span className="font-medium text-primary">{cardNames(ov.walletCard, ov.alsoEarn)}</span>
            <span className="text-tertiary"> ({fmt(ov.points)} pts, {fmtDollar(ov.dollarValue)})</span>
          </div>
        ))}
    </div>
  );
}

// ─── Bonus caps ───────────────────────────────────────────────────────────────

function CapMeter({ cap, monthLabel }: { cap: CapStatus; monthLabel: string }) {
  const pct = Math.min(100, (cap.used / cap.limit) * 100);
  const full = cap.used >= cap.limit - 0.5;
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-3 text-[12px]">
        <span className="text-primary truncate">
          <span className="font-medium">{cap.cardName}</span>
          <span className="text-secondary"> · {cap.label}</span>
        </span>
        <span className={`shrink-0 tabular-nums ${full ? "text-red font-medium" : "text-secondary"}`}>
          {full ? "Cap reached" : `${fmtDollar(cap.limit - cap.used)} left`}
        </span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-surface overflow-hidden">
        <div className={`h-full rounded-full ${full ? "bg-red" : "bg-green"}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-0.5 text-[11px] text-tertiary tabular-nums">
        {fmtDollar(cap.used)} of {fmtDollar(cap.limit)} used {capPeriodLabel(cap.period, cap.periodStart)}, through {monthLabel}
      </div>
    </div>
  );
}

// ─── Spend table (one person, or the merged household) ───────────────────────

function SpendTable({
  spendKey,
  title,
  walletCards,
  result,
  selectedMonth,
  monthLabel,
  editMonthOnly,
}: {
  spendKey: string;
  title: string;
  walletCards: WalletCard[];
  /** This month's routing, with caps carried over from earlier months. */
  result: RoutingResult;
  selectedMonth: string;
  monthLabel: string;
  /** Edits change only this month instead of every month. */
  editMonthOnly: boolean;
}) {
  const overrides = useStore((s) => s.overrides);
  const defaults = useStore((s) => s.spend[spendKey] ?? EMPTY_SPEND);
  const monthly = useStore((s) => s.monthlySpend[spendKey] ?? EMPTY_MONTHLY);
  const setSpend = useStore((s) => s.setSpend);
  const setMonthlySpend = useStore((s) => s.setMonthlySpend);
  const clearMonthlySpend = useStore((s) => s.clearMonthlySpend);
  const setOverride = useStore((s) => s.setOverride);

  const spend = useMemo(() => resolveSpend(defaults, monthly, selectedMonth), [defaults, monthly, selectedMonth]);
  const routingMap = useMemo(() => Object.fromEntries(result.rows.map((r) => [r.categoryId, r])), [result.rows]);
  const monthlySpendTotal = Object.values(spend).reduce((s, v) => s + v, 0);
  const monthlyPoints = result.currencyTotals.reduce((s, ct) => s + ct.points, 0);
  const caps = result.caps ?? [];

  function handleSpendChange(catId: string, val: number) {
    if (!editMonthOnly) {
      // Typical spend changes every month; drop this month's override so the
      // number typed is the number shown.
      if (monthly[catId]?.[selectedMonth] !== undefined) clearMonthlySpend(spendKey, catId, selectedMonth);
      return setSpend(spendKey, catId, val);
    }
    const def = defaults[catId] ?? CATEGORIES.find((c) => c.id === catId)?.defaultAmount ?? 0;
    if (val === def) clearMonthlySpend(spendKey, catId, selectedMonth);
    else setMonthlySpend(spendKey, catId, selectedMonth, val);
  }

  return (
    <div className="bg-white border border-subtle rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-subtle flex items-center justify-between gap-3">
        <span className="text-[16px] font-semibold text-ink truncate">{title}</span>
        <span className="text-[13px] text-secondary shrink-0">
          {walletCards.length} card{walletCards.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className={`hidden md:grid ${ROW_GRID} px-3 py-2 bg-surface border-b border-subtle text-[12px] text-tertiary font-medium`}>
        <span>Category</span>
        <span>Spend in {monthLabel}</span>
        <span>Card</span>
        <span className="text-right">Rate</span>
        <span className="text-right">Pts / Value</span>
      </div>
      {CATEGORIES.map((cat) => {
        const isOverride = monthly[cat.id]?.[selectedMonth] !== undefined;
        return (
          <SpendRow
            key={`${spendKey}-${cat.id}-${selectedMonth}`}
            categoryId={cat.id}
            spend={spend[cat.id] ?? 0}
            routingRow={routingMap[cat.id]}
            walletCards={walletCards}
            overrideId={overrides[cat.id] ?? null}
            onSpendChange={handleSpendChange}
            onOverrideChange={setOverride}
            defaultAmount={defaults[cat.id] ?? 0}
            isMonthlyOverride={isOverride}
            onClearOverride={isOverride ? () => clearMonthlySpend(spendKey, cat.id, selectedMonth) : undefined}
            selectedMonth={selectedMonth}
          />
        );
      })}
      {caps.length > 0 && (
        <div className="px-4 py-3 border-t border-subtle space-y-3">
          <div className="text-[12px] font-medium text-tertiary">Bonus caps</div>
          <div className="grid gap-3 md:grid-cols-2">
            {caps.map((c) => (
              <CapMeter key={`${c.walletCardId}-${c.bucket}`} cap={c} monthLabel={monthLabel} />
            ))}
          </div>
        </div>
      )}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-surface border-t border-subtle">
        <span className="text-[13px] font-semibold text-secondary">
          {fmtDollar(monthlySpendTotal)} spent in {monthLabel}
        </span>
        <div className="text-right">
          <span className="text-[13px] font-semibold text-primary tabular-nums">{fmt(monthlyPoints)} pts</span>
          <span className="ml-2 text-[13px] text-green font-semibold tabular-nums">{fmtDollar(result.totalDollarValue)}</span>
        </div>
      </div>
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
  const valueClass = accent === "green" ? "text-green" : accent === "red" ? "text-red" : "text-primary";
  return (
    <div className="bg-white border border-subtle rounded-xl p-4">
      <div className="text-[14px] text-secondary mb-1">{label}</div>
      <div className={`font-mono text-[24px] tracking-tight tabular-nums ${valueClass}`}>{value}</div>
      {sub && <div className="text-[12px] text-tertiary mt-0.5">{sub}</div>}
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
  const spendMode = useStore((s) => s.spendMode);
  const setSpendMode = useStore((s) => s.setSpendMode);
  const resetMonthForPerson = useStore((s) => s.resetMonthForPerson);
  const valuationTier = useStore((s) => s.valuationTier);
  const setValuation = useStore((s) => s.setValuation);

  // The calendar is always the real one: this year, opening on this month.
  const [today] = useState(() => new Date());
  const year = today.getFullYear();
  const months = useMemo(() => monthsOf(year), [year]);
  const [monthIdx, setMonthIdx] = useState(() => today.getMonth());
  const [editMonthOnly, setEditMonthOnly] = useState(false);
  const selectedMonth = months[monthIdx];
  const quarter = monthToQuarter(selectedMonth);

  const merged = spendMode === "household" && people.length > 1;
  const allCards = useMemo(() => people.flatMap((p) => p.cards), [people]);

  /** Who gets a spend table: each person, or one merged household. */
  const profiles = useMemo(
    () =>
      merged
        ? [{ key: HOUSEHOLD_ID, title: "Household (combined)", cards: allCards }]
        : people.map((p) => ({ key: p.id, title: p.name, cards: p.cards })),
    [merged, allCards, people]
  );

  // ── The year, month by month, with bonus caps carried across months ───────
  const years = useMemo(
    () =>
      profiles.map((prof) => {
        const defaults = allSpend[prof.key] ?? EMPTY_SPEND;
        const monthly = allMonthlySpend[prof.key] ?? EMPTY_MONTHLY;
        return routeYear(prof.cards, (m) => resolveSpend(defaults, monthly, months[m]), overrides, valuationTier);
      }),
    [profiles, allSpend, allMonthlySpend, overrides, valuationTier, months]
  );

  const stats = useMemo(() => {
    let earn = 0;
    const currencies: Record<string, { points: number; dollarValue: number }> = {};
    for (const y of years) {
      earn += y.total.totalDollarValue;
      for (const ct of y.total.currencyTotals) {
        const c = (currencies[ct.currencyId] ??= { points: 0, dollarValue: 0 });
        c.points += ct.points;
        c.dollarValue += ct.dollarValue;
      }
    }
    const fees = calculateFees(allCards);
    const subs = calculateSubValue(allCards, new Set(subEarned), valuationTier);
    return {
      earn,
      fees,
      subs,
      net: earn + subs - fees.netFees,
      currencyTotals: Object.entries(currencies)
        .map(([currencyId, v]) => ({ currencyId, ...v }))
        .sort((a, b) => b.dollarValue - a.dollarValue),
    };
  }, [years, valuationTier, subEarned, allCards]);

  // ── Spend routed to each card, for the sign-up bonus tracker ──────────────
  const cardSpend = useMemo(() => {
    const out = new Map<string, number[]>();
    for (const y of years) for (const [id, arr] of spendByCard(y.months)) out.set(id, arr);
    return out;
  }, [years]);
  const subsInProgress = allCards.some((wc) => wc.card.sub_json && !subEarned.includes(wc.id));

  // ── Rotating 5% categories in effect for the month shown ───────────────────
  const rotating = useMemo(() => {
    const seen = new Set<string>();
    const out: { name: string; cats: string[] }[] = [];
    for (const wc of allCards) {
      if (!wc.card.rotating || seen.has(wc.card.id)) continue;
      seen.add(wc.card.id);
      out.push({ name: wc.card.name, cats: rotatingCategories(wc.card, wc.config, quarter) });
    }
    return out;
  }, [allCards, quarter]);

  if (allCards.length === 0) {
    return (
      <div className="p-6">
        <div className="bg-white border border-subtle rounded-lg py-16 text-center">
          <p className="text-[14px] text-tertiary mb-2">No cards in wallet yet.</p>
          <a href="/browse" className="text-[14px] text-green font-medium hover:underline">
            Add cards to your wallet →
          </a>
        </div>
      </div>
    );
  }

  const monthLabel = MONTH_LABELS[monthIdx];
  const selectedHasOverrides = profiles.some((p) =>
    Object.values(allMonthlySpend[p.key] ?? {}).some((m) => selectedMonth in m)
  );

  return (
    <div className="px-4 sm:px-8 lg:px-10 pt-6 sm:pt-8 pb-14 mx-auto max-w-[1100px] space-y-6">
      <PageHeader
        title="Simulator"
        subtitle="Set what you spend. Every category goes to the card that earns you the most."
      />

      {/* ── Controls ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        {people.length > 1 && (
          <Segmented
            label="Count spending"
            value={merged ? "household" : "individual"}
            onChange={setSpendMode}
            options={[
              { value: "individual", label: "Per person", title: "Each person has their own spending and cards" },
              { value: "household", label: "As one household", title: "One combined budget that can use every card in the household" },
            ]}
          />
        )}
        <Segmented
          label={`Month (${year})`}
          value={String(monthIdx)}
          onChange={(v) => setMonthIdx(Number(v))}
          options={MONTH_LABELS.map((m, i) => ({
            value: String(i),
            label: i === today.getMonth() ? <span className="underline underline-offset-4 decoration-cardinal">{m}</span> : m,
            title: i === today.getMonth() ? "This month" : undefined,
          }))}
        />
        <Segmented
          label="Edits change"
          value={editMonthOnly ? "month" : "every"}
          onChange={(v) => setEditMonthOnly(v === "month")}
          options={[
            { value: "every", label: "Every month", title: "Your typical spending, used for every month" },
            { value: "month", label: `Only ${monthLabel}`, title: "A one-off amount for this month" },
          ]}
        />
        <Segmented
          label={
            <>
              Point values{" "}
              <a href="/point-values" className="underline underline-offset-2 hover:text-primary">
                (how?)
              </a>
            </>
          }
          value={valuationTier}
          onChange={setValuation}
          options={[
            { value: "floor", label: "Cash-out", title: "Redeemed for cash or statement credit: about 1¢ a point" },
            { value: "composite", label: "MCC", title: "Average of published valuations (TPG, NerdWallet, Bankrate and others) for transferring points to travel partners" },
            { value: "ceiling", label: "Best case", title: "A strong travel redemption, such as a premium-cabin flight" },
          ]}
        />
        {selectedHasOverrides && (
          <button
            onClick={() => profiles.forEach((p) => resetMonthForPerson(p.key, selectedMonth))}
            className="px-3 py-1.5 text-[13px] font-medium text-red border border-red/30 hover:border-red/60 rounded-lg whitespace-nowrap"
          >
            ↺ Reset {monthLabel}
          </button>
        )}
        <AverageSpendPreset merged={merged} />
      </div>

      {/* ── Year summary ───────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-[20px] font-semibold text-ink mb-1">
          {people.length > 1 ? "Your household" : "Your wallet"} in {year}
        </h2>
        <p className="text-[13px] text-tertiary mb-3">
          All 12 months in order: each quarter&apos;s rotating categories, any month you&apos;ve changed, and bonus caps used up as the year goes.
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard label="Rewards" value={fmtDollar(stats.earn)} sub="Earned on spending" accent="green" />
          <MetricCard
            label="Annual fees"
            value={fmtDollar(stats.fees.netFees)}
            sub={
              stats.fees.estimatedCredits > 0
                ? `${fmtDollar(stats.fees.grossFees)} − ${fmtDollar(stats.fees.estimatedCredits)} credits`
                : `${allCards.length} card${allCards.length !== 1 ? "s" : ""}`
            }
            accent={stats.fees.netFees > 0 ? "red" : "green"}
          />
          <MetricCard label="Bonuses earned" value={fmtDollar(stats.subs)} sub="Sign-up bonuses" accent={stats.subs > 0 ? "green" : "default"} />
          <MetricCard label="Net value" value={fmtDollar(stats.net)} sub="Rewards + bonuses − fees" accent={stats.net >= 0 ? "green" : "red"} />
        </div>
      </section>

      {/* ── What the table shows ───────────────────────────────────────────── */}
      <div className="px-3 py-2.5 bg-white border border-subtle rounded-lg text-[13px] text-secondary space-y-1">
        <div>
          Showing <strong className="text-primary">{monthLabel} {year}</strong>, with bonus caps already used earlier in the period counted.{" "}
          {editMonthOnly
            ? <>Changes apply to {monthLabel} only; ↺ puts a category back to your typical amount.</>
            : <>Changes set your typical spending for every month.</>}
          {merged && " Spending is pooled, so any card in the household can be used."}
        </div>
        {rotating.length > 0 && (
          <div>
            Rotating 5% in Q{quarter} ({QUARTER_SPANS[quarter - 1]}):{" "}
            {rotating.map((r, i) => (
              <span key={r.name}>
                {i > 0 && " · "}
                <span className="font-medium text-primary">{r.name}</span>{" "}
                {r.cats.length ? r.cats.map(catLabel).join(", ") : "not announced yet"}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Spend tables ───────────────────────────────────────────────────── */}
      <section className="space-y-4">
        {profiles.map((p, i) => (
          <SpendTable
            key={p.key}
            spendKey={p.key}
            title={p.title}
            walletCards={p.cards}
            result={years[i].months[monthIdx]}
            selectedMonth={selectedMonth}
            monthLabel={monthLabel}
            editMonthOnly={editMonthOnly}
          />
        ))}
      </section>

      {/* ── Sign-up bonuses in progress ────────────────────────────────────── */}
      {subsInProgress && (
        <section>
          <h2 className="text-[20px] font-semibold text-ink mb-1">Sign-up bonuses in progress</h2>
          <p className="text-[13px] text-tertiary mb-3">
            When each bonus&apos;s minimum spend is met at the spending above. Set the open date, or enter what you&apos;ve spent so far.
          </p>
          <SubTrackerList cards={allCards} spend={cardSpend} />
        </section>
      )}

      {/* ── Where the points land ─────────────────────────────────────────── */}
      {stats.currencyTotals.length > 0 && (
        <section>
          <h2 className="text-[20px] font-semibold text-ink mb-3">Where the points land</h2>
          <div className="bg-white border border-subtle rounded-lg overflow-hidden divide-y divide-subtle">
            {stats.currencyTotals.map((ct) => {
              const currency = CURRENCY_MAP[ct.currencyId];
              const floorVal = currency ? (ct.points * currency.floor) / 10000 : ct.dollarValue;
              const ceilVal = currency ? (ct.points * currency.ceiling) / 10000 : ct.dollarValue;
              return (
                <div key={ct.currencyId} className="flex items-center justify-between px-4 py-2.5">
                  <div>
                    <div className="text-[14px] font-medium text-primary">{currency?.name ?? ct.currencyId}</div>
                    <div className="text-[12px] text-tertiary mt-0.5">{fmt(ct.points)} pts</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[14px] font-semibold text-primary tabular-nums">{fmtDollar(ct.dollarValue)}</div>
                    <div className="text-[12px] text-tertiary tabular-nums">
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
