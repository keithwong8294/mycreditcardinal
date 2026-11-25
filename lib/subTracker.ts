/**
 * Sign-up bonus tracker: how far along a card's minimum spend is, and the
 * day the bonus should land at the spending set in the simulator.
 *
 * Spend is assumed to come in evenly across each calendar month. Monthly
 * amounts are given for Jan–Dec of the current year and repeat for later
 * years.
 */
import { CATEGORIES } from "@/lib/categories";
import { routeYear, type Valuation } from "@/lib/engine";
import type { RoutingResult, WalletCard } from "@/types";

const DAY = 86_400_000;
/** Give up projecting after this many months. */
const HORIZON_MONTHS = 36;

/** Local midnight of the given day. */
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Same day of the month, `n` months later (clamped to the month's last day). */
export function addMonths(d: Date, n: number): Date {
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(d.getDate(), last));
}

function daysInMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

/** "YYYY-MM-DD" in local time. */
export function toDateKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Parses "YYYY-MM-DD" as a local date; null when malformed. */
export function parseDateKey(key: string | undefined): Date | null {
  const m = key?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Dollars spent on the card from the start of `from` up to (not including)
 * `to`, at `monthly[calendar month]` spread evenly over each month.
 */
export function spendBetween(from: Date, to: Date, monthly: number[]): number {
  let total = 0;
  let cur = startOfDay(from);
  const end = startOfDay(to);
  while (cur < end) {
    const nextMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    const stop = nextMonth < end ? nextMonth : end;
    const days = Math.round((stop.getTime() - cur.getTime()) / DAY);
    total += ((monthly[cur.getMonth()] ?? 0) * days) / daysInMonth(cur);
    cur = stop;
  }
  return total;
}

/** The first day on which spend since `from` reaches `amount`, or null within the horizon. */
export function dateReaching(from: Date, amount: number, monthly: number[]): Date | null {
  let cur = startOfDay(from);
  let left = amount;
  if (left <= 0) return cur;
  const limit = addMonths(cur, HORIZON_MONTHS);
  while (cur < limit) {
    const perDay = (monthly[cur.getMonth()] ?? 0) / daysInMonth(cur);
    const nextMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    const days = Math.round((nextMonth.getTime() - cur.getTime()) / DAY);
    if (perDay > 0 && perDay * days >= left - 1e-9) {
      // Spend lands through the day, so the bonus is met on the day it's crossed.
      return new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + Math.ceil(left / perDay - 1e-9) - 1);
    }
    left -= perDay * days;
    cur = nextMonth;
  }
  return null;
}

export interface SubTrackInput {
  /** Minimum spend for the bonus. */
  requirement: number;
  /** Months after opening to hit it (0 = no deadline). */
  timeframeMonths: number;
  /** Day the account was opened. */
  opened: Date;
  /** Spend on the card for Jan–Dec. */
  monthly: number[];
  /** Spend so far, when the user entered it; estimated from `monthly` otherwise. */
  spentSoFar?: number | null;
  today?: Date;
}

export type SubStatus = "met" | "on_track" | "late" | "no_spend" | "expired";

export interface SubProjection {
  status: SubStatus;
  /** Last day to meet the spend, or null with no deadline. */
  deadline: Date | null;
  /** Spend so far (entered or estimated). */
  spent: number;
  spentIsEstimate: boolean;
  remaining: number;
  /** 0–1 */
  progress: number;
  /** Day the spend is projected to be met; null when it never is at this spending. */
  projected: Date | null;
  /** Whole days until the deadline (negative once passed). */
  daysLeft: number | null;
  /** Monthly spend needed from today to make the deadline. */
  neededPerMonth: number | null;
  /** Average monthly spend on the card over the rest of the window. */
  monthlyRate: number;
}

export function projectSub(input: SubTrackInput): SubProjection {
  const today = startOfDay(input.today ?? new Date());
  const opened = startOfDay(input.opened);
  const deadline = input.timeframeMonths > 0 ? addMonths(opened, input.timeframeMonths) : null;
  // Spend on or before the deadline counts; "in 3 months" runs through the day before the anniversary.
  if (deadline) deadline.setDate(deadline.getDate() - 1);

  const entered = input.spentSoFar != null && Number.isFinite(input.spentSoFar);
  const spent = Math.max(
    0,
    entered ? input.spentSoFar! : opened < today ? spendBetween(opened, today, input.monthly) : 0
  );
  const remaining = Math.max(0, input.requirement - spent);
  const progress = input.requirement > 0 ? Math.min(1, spent / input.requirement) : 1;
  const daysLeft = deadline ? Math.round((deadline.getTime() - today.getTime()) / DAY) : null;

  const windowEnd = deadline && deadline > today ? deadline : addMonths(today, 12);
  const windowDays = Math.max(1, Math.round((windowEnd.getTime() - today.getTime()) / DAY) + 1);
  const monthlyRate = (spendBetween(today, new Date(windowEnd.getTime() + DAY), input.monthly) * 30.4375) / windowDays;

  const neededPerMonth =
    deadline && daysLeft != null && daysLeft >= 0 && remaining > 0
      ? (remaining * 30.4375) / (daysLeft + 1)
      : null;

  const base = { deadline, spent, spentIsEstimate: !entered, remaining, progress, daysLeft, neededPerMonth, monthlyRate };

  if (remaining <= 0) {
    return { ...base, status: "met", projected: entered || opened >= today ? today : dateReaching(opened, input.requirement, input.monthly) };
  }
  if (deadline && today > deadline) return { ...base, status: "expired", projected: null };

  const projected = dateReaching(today, remaining, input.monthly);
  if (!projected) return { ...base, status: "no_spend", projected };
  return { ...base, status: !deadline || projected <= deadline ? "on_track" : "late", projected };
}

// ─── Spend routed to each card ─────────────────────────────────────────────────

/** Total dollars routed to each wallet card in each month of a routed year. */
export function spendByCard(months: RoutingResult[]): Map<string, number[]> {
  const out = new Map<string, number[]>();
  months.forEach((r, m) => {
    for (const row of r.rows) {
      const add = (id: string, amt: number) => {
        const arr = out.get(id) ?? Array<number>(12).fill(0);
        arr[m] += amt;
        out.set(id, arr);
      };
      add(row.walletCard.id, row.spend);
      for (const o of row.overflow) add(o.walletCard.id, o.spend);
    }
  });
  return out;
}

export interface SpendProfile {
  cards: WalletCard[];
  /** Typical monthly spend by category. */
  defaults: Record<string, number>;
  /** categoryId → "YYYY-MM" → one-off amount. */
  monthly: Record<string, Record<string, number>>;
}

/** Routes each profile's year (as the simulator does) and merges spend per card. */
export function yearSpendByCard(
  profiles: SpendProfile[],
  overrides: Record<string, string | null>,
  tier: Valuation,
  year: number
): Map<string, number[]> {
  const out = new Map<string, number[]>();
  for (const p of profiles) {
    if (!p.cards.length) continue;
    const spendFor = (m: number) => {
      const key = `${year}-${String(m + 1).padStart(2, "0")}`;
      const s: Record<string, number> = {};
      for (const cat of CATEGORIES) s[cat.id] = p.monthly[cat.id]?.[key] ?? p.defaults[cat.id] ?? cat.defaultAmount;
      return s;
    };
    for (const [id, arr] of spendByCard(routeYear(p.cards, spendFor, overrides, tier).months)) out.set(id, arr);
  }
  return out;
}
