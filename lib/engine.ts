import type {
  CapPeriod,
  WalletCard,
  Card,
  RoutingResult,
  RoutingRow,
  OverflowRow,
  CurrencyTotal,
  Recommendation,
  CategoryImprovement,
} from "@/types";
import { CURRENCY_MAP } from "./currencies";
import { CATEGORIES } from "./categories";

// ─── Valuation tier ───────────────────────────────────────────────────────────

export type ValuationTier = "floor" | "composite" | "ceiling";

/** Custom per-currency valuation (cents-per-point × 100), used by the optimizer. */
export type Valuation = ValuationTier | ((currencyId: string) => number);

/** Returns cents-per-point for a given currency at the given tier (e.g. 200 = 2.00¢). */
function getCpp(currencyId: string, tier: Valuation): number {
  if (typeof tier === "function") return tier(currencyId);
  const currency = CURRENCY_MAP[currencyId];
  if (!currency) return 100; // fallback: 1¢
  if (tier === "floor") return currency.floor;
  if (tier === "ceiling") return currency.ceiling;
  return currency.composite;
}

// ─── Rotating categories ──────────────────────────────────────────────────────

/** Calendar quarter (1-4) for a date; defaults to today. */
export function currentQuarter(date: Date = new Date()): 1 | 2 | 3 | 4 {
  return (Math.floor(date.getMonth() / 3) + 1) as 1 | 2 | 3 | 4;
}

/** Issuer-announced bonus categories for a quarter, or null if not announced. */
export function announcedRotation(
  card: Card,
  quarter: 1 | 2 | 3 | 4,
  year: number = new Date().getFullYear()
): string[] | null {
  const cats = card.rotation_schedule?.[String(year)]?.[`Q${quarter}`];
  return cats?.length ? cats : null;
}

/**
 * Categories earning the rotating 5x bonus in a quarter. The issuer's
 * announced schedule always wins (a quarter can have several categories,
 * e.g. groceries + dining); the user's pick only fills unannounced quarters.
 */
export function rotatingCategories(
  card: Card,
  config: WalletCard["config"],
  quarter: 1 | 2 | 3 | 4
): string[] {
  if (!card.rotating) return [];
  const announced = announcedRotation(card, quarter);
  if (announced) return announced;
  const pick = config.rotQ[quarter - 1];
  return pick ? [pick] : [];
}

// ─── Earn rate ────────────────────────────────────────────────────────────────

/**
 * Returns the effective earn rate (multiplier) for a card in a given category,
 * taking into account rotating quarterly bonus and custom-select picks.
 *
 * @param card       Card definition
 * @param categoryId Spending category ID
 * @param config     User-supplied config (rotQ selections, custom picks)
 * @param quarter    1-4; used to pick the rotating category for that quarter
 */
export function getEarnRate(
  card: Card,
  categoryId: string,
  config: WalletCard["config"],
  quarter: 1 | 2 | 3 | 4
): number {
  const baseRate = card.earn_json[categoryId] ?? 1;

  // Rotating quarterly cards (Freedom Flex, Discover it): the 5% quarter is a
  // 4% bonus added to whatever the card already earns there. Issuer terms
  // (Chase, Q4 2026): "you can earn both the 3% dining offer and the 5%
  // quarterly bonus ... the most you will earn on eligible dining purchases
  // during that quarter is 7% total". Discover's base is 1%, so 5% total.
  // The bonus part is capped per quarter (see bonusCap).
  if (rotatingCategories(card, config, quarter).includes(categoryId)) {
    return baseRate + ROTATING_BONUS;
  }

  // Custom-select cards (Citi Custom Cash, US Bank Cash+, BoA CCR)
  if (card.custom_select && card.custom_rate != null) {
    if (config.custom.includes(categoryId)) {
      return card.custom_rate;
    }
  }

  return baseRate;
}

// ─── Bonus caps ───────────────────────────────────────────────────────────────

/** Extra rate a rotating 5% quarter adds on top of the card's own category rate. */
export const ROTATING_BONUS = 4;

const PERIOD_LABEL_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** A card's spending cap on a bonus rate. */
export interface CapInfo {
  /** Spend sharing one cap: "rotating", "custom", "shared" or a category id. */
  bucket: string;
  /** Dollars of spend per period that earn the bonus. */
  limit: number;
  period: CapPeriod;
}

/** Where one cap stands (spend counted so far in its current period). */
export interface CapStatus {
  walletCardId: string;
  cardName: string;
  bucket: string;
  /** e.g. "5% quarterly categories (Groceries, Dining)" */
  label: string;
  period: CapPeriod;
  /** First month (0-11) of the period this status covers. */
  periodStart: number;
  limit: number;
  used: number;
}

/** Running cap usage, carried from one month to the next by routeYear. */
export interface CapLedger {
  /** Month being routed, 0 (Jan) … 11 (Dec). */
  month: number;
  caps: Record<string, CapStatus>;
}

export function newLedger(month = 0): CapLedger {
  return { month, caps: {} };
}

function periodStart(period: CapPeriod, month: number): number {
  if (period === "year") return 0;
  if (period === "quarter") return Math.floor(month / 3) * 3;
  return month;
}

function capKey(walletCardId: string, cap: CapInfo, month: number): string {
  return `${walletCardId}|${cap.bucket}|${periodStart(cap.period, month)}`;
}

/** "Oct–Dec", "this year", "Nov" for a cap period starting at `start`. */
export function capPeriodLabel(period: CapPeriod, start: number): string {
  if (period === "year") return "this year";
  if (period === "quarter") return `${PERIOD_LABEL_MONTHS[start]}–${PERIOD_LABEL_MONTHS[start + 2]}`;
  return PERIOD_LABEL_MONTHS[start];
}

/**
 * The cap on a card's bonus rate in a category, if any. Caps in the card
 * data are issuer caps for the card's `cap_period`; the rotating 5% cap is
 * always per quarter and shared by all of the quarter's categories.
 */
export function bonusCap(
  card: Card,
  categoryId: string,
  config: WalletCard["config"],
  quarter: 1 | 2 | 3 | 4,
  rate: number
): CapInfo | null {
  if (
    card.rotating &&
    card.rot_cap != null &&
    rate > (card.earn_json[categoryId] ?? 1) &&
    rotatingCategories(card, config, quarter).includes(categoryId)
  ) {
    return { bucket: "rotating", limit: card.rot_cap, period: "quarter" };
  }
  const period = card.cap_period ?? "month";
  if (card.custom_select && config.custom.includes(categoryId) && card.caps_json.custom != null) {
    return { bucket: card.cap_shared ? "shared" : "custom", limit: card.caps_json.custom, period };
  }
  if (card.caps_json[categoryId] != null) {
    return { bucket: card.cap_shared ? "shared" : categoryId, limit: card.caps_json[categoryId], period };
  }
  return null;
}

/**
 * What the card earns in a category once the cap is used up: its regular
 * category rate after a rotating or chosen-category bonus (Freedom Flex
 * dining drops from 7x to 3x), otherwise 1x.
 */
function rateAfterCap(card: Card, categoryId: string, cap: CapInfo): number {
  if (cap.bucket === "rotating" || cap.bucket === "custom") return card.earn_json[categoryId] ?? 1;
  return 1;
}

function capLabel(card: Card, cap: CapInfo, config: WalletCard["config"], quarter: 1 | 2 | 3 | 4): string {
  const names = (ids: string[]) => ids.map((id) => CATEGORIES.find((c) => c.id === id)?.label ?? id).join(", ");
  if (cap.bucket === "rotating") return `5% quarterly categories (${names(rotatingCategories(card, config, quarter))})`;
  if (cap.bucket === "custom") return `Chosen category (${names(config.custom)})`;
  if (cap.bucket === "shared") return "Bonus categories (shared cap)";
  return `${names([cap.bucket])} bonus`;
}

// ─── routeMonth ───────────────────────────────────────────────────────────────

/**
 * What the user wants from their next card. Drives how sign-up bonuses are
 * weighted, how points are valued, and which cards are eligible.
 */
export type CardGoal = "everyday" | "bonuses" | "cashback" | "travel" | "credit";
/** How much of a card's statement credits the user expects to actually use. */
export type CreditUsage = "none" | "some" | "all";
/** How the user plans to spend points. */
export type Redemption = "flexible" | "flights" | "hotels" | "cash";
/** Whether the user wants to stay with the rewards programs they already have. */
export type Ecosystem = "open" | "stay";

export interface OptimizerPreferences {
  maxFee: number | null;
  minCreditScore: number | null;
  preferredIssuers: string[];
  preferredCurrencies: string[];
  /** Goal for the next card. Default "everyday". */
  goal?: CardGoal;
  /** Has a business or side income and is willing to open a business card. Default false. */
  openToBusinessCards?: boolean;
  /** Share of statement credits counted as real value. Default "none". */
  creditUsage?: CreditUsage;
  /** How points will be redeemed; mismatched programs are valued at cash-out. Default "flexible". */
  redemption?: Redemption;
  /** "stay" values new programs' points at cash-out, favoring ones already in the wallet. Default "open". */
  ecosystem?: Ecosystem;
  /** Opened 5+ personal cards in the last 24 months (Chase 5/24 rule). Default false. */
  over524?: boolean;
  /**
   * A spend category the user specifically wants to earn more on (e.g. gas).
   * Only cards that raise it are shown, ranked by how much more it earns.
   */
  focusCategory?: string | null;
}

interface GoalRules {
  /** Share of the sign-up bonus counted in the ranking score. */
  bonusWeight: number;
  /** Allow cards that lose money every year after the bonus. */
  allowNegativeOngoing?: boolean;
  /** Value every currency at its cash-out floor. */
  cashValue: boolean;
  /** Extra eligibility filter for this goal. */
  allows?: (card: Card) => boolean;
  /** The card must raise what the user earns on their spending. */
  needsEarnGain?: boolean;
  /**
   * Statement credits only offset the card's own fee: they can make a fee
   * card worth holding, but don't make it better at earning on spending.
   */
  creditsOnlyOffsetFee?: boolean;
}

const CASH_CURRENCIES = new Set(["cash", "discover"]);

export const GOAL_RULES: Record<CardGoal, GoalRules> = {
  // Best long-run earning: ranked by what the card adds every year, the same
  // number the card shows; the welcome bonus is shown but doesn't set the order.
  // A card that doesn't lift any category's earnings doesn't fit this goal,
  // however big its credits or bonus.
  everyday: { bonusWeight: 0, cashValue: false, needsEarnGain: true, creditsOnlyOffsetFee: true },
  // Churning: the welcome bonus counts in full, even on cards you'd cancel later.
  bonuses: { bonusWeight: 1, cashValue: false, allowNegativeOngoing: true },
  // Simple cash back: points are worth what they cash out for; ranked by yearly value.
  cashback: { bonusWeight: 0, cashValue: true, needsEarnGain: true, creditsOnlyOffsetFee: true },
  // Travel: transferable points and co-brands only.
  travel: { bonusWeight: 0.5, cashValue: false, allows: (c) => !CASH_CURRENCIES.has(c.currency) },
  // Building credit: no annual fee, approachable approval odds, bonus ignored.
  credit: {
    bonusWeight: 0,
    cashValue: true,
    allows: (c) => c.fee === 0 && (c.fico_min == null || c.fico_min <= 670),
  },
};

export const DEFAULT_OPTIMIZER_PREFERENCES: OptimizerPreferences = {
  maxFee: null,
  minCreditScore: null,
  preferredIssuers: [],
  preferredCurrencies: [],
  goal: "everyday",
  openToBusinessCards: false,
  creditUsage: "none",
  redemption: "flexible",
  ecosystem: "open",
  over524: false,
  focusCategory: null,
};

type CurrencyKind = "transferable" | "airline" | "hotel" | "cash";

const CURRENCY_KIND: Record<string, CurrencyKind> = {
  chase_ur: "transferable",
  amex_mr: "transferable",
  cap1: "transferable",
  citi_typ: "transferable",
  bilt: "transferable",
  wf: "transferable",
  united: "airline",
  delta: "airline",
  hyatt: "hotel",
  marriott: "hotel",
  hilton: "hotel",
  cash: "cash",
  discover: "cash",
};

/**
 * Builds the per-currency valuation the optimizer ranks with. Points only get
 * their travel value when the user will actually redeem them that way:
 *  - cash-focused goals or redemptions value everything at cash-out (floor)
 *  - flyers get floor value for hotel points, hotel fans for airline miles
 *  - "stay in my ecosystem" values programs not already in the wallet at floor,
 *    since a lone card in a new program rarely builds a useful transfer balance
 *    (cards from new banks are also filtered out; see isInCurrentPrograms)
 */
export function rankingValuation(
  preferences: Partial<OptimizerPreferences>,
  walletCards: WalletCard[],
  tier: ValuationTier = "composite"
): Valuation {
  const prefs = { ...DEFAULT_OPTIMIZER_PREFERENCES, ...preferences };
  const rules = GOAL_RULES[prefs.goal ?? "everyday"] ?? GOAL_RULES.everyday;
  // Always a function, so the router picks cards with the same values the
  // ranking uses (a plain tier would route at MCC value).
  if (rules.cashValue || prefs.redemption === "cash") return (c: string) => getCpp(c, "floor");
  const owned = new Set(walletCards.map((wc) => wc.card.currency));
  return (currencyId: string) => {
    const kind = CURRENCY_KIND[currencyId] ?? "transferable";
    const floor = getCpp(currencyId, "floor");
    if (kind === "cash") return floor;
    if (prefs.redemption === "flights" && kind === "hotel") return floor;
    if (prefs.redemption === "hotels" && kind === "airline") return floor;
    if (prefs.ecosystem === "stay" && owned.size > 0 && !owned.has(currencyId)) return floor;
    return getCpp(currencyId, tier);
  };
}

/**
 * Routes one month of spending across wallet cards.
 *
 * Rules:
 * 1. Each category goes to the card whose earn is worth the most per dollar
 *    (earn rate × point value). Raw multipliers aren't comparable across
 *    programs: 2% cash back beats 1.5x Chase points only if a point is worth
 *    under 1.33¢. Plain tiers (floor / MCC / ceiling) all route at MCC value,
 *    so switching the tier changes the dollar figures but never the routing;
 *    a custom valuation (the optimizer's) routes at that valuation.
 * 2. Tiebreak: higher raw rate, then preferred currency, then higher MCC value.
 * 3. Bonus caps are real issuer caps (per month, quarter or year) and are
 *    drawn down by every month of the period in order: pass the same `ledger`
 *    to consecutive months (routeYear does this). Without a ledger the month
 *    is treated as the first month of its quarter, with every cap unused.
 * 4. Past a cap, the card keeps earning its regular rate there, and the spend
 *    goes to whichever card is then worth the most (often the same card).
 */
/**
 * The currency each wallet card's rewards end up in: a card with `pools_into`
 * earns that currency when the wallet holds a card that earns it natively.
 */
export function pooledCurrencies(walletCards: WalletCard[]): Map<string, string> {
  const native = new Set(walletCards.map((wc) => wc.card.currency));
  return new Map(
    walletCards.map((wc) => {
      const into = wc.card.pools_into;
      return [wc.id, into && native.has(into) ? into : wc.card.currency];
    })
  );
}

export function routeMonth(
  walletCards: WalletCard[],
  spend: Record<string, number>,
  overrides: Record<string, string | null>,
  quarter: 1 | 2 | 3 | 4,
  tier: Valuation = "composite",
  preferredCurrency?: string,
  ledger?: CapLedger
): RoutingResult {
  const month = ledger?.month ?? (quarter - 1) * 3;
  const book = ledger ?? newLedger(month);
  const routeTier: Valuation = typeof tier === "function" ? tier : "composite";

  const pooled = pooledCurrencies(walletCards);
  const cur = (wc: WalletCard) => pooled.get(wc.id) ?? wc.card.currency;

  type Candidate = { wc: WalletCard; rate: number; worth: number; cap: CapInfo | null };
  const plans: { cat: (typeof CATEGORIES)[number]; candidates: Candidate[]; overrideId: string | null; edge: number }[] = [];

  for (const cat of CATEGORIES) {
    // Candidates, most valuable per dollar first. A capped bonus keeps
    // earning on the same card after the cap at its regular rate, so that's
    // a candidate of its own.
    const candidates: Candidate[] = [];
    for (const wc of walletCards) {
      const cpp = getCpp(cur(wc), routeTier);
      const rate = getEarnRate(wc.card, cat.id, wc.config, quarter);
      const cap = bonusCap(wc.card, cat.id, wc.config, quarter, rate);
      candidates.push({ wc, rate, worth: rate * cpp, cap });
      if (cap) {
        const after = rateAfterCap(wc.card, cat.id, cap);
        if (after < rate) candidates.push({ wc, rate: after, worth: after * cpp, cap: null });
      }
    }
    candidates.sort((a, b) => {
      if (Math.abs(b.worth - a.worth) > 1e-9) return b.worth - a.worth;
      if (b.rate !== a.rate) return b.rate - a.rate;
      const aPref = preferredCurrency && cur(a.wc) === preferredCurrency ? 1 : 0;
      const bPref = preferredCurrency && cur(b.wc) === preferredCurrency ? 1 : 0;
      if (bPref !== aPref) return bPref - aPref;
      return getCpp(cur(b.wc), "composite") - getCpp(cur(a.wc), "composite");
    });

    // Manual override: the chosen card first (its bonus, then its after-cap rate)
    const overrideId = overrides[cat.id] ?? null;
    if (overrideId) {
      const mine = candidates.filter((c) => c.wc.id === overrideId);
      if (mine.length) {
        const rest = candidates.filter((c) => c.wc.id !== overrideId);
        candidates.splice(0, candidates.length, ...mine, ...rest);
      }
    }

    if (candidates.length === 0) continue;

    // How much the top (capped) choice beats the best uncapped fallback
    const top = candidates[0];
    const fallback = candidates.find((c) => c.cap == null)?.worth ?? 0;
    plans.push({ cat, candidates, overrideId, edge: top.cap ? top.worth - fallback : 0 });
  }

  // When categories share a cap (Freedom Flex's groceries + dining, a combined
  // $6,000 yearly cap…), give the cap to the categories that gain the most
  // from it first, not to whichever comes first in the list.
  const order = [...plans].sort((a, b) => b.edge - a.edge);
  const byCat: Record<string, RoutingRow> = {};

  for (const { cat, candidates, overrideId } of order) {
    let remaining = spend[cat.id] ?? 0;
    let primaryRow: RoutingRow | null = null;
    const overflowRows: OverflowRow[] = [];

    for (const { wc, rate, cap } of candidates) {
      if (remaining <= 0) break;

      let room = Infinity;
      let key = "";
      if (cap) {
        key = capKey(wc.id, cap, book.month);
        book.caps[key] ??= {
          walletCardId: wc.id,
          cardName: wc.card.name,
          bucket: cap.bucket,
          label: capLabel(wc.card, cap, wc.config, quarter),
          period: cap.period,
          periodStart: periodStart(cap.period, book.month),
          limit: cap.limit,
          used: 0,
        };
        room = Math.max(0, cap.limit - book.caps[key].used);
      }

      const allocated = Math.min(remaining, room);
      if (allocated <= 0) continue;

      const cpp = getCpp(cur(wc), tier);
      const points = allocated * rate;
      // cpp is stored as hundredths of a cent (200 = 2.00¢ = $0.02/pt)
      const dollarValue = (points * cpp) / 10000;
      if (cap) book.caps[key].used += allocated;

      if (primaryRow === null) {
        primaryRow = {
          categoryId: cat.id,
          walletCard: wc,
          earnRate: rate,
          spend: allocated,
          points,
          dollarValue,
          capHit: cap != null && remaining > room,
          overflow: overflowRows,
          override: overrideId,
        };
      } else {
        overflowRows.push({ walletCard: wc, earnRate: rate, spend: allocated, points, dollarValue });
      }
      remaining -= allocated;
    }

    if (primaryRow) byCat[cat.id] = primaryRow;
  }
  const rows = CATEGORIES.map((c) => byCat[c.id]).filter((r): r is RoutingRow => r != null);

  const currencyMap: Record<string, CurrencyTotal> = {};
  const add = (currencyId: string, pts: number, dv: number) => {
    const c = (currencyMap[currencyId] ??= { currencyId, points: 0, dollarValue: 0 });
    c.points += pts;
    c.dollarValue += dv;
  };
  for (const row of rows) {
    add(cur(row.walletCard), row.points, row.dollarValue);
    for (const ov of row.overflow) add(cur(ov.walletCard), ov.points, ov.dollarValue);
  }
  const currencyTotals = Object.values(currencyMap);
  const totalDollarValue = currencyTotals.reduce((sum, ct) => sum + ct.dollarValue, 0);

  // Caps whose period includes this month, as they stand at month end
  const caps = Object.values(book.caps)
    .filter((c) => periodStart(c.period, book.month) === c.periodStart)
    .map((c) => ({ ...c }));

  return { rows, currencyTotals, totalDollarValue, caps };
}

// ─── routeYear / routeAnnual ──────────────────────────────────────────────────

/**
 * Routes all 12 months in order, carrying bonus-cap usage from month to
 * month, so a $1,500 quarterly cap is shared by the quarter's three months
 * and a yearly cap by the whole year.
 *
 * @param spendForMonth  Spend for month 0 (Jan) … 11 (Dec)
 */
export function routeYear(
  walletCards: WalletCard[],
  spendForMonth: (month: number) => Record<string, number>,
  overrides: Record<string, string | null>,
  tier: Valuation = "composite",
  preferredCurrency?: string,
  configsForQuarter?: (quarter: 1 | 2 | 3 | 4) => WalletCard[]
): { months: RoutingResult[]; total: RoutingResult } {
  const book = newLedger(0);
  const months: RoutingResult[] = [];
  const total: RoutingResult = { rows: [], currencyTotals: [], totalDollarValue: 0 };
  const currencyMap: Record<string, CurrencyTotal> = {};

  for (let m = 0; m < 12; m++) {
    book.month = m;
    const q = (Math.floor(m / 3) + 1) as 1 | 2 | 3 | 4;
    const cards = configsForQuarter ? configsForQuarter(q) : walletCards;
    const r = routeMonth(cards, spendForMonth(m), overrides, q, tier, preferredCurrency, book);
    months.push(r);
    total.rows.push(...r.rows);
    for (const ct of r.currencyTotals) {
      const c = (currencyMap[ct.currencyId] ??= { currencyId: ct.currencyId, points: 0, dollarValue: 0 });
      c.points += ct.points;
      c.dollarValue += ct.dollarValue;
    }
  }
  total.currencyTotals = Object.values(currencyMap);
  total.totalDollarValue = total.currencyTotals.reduce((s, ct) => s + ct.dollarValue, 0);
  return { months, total };
}

/**
 * A full year at the same monthly spend (see routeYear). quarterConfigs can
 * swap in per-quarter card configs; missing quarters use the wallet's own.
 */
export function routeAnnual(
  walletCards: WalletCard[],
  spend: Record<string, number>,
  overrides: Record<string, string | null>,
  quarterConfigs: Partial<Record<1 | 2 | 3 | 4, WalletCard["config"][]>>,
  tier: Valuation = "composite",
  preferredCurrency?: string
): RoutingResult {
  return routeYear(
    walletCards,
    () => spend,
    overrides,
    tier,
    preferredCurrency,
    (q) =>
      quarterConfigs[q]
        ? walletCards.map((wc, i) => ({ ...wc, config: quarterConfigs[q]![i] ?? wc.config }))
        : walletCards
  ).total;
}

// ─── calculateFees ────────────────────────────────────────────────────────────

export interface FeeResult {
  grossFees: number;
  estimatedCredits: number;
  netFees: number;
}

/** Sums annual fees and estimated annual credits across all wallet cards. */
export function calculateFees(walletCards: WalletCard[]): FeeResult {
  let grossFees = 0;
  let estimatedCredits = 0;

  for (const { card } of walletCards) {
    grossFees += card.fee;
    for (const perk of card.perks_json) {
      if (perk.annual_credit) {
        estimatedCredits += perk.annual_credit;
      }
    }
  }

  return {
    grossFees,
    estimatedCredits,
    netFees: grossFees - estimatedCredits,
  };
}

// ─── calculateSubValue ────────────────────────────────────────────────────────

/**
 * Returns the total dollar value of earned sign-up bonuses for the given wallet.
 * @param earnedSubIds  Set of walletCard IDs whose SUBs have been marked as earned
 */
export function calculateSubValue(
  walletCards: WalletCard[],
  earnedSubIds: Set<string>,
  tier: Valuation = "composite"
): number {
  let total = 0;
  for (const wc of walletCards) {
    if (!earnedSubIds.has(wc.id)) continue;
    const sub = wc.card.sub_json;
    if (!sub) continue;
    const cpp = getCpp(wc.card.currency, tier);
    total += (sub.points * cpp) / 10000;
  }
  return total;
}

// ─── getRecommendations ───────────────────────────────────────────────────────

const CREDIT_WEIGHT: Record<CreditUsage, number> = { none: 0, some: 0.5, all: 1 };

/** Picks the user's highest-spend category from a list of options. */
function topSpendCategory(options: string[], spend: Record<string, number>): string | null {
  let best: string | null = null;
  let bestSpend = -1;
  for (const id of options) {
    const s = spend[id] ?? 0;
    if (s > bestSpend) {
      best = id;
      bestSpend = s;
    }
  }
  return best;
}

/**
 * Builds a realistic config for a candidate card: rotating cards use this
 * year's announced schedule (falling back to the user's top-spend option) and
 * custom-select cards pick the user's highest-spend eligible categories.
 */
export function candidateConfig(card: Card, spend: Record<string, number>): WalletCard["config"] {
  const rotQ: WalletCard["config"]["rotQ"] = [null, null, null, null];
  if (card.rotating) {
    // Announced quarters are applied automatically; guess the rest.
    for (let q = 0; q < 4; q++) {
      rotQ[q] = announcedRotation(card, (q + 1) as 1 | 2 | 3 | 4)
        ? null
        : topSpendCategory(card.rot_opts ?? [], spend);
    }
  }
  const custom =
    card.custom_select && card.custom_opts
      ? [...card.custom_opts]
          .sort((a, b) => (spend[b] ?? 0) - (spend[a] ?? 0))
          .slice(0, card.custom_max ?? 0)
      : [];
  return { rotQ, custom };
}

/** Annual dollar value and spend per category (primary + overflow rows). */
function byCategory(result: RoutingResult): Record<string, { value: number; spend: number }> {
  const out: Record<string, { value: number; spend: number }> = {};
  for (const row of result.rows) {
    const o = (out[row.categoryId] ??= { value: 0, spend: 0 });
    o.value += row.dollarValue;
    o.spend += row.spend;
    for (const ov of row.overflow) {
      o.value += ov.dollarValue;
      o.spend += ov.spend;
    }
  }
  return out;
}

/**
 * "Stay with my current programs": a card counts as part of the user's
 * programs when it's from a bank they already bank with, or earns a points
 * currency they already collect.
 */
export function isInCurrentPrograms(card: Card, walletCards: WalletCard[]): boolean {
  return walletCards.some(
    (wc) =>
      wc.card.issuer === card.issuer ||
      (wc.card.currency === card.currency && !CASH_CURRENCIES.has(card.currency))
  );
}

/** No-fee cards that only pay off with a paid membership (Amazon Prime). */
const NEEDS_MEMBERSHIP = new Set(["amazon_prime"]);

/** Why a card was left out of the recommendations, for UI hints. */
export interface RecommendationSummary {
  recommendations: Recommendation[];
  /**
   * Good all-around picks with no annual or foreign transaction fee, for
   * people with no strong preference (or when nothing beats their wallet).
   */
  allAround: Recommendation[];
  /** Business cards that would otherwise have made the list. */
  hiddenBusinessCount: number;
  /** Chase cards hidden because of the 5/24 rule. */
  hidden524Count: number;
  /** Cards from new banks/programs hidden because the user wants to stay put. */
  hiddenNewBankCount: number;
  /**
   * Monthly spend assumed for the focus category when the user's spend has
   * none (so the focus still means something), else null.
   */
  focusSpendAssumed: number | null;
}

/**
 * Optimizer engine.
 *
 * Each candidate is simulated in the user's wallet with the real router (so
 * caps, overflow and rotating quarters are respected), then scored as:
 *
 *   ongoing  = earn gain + statement credits the user will use − annual fee
 *   score    = ongoing + sign-up bonus × bonus weight
 *
 * (With a focus category, cards are ranked by that category's gain first.)
 *
 * The earn gain is the change in the wallet's whole-year value with the card
 * added, using the same valuation for routing and scoring, so it is never
 * credited for a quarter or a cap it doesn't actually win.
 *
 * Sign-up bonuses only count when the user's normal spend can reach the
 * minimum in time, and are weighted by the user's goal (see GOAL_RULES).
 * Business cards, Chase cards (5/24) and cards outside the user's current
 * programs are excluded unless the user's answers allow them.
 */
export function getRecommendationSummary(
  walletCards: WalletCard[],
  spend: Record<string, number>,
  preferences: OptimizerPreferences,
  allCards: Card[],
  tier: ValuationTier = "composite"
): RecommendationSummary {
  const prefs = { ...DEFAULT_OPTIMIZER_PREFERENCES, ...preferences };
  const rules = GOAL_RULES[prefs.goal ?? "everyday"] ?? GOAL_RULES.everyday;
  const rankTier = rankingValuation(prefs, walletCards, tier);
  const bonusWeight = rules.bonusWeight;
  const creditWeight = CREDIT_WEIGHT[prefs.creditUsage ?? "none"];
  const walletCardIds = new Set(walletCards.map((wc) => wc.card.id));
  const monthlyTotal = Object.values(spend).reduce((s, v) => s + (v > 0 ? v : 0), 0);
  const focus = prefs.focusCategory && CATEGORIES.some((c) => c.id === prefs.focusCategory) ? prefs.focusCategory : null;
  // A focus category the user has no spend in would otherwise be silently
  // ignored (nothing can improve $0); score it at a typical amount instead.
  const focusSpendAssumed =
    focus && !((spend[focus] ?? 0) > 0) ? CATEGORIES.find((c) => c.id === focus)!.defaultAmount || 100 : null;
  const planSpend = focusSpendAssumed != null ? { ...spend, [focus!]: focusSpendAssumed } : spend;
  const stay = prefs.ecosystem === "stay" && walletCards.length > 0;

  const baseline = byCategory(routeAnnual(walletCards, planSpend, {}, {}, rankTier));

  const results: Recommendation[] = [];
  let hiddenBusinessCount = 0;
  let hidden524Count = 0;
  let hiddenNewBankCount = 0;

  /** Filters the user set explicitly (fee, score, issuer, currency). */
  const passesFilters = (card: Card) =>
    card.status === "active" &&
    !walletCardIds.has(card.id) &&
    (prefs.maxFee == null || card.fee <= prefs.maxFee) &&
    (prefs.minCreditScore == null || card.fico_min == null || card.fico_min <= prefs.minCreditScore) &&
    (prefs.preferredIssuers.length === 0 || prefs.preferredIssuers.includes(card.issuer)) &&
    (prefs.preferredCurrencies.length === 0 || prefs.preferredCurrencies.includes(card.currency));

  const scored = new Map<string, Recommendation>();
  const score = (card: Card) => {
    let r = scored.get(card.id);
    if (!r) scored.set(card.id, (r = scoreCandidate(card)));
    return r;
  };

  for (const card of allCards) {
    if (!passesFilters(card)) continue;
    if (rules.allows && !rules.allows(card)) continue;

    const rec = score(card);
    if (!qualifies(rec)) continue;

    // Eligibility from the questionnaire (counted so the UI can say what was hidden)
    if (card.business && !prefs.openToBusinessCards) {
      hiddenBusinessCount++;
      continue;
    }
    if (prefs.over524 && card.issuer === "Chase") {
      hidden524Count++;
      continue;
    }
    if (stay && !isInCurrentPrograms(card, walletCards)) {
      hiddenNewBankCount++;
      continue;
    }
    results.push(rec);
  }

  // With a focus category, rank by how much more that category earns
  // (rounded to the dollar so near-ties fall back to overall value).
  const focusGain = (r: Recommendation) =>
    focus ? Math.round(r.improvements.find((i) => i.categoryId === focus)?.annualGain ?? 0) : 0;
  results.sort(
    (a, b) =>
      focusGain(b) - focusGain(a) ||
      b.netValue - a.netValue ||
      a.card.fee - b.card.fee ||
      b.card.score - a.card.score
  );
  const recommendations = results.slice(0, 8);

  /**
   * A card's yearly earnings on its own at typical spending, at cash-out
   * value: an all-rounder should be good without learning transfer partners.
   */
  const typicalSpend = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.defaultAmount]));
  const soloValue = (card: Card) =>
    routeAnnual([{ id: "__solo__", card, config: candidateConfig(card, typicalSpend) }], typicalSpend, {}, {}, "floor")
      .totalDollarValue;

  // Solid all-rounders: no annual fee, no foreign transaction fee, nothing
  // to pay or join to use them. Shown whatever the answers, so there's
  // always something sensible to look at, best fit for this wallet first.
  const allAround = allCards
    .filter(
      (card) =>
        passesFilters(card) &&
        card.fee === 0 &&
        card.ftf === 0 &&
        !card.business &&
        !NEEDS_MEMBERSHIP.has(card.id) &&
        !(prefs.over524 && card.issuer === "Chase") &&
        !(stay && !isInCurrentPrograms(card, walletCards))
    )
    .map((card) => ({ rec: score(card), solo: soloValue(card) }))
    // Generally good = earns the most on its own for typical spending; what
    // it adds to this wallet breaks near-ties.
    .sort((a, b) => Math.round(b.solo / 10) - Math.round(a.solo / 10) || b.rec.earnGain - a.rec.earnGain)
    .slice(0, 4)
    .map((x) => x.rec);

  return {
    recommendations,
    allAround,
    hiddenBusinessCount,
    hidden524Count,
    hiddenNewBankCount,
    focusSpendAssumed,
  };

  function qualifies(rec: Recommendation): boolean {
    if (rec.netValue <= 0) return false;
    // Outside of bonus hunting, skip cards that cost more each year than they return.
    if (!rules.allowNegativeOngoing && rec.ongoingValue < 0) return false;
    if (rules.needsEarnGain && rec.earnGain < 1) return false;
    if (focus && !rec.improvements.some((i) => i.categoryId === focus)) return false;
    return true;
  }

  /** Year of routing with the candidate added, under a given config. */
  function simulate(card: Card, config: WalletCard["config"]) {
    return byCategory(
      routeAnnual([...walletCards, { id: "__candidate__", card, config }], planSpend, {}, {}, rankTier)
    );
  }

  /** How good a simulated year is: focus-category gain first, then total gain. */
  function gainOf(withCard: ReturnType<typeof byCategory>): [number, number] {
    let total = 0;
    for (const cat of CATEGORIES) total += (withCard[cat.id]?.value ?? 0) - (baseline[cat.id]?.value ?? 0);
    const f = focus ? (withCard[focus]?.value ?? 0) - (baseline[focus]?.value ?? 0) : 0;
    return [Math.round(f), total];
  }

  /**
   * Picks the card's choosable categories (Custom Cash, Cash+, …) that add
   * the most to this wallet, rather than the biggest spend categories: a
   * 5% pick on dining is worth little if dining already earns 5% elsewhere.
   */
  function bestConfig(card: Card): { config: WalletCard["config"]; withCard: ReturnType<typeof byCategory> } {
    const start = candidateConfig(card, planSpend);
    const opts = card.custom_select ? card.custom_opts ?? [] : [];
    const k = Math.min(card.custom_max ?? 0, opts.length);
    let best = { config: start, withCard: simulate(card, start) };
    if (k === 0) return best;
    let bestScore = gainOf(best.withCard);
    const combos: string[][] = [];
    const pick = (from: number, acc: string[]) => {
      if (combos.length > 60) return;
      if (acc.length === k) return void combos.push(acc);
      for (let i = from; i < opts.length; i++) pick(i + 1, [...acc, opts[i]]);
    };
    pick(0, []);
    for (const custom of combos) {
      const config = { ...start, custom };
      const withCard = simulate(card, config);
      const score = gainOf(withCard);
      if (score[0] > bestScore[0] || (score[0] === bestScore[0] && score[1] > bestScore[1] + 0.01)) {
        best = { config, withCard };
        bestScore = score;
      }
    }
    return best;
  }

  function scoreCandidate(card: Card): Recommendation {
    const { config, withCard } = bestConfig(card);

    const improvements: CategoryImprovement[] = [];
    let earnGain = 0;
    for (const cat of CATEGORIES) {
      const before = baseline[cat.id] ?? { value: 0, spend: 0 };
      const after = withCard[cat.id] ?? { value: 0, spend: 0 };
      const gain = after.value - before.value;
      earnGain += gain;
      if (gain <= 0.5 || after.spend <= 0) continue;
      improvements.push({
        categoryId: cat.id,
        // Whole-year average return in % (cents per dollar), so a 5% quarter
        // or a capped bonus shows up as what it's really worth over a year.
        currentReturn: before.spend > 0 ? (before.value / before.spend) * 100 : 0,
        newReturn: (after.value / after.spend) * 100,
        annualGain: gain,
      });
    }
    improvements.sort((a, b) =>
      a.categoryId === focus ? -1 : b.categoryId === focus ? 1 : b.annualGain - a.annualGain
    );

    const totalCredits = card.perks_json.reduce((s, p) => s + (p.annual_credit ?? 0), 0);
    const creditValue = rules.creditsOnlyOffsetFee
      ? Math.min(totalCredits * creditWeight, card.fee)
      : totalCredits * creditWeight;

    const sub = card.sub_json;
    const subReachable = sub != null && monthlyTotal * sub.timeframe_months >= sub.spend_requirement;
    const subValue = sub && subReachable ? (sub.points * getCpp(card.currency, rankTier)) / 10000 : 0;

    const ongoingValue = earnGain + creditValue - card.fee;
    const firstYearValue = ongoingValue + subValue;
    const netValue = ongoingValue + subValue * bonusWeight;

    return {
      card,
      config,
      earnGain,
      creditValue,
      subValue,
      subReachable,
      ongoingValue,
      firstYearValue,
      improvements,
      netValue,
    };
  }
}

/** Top recommendations (see getRecommendationSummary for the scoring rules). */
export function getRecommendations(
  walletCards: WalletCard[],
  spend: Record<string, number>,
  preferences: OptimizerPreferences,
  allCards: Card[],
  tier: ValuationTier = "composite"
): Recommendation[] {
  return getRecommendationSummary(walletCards, spend, preferences, allCards, tier).recommendations;
}
