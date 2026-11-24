import type {
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

  // Rotating quarterly cards (Freedom Flex, Discover it)
  // Rotating 5% is 5x total (the 1x base plus a 4x bonus), not on top of
  // other category bonuses, so Freedom Flex dining stays 5x, not 8x.
  if (rotatingCategories(card, config, quarter).includes(categoryId)) {
    return Math.max(baseRate, 5);
  }

  // Custom-select cards (Citi Custom Cash, US Bank Cash+, BoA CCR)
  if (card.custom_select && card.custom_rate != null) {
    if (config.custom.includes(categoryId)) {
      return card.custom_rate;
    }
  }

  return baseRate;
}

// ─── Cap tracking ─────────────────────────────────────────────────────────────

/**
 * Returns the per-category monthly spend cap (in dollars) for a card in a category,
 * or null if there is no cap.
 *
 * For rotating cards the cap applies only to the bonus portion's projected quarterly
 * spend; we track this as a monthly cap = rot_cap / 3.
 * For custom-select cards the "custom" key in caps_json is a combined monthly cap
 * across all selected categories.
 */
function getMonthlyCap(
  card: Card,
  categoryId: string,
  config: WalletCard["config"],
  quarter: 1 | 2 | 3 | 4,
  earnRate: number
): number | null {
  // Rotating bonus cap
  if (
    card.rotating &&
    card.rot_cap != null &&
    earnRate > (card.earn_json[categoryId] ?? 1) &&
    rotatingCategories(card, config, quarter).includes(categoryId)
  ) {
    // rot_cap is quarterly and shared by all bonus categories → monthly = /3
    return card.rot_cap / 3;
  }

  // Custom-select combined cap (shared across all selected categories)
  if (card.custom_select && config.custom.includes(categoryId) && "custom" in card.caps_json) {
    return card.caps_json["custom"];
  }

  // Explicit per-category cap
  if (card.caps_json[categoryId] != null) {
    return card.caps_json[categoryId];
  }

  return null;
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
}

const CASH_CURRENCIES = new Set(["cash", "discover"]);

export const GOAL_RULES: Record<CardGoal, GoalRules> = {
  // Best long-run earning; the bonus is spread over a typical ~4-year hold.
  everyday: { bonusWeight: 0.25, cashValue: false },
  // Churning: the welcome bonus counts in full, even on cards you'd cancel later.
  bonuses: { bonusWeight: 1, cashValue: false, allowNegativeOngoing: true },
  // Simple cash back: points are worth what they cash out for.
  cashback: { bonusWeight: 0.25, cashValue: true },
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
 */
export function rankingValuation(
  preferences: Partial<OptimizerPreferences>,
  walletCards: WalletCard[],
  tier: ValuationTier = "composite"
): Valuation {
  const prefs = { ...DEFAULT_OPTIMIZER_PREFERENCES, ...preferences };
  const rules = GOAL_RULES[prefs.goal ?? "everyday"] ?? GOAL_RULES.everyday;
  if (rules.cashValue || prefs.redemption === "cash") return "floor";
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
 * Routes a single month of spending across wallet cards.
 *
 * Rules (from INSTRUCTIONS.md):
 * 1. Sort eligible cards by raw earn rate descending (valuations never affect order).
 * 2. Tiebreak: preferred currency first (passed via `preferredCurrency`), then higher
 *    composite valuation.
 * 3. If best card's cap is exceeded, overflow to next-best, then next, etc.
 * 4. Cap usage is tracked per card across all categories (shared caps).
 */
export function routeMonth(
  walletCards: WalletCard[],
  spend: Record<string, number>,
  overrides: Record<string, string | null>,
  quarter: 1 | 2 | 3 | 4,
  tier: Valuation = "composite",
  preferredCurrency?: string
): RoutingResult {
  // Track how much of each card's custom cap has been consumed this month.
  // Key: walletCard.id + "|custom"
  const customCapUsed: Record<string, number> = {};
  // Rotating 5x cap is combined across all of the quarter's bonus categories.
  const rotCapUsed: Record<string, number> = {};

  const rows: RoutingRow[] = [];

  for (const cat of CATEGORIES) {
    const monthly = spend[cat.id] ?? 0;
    if (monthly === 0) {
      // Still include the row so the UI can render it — just with zero values.
    }

    // Build candidate list (sorted by earn rate desc, then by tiebreak)
    const candidates = walletCards
      .map((wc) => ({
        wc,
        rate: getEarnRate(wc.card, cat.id, wc.config, quarter),
      }))
      .sort((a, b) => {
        if (b.rate !== a.rate) return b.rate - a.rate;
        // Tiebreak 1: preferred currency
        const aPref = preferredCurrency && a.wc.card.currency === preferredCurrency ? 1 : 0;
        const bPref = preferredCurrency && b.wc.card.currency === preferredCurrency ? 1 : 0;
        if (bPref !== aPref) return bPref - aPref;
        // Tiebreak 2: higher composite cpp
        const aCpp = getCpp(a.wc.card.currency, "composite");
        const bCpp = getCpp(b.wc.card.currency, "composite");
        return bCpp - aCpp;
      });

    // Apply manual override: move overridden card to front if present
    const overrideId = overrides[cat.id] ?? null;
    if (overrideId) {
      const idx = candidates.findIndex((c) => c.wc.id === overrideId);
      if (idx > 0) {
        const [overridden] = candidates.splice(idx, 1);
        candidates.unshift(overridden);
      }
    }

    if (candidates.length === 0) {
      // No cards in wallet — skip row
      continue;
    }

    // Distribute spend across candidates respecting caps
    let remainingSpend = monthly;
    let primaryRow: RoutingRow | null = null;
    const overflowRows: OverflowRow[] = [];

    for (const { wc, rate } of candidates) {
      if (remainingSpend <= 0) break;

      const capKey = `${wc.id}|custom`;
      const usedCustom = customCapUsed[capKey] ?? 0;

      // Calculate effective cap for this card + category
      let cap = getMonthlyCap(wc.card, cat.id, wc.config, quarter, rate);

      // Reduce custom cap by already-consumed amount this month
      if (
        wc.card.custom_select &&
        wc.config.custom.includes(cat.id) &&
        "custom" in wc.card.caps_json
      ) {
        const totalCustomCap = wc.card.caps_json["custom"];
        cap = Math.max(0, totalCustomCap - usedCustom);
      }
      const isRotBonus =
        wc.card.rotating &&
        wc.card.rot_cap != null &&
        rate > (wc.card.earn_json[cat.id] ?? 1) &&
        rotatingCategories(wc.card, wc.config, quarter).includes(cat.id);
      if (isRotBonus && cap != null) cap = Math.max(0, cap - (rotCapUsed[wc.id] ?? 0));

      const allocatedSpend = cap != null ? Math.min(remainingSpend, cap) : remainingSpend;
      if (allocatedSpend <= 0) continue;

      const cpp = getCpp(wc.card.currency, tier);
      const points = allocatedSpend * rate;
      // cpp is stored as integer hundredths-of-cent (200 = 2.00¢ = $0.02/pt)
      // dollarValue = points * (cpp / 100 cents) / 100 cents-per-dollar
      const dollarValue = (points * cpp) / 10000;
      const capHit = cap != null && remainingSpend > cap;

      // Track custom cap usage
      if (
        wc.card.custom_select &&
        wc.config.custom.includes(cat.id) &&
        "custom" in wc.card.caps_json
      ) {
        customCapUsed[capKey] = usedCustom + allocatedSpend;
      }
      if (isRotBonus) rotCapUsed[wc.id] = (rotCapUsed[wc.id] ?? 0) + allocatedSpend;

      if (primaryRow === null) {
        primaryRow = {
          categoryId: cat.id,
          walletCard: wc,
          earnRate: rate,
          spend: allocatedSpend,
          points,
          dollarValue,
          capHit,
          overflow: overflowRows,
          override: overrideId,
        };
      } else {
        overflowRows.push({
          walletCard: wc,
          earnRate: rate,
          spend: allocatedSpend,
          points,
          dollarValue,
        });
      }

      remainingSpend -= allocatedSpend;
    }

    if (primaryRow) {
      rows.push(primaryRow);
    }
  }

  // Aggregate currency totals
  const currencyMap: Record<string, CurrencyTotal> = {};

  for (const row of rows) {
    const addCurrency = (currencyId: string, pts: number, dv: number) => {
      if (!currencyMap[currencyId]) {
        currencyMap[currencyId] = { currencyId, points: 0, dollarValue: 0 };
      }
      currencyMap[currencyId].points += pts;
      currencyMap[currencyId].dollarValue += dv;
    };

    addCurrency(row.walletCard.card.currency, row.points, row.dollarValue);
    for (const ov of row.overflow) {
      addCurrency(ov.walletCard.card.currency, ov.points, ov.dollarValue);
    }
  }

  const currencyTotals = Object.values(currencyMap);
  const totalDollarValue = currencyTotals.reduce((sum, ct) => sum + ct.dollarValue, 0);

  return { rows, currencyTotals, totalDollarValue };
}

// ─── routeAnnual ──────────────────────────────────────────────────────────────

export interface QuarterConfig {
  quarter: 1 | 2 | 3 | 4;
  spend: Record<string, number>;
  overrides: Record<string, string | null>;
}

/**
 * Runs routeMonth for each quarter (3 months each) and sums the results.
 * If quarterConfigs has fewer than 4 entries, the missing quarters use the
 * first config as a fallback.
 */
export function routeAnnual(
  walletCards: WalletCard[],
  spend: Record<string, number>,
  overrides: Record<string, string | null>,
  quarterConfigs: Partial<Record<1 | 2 | 3 | 4, WalletCard["config"][]>>,
  tier: Valuation = "composite",
  preferredCurrency?: string
): RoutingResult {
  const combined: RoutingResult = { rows: [], currencyTotals: [], totalDollarValue: 0 };
  const currencyMap: Record<string, CurrencyTotal> = {};

  for (const q of [1, 2, 3, 4] as const) {
    // If per-quarter card configs are provided, apply them to wallet cards
    const qCards = quarterConfigs[q]
      ? walletCards.map((wc, i) => ({
          ...wc,
          config: quarterConfigs[q]![i] ?? wc.config,
        }))
      : walletCards;

    const monthResult = routeMonth(qCards, spend, overrides, q, tier, preferredCurrency);

    // Multiply by 3 months
    for (const row of monthResult.rows) {
      combined.rows.push({
        ...row,
        spend: row.spend * 3,
        points: row.points * 3,
        dollarValue: row.dollarValue * 3,
        overflow: row.overflow.map((ov) => ({
          ...ov,
          spend: ov.spend * 3,
          points: ov.points * 3,
          dollarValue: ov.dollarValue * 3,
        })),
      });
    }

    for (const ct of monthResult.currencyTotals) {
      if (!currencyMap[ct.currencyId]) {
        currencyMap[ct.currencyId] = { currencyId: ct.currencyId, points: 0, dollarValue: 0 };
      }
      currencyMap[ct.currencyId].points += ct.points * 3;
      currencyMap[ct.currencyId].dollarValue += ct.dollarValue * 3;
    }
  }

  combined.currencyTotals = Object.values(currencyMap);
  combined.totalDollarValue = combined.currencyTotals.reduce((s, ct) => s + ct.dollarValue, 0);

  return combined;
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

/** Annual dollar value earned per category (primary + overflow rows). */
function valueByCategory(result: RoutingResult): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of result.rows) {
    let v = row.dollarValue;
    for (const ov of row.overflow) v += ov.dollarValue;
    out[row.categoryId] = (out[row.categoryId] ?? 0) + v;
  }
  return out;
}

/** Why a card was left out of the recommendations, for UI hints. */
export interface RecommendationSummary {
  recommendations: Recommendation[];
  /** Business cards that would otherwise have made the list. */
  hiddenBusinessCount: number;
  /** Chase cards hidden because of the 5/24 rule. */
  hidden524Count: number;
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
 * Sign-up bonuses only count when the user's normal spend can reach the
 * minimum in time, and are weighted by the user's goal (see GOAL_RULES), so
 * a big one-time bonus can't drown out a card's everyday value. Business cards
 * and Chase cards (5/24) are excluded unless the user's answers allow them.
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

  const baseline = valueByCategory(routeAnnual(walletCards, spend, {}, {}, rankTier));

  // Current best earn rate per category (for display)
  const currentBestRate: Record<string, number> = {};
  for (const cat of CATEGORIES) {
    let best = 0;
    for (const wc of walletCards) {
      for (const q of [1, 2, 3, 4] as const) {
        best = Math.max(best, getEarnRate(wc.card, cat.id, wc.config, q));
      }
    }
    currentBestRate[cat.id] = best;
  }

  const results: Recommendation[] = [];
  let hiddenBusinessCount = 0;
  let hidden524Count = 0;

  for (const card of allCards) {
    if (card.status !== "active") continue;
    if (walletCardIds.has(card.id)) continue;

    // Explicit filters
    if (prefs.maxFee != null && card.fee > prefs.maxFee) continue;
    if (prefs.minCreditScore != null && card.fico_min != null && card.fico_min > prefs.minCreditScore) continue;
    if (prefs.preferredIssuers.length > 0 && !prefs.preferredIssuers.includes(card.issuer)) continue;
    if (prefs.preferredCurrencies.length > 0 && !prefs.preferredCurrencies.includes(card.currency)) continue;
    if (rules.allows && !rules.allows(card)) continue;

    const rec = scoreCandidate(card);

    // Eligibility from the questionnaire (counted so the UI can say what was hidden)
    if (card.business && !prefs.openToBusinessCards) {
      if (rec.netValue > 0) hiddenBusinessCount++;
      continue;
    }
    if (prefs.over524 && card.issuer === "Chase") {
      if (rec.netValue > 0) hidden524Count++;
      continue;
    }

    if (rec.netValue <= 0) continue;
    // Outside of bonus hunting, skip cards that cost more each year than they return.
    if (!rules.allowNegativeOngoing && rec.ongoingValue < 0) continue;
    results.push(rec);
  }

  results.sort(
    (a, b) =>
      b.netValue - a.netValue ||
      a.card.fee - b.card.fee ||
      b.card.score - a.card.score
  );
  return { recommendations: results.slice(0, 8), hiddenBusinessCount, hidden524Count };

  function scoreCandidate(card: Card): Recommendation {
    const config = candidateConfig(card, spend);
    const withCard = valueByCategory(
      routeAnnual([...walletCards, { id: "__candidate__", card, config }], spend, {}, {}, rankTier)
    );

    const improvements: CategoryImprovement[] = [];
    let earnGain = 0;
    for (const cat of CATEGORIES) {
      // Clamp at zero: the user would keep using their current card wherever
      // the new one is worse (e.g. a 2% cash card vs 1.5x transferable points).
      const gain = (withCard[cat.id] ?? 0) - (baseline[cat.id] ?? 0);
      if (gain <= 0.005) continue;
      earnGain += gain;
      let candidateRate = 0;
      for (const q of [1, 2, 3, 4] as const) {
        candidateRate = Math.max(candidateRate, getEarnRate(card, cat.id, config, q));
      }
      improvements.push({
        categoryId: cat.id,
        currentRate: currentBestRate[cat.id],
        candidateRate,
        annualGain: gain,
      });
    }
    improvements.sort((a, b) => b.annualGain - a.annualGain);

    const totalCredits = card.perks_json.reduce((s, p) => s + (p.annual_credit ?? 0), 0);
    const creditValue = totalCredits * creditWeight;

    const sub = card.sub_json;
    const subReachable = sub != null && monthlyTotal * sub.timeframe_months >= sub.spend_requirement;
    const subValue = sub && subReachable ? (sub.points * getCpp(card.currency, rankTier)) / 10000 : 0;

    const ongoingValue = earnGain + creditValue - card.fee;
    const firstYearValue = ongoingValue + subValue;
    const netValue = ongoingValue + subValue * bonusWeight;

    return {
      card,
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
