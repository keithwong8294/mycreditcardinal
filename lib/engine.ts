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

/** Returns cents-per-point for a given currency at the given tier (e.g. 200 = 2.00¢). */
function getCpp(currencyId: string, tier: ValuationTier): number {
  const currency = CURRENCY_MAP[currencyId];
  if (!currency) return 100; // fallback: 1¢
  if (tier === "floor") return currency.floor;
  if (tier === "ceiling") return currency.ceiling;
  return currency.composite;
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
  if (card.rotating) {
    const rotCategory = config.rotQ[quarter - 1];
    if (rotCategory === categoryId) {
      // INSTRUCTIONS: rotating earn = base_rate + 5 (not just 5)
      // The rot_cap covers the bonus portion only.
      return baseRate + 5;
    }
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
  if (card.rotating && card.rot_cap != null) {
    const rotCategory = config.rotQ[quarter - 1];
    if (rotCategory === categoryId) {
      // rot_cap is quarterly → divide by 3 for a monthly cap
      return card.rot_cap / 3;
    }
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

export interface OptimizerPreferences {
  maxFee: number | null;
  minCreditScore: number | null;
  preferredIssuers: string[];
  preferredCurrencies: string[];
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
  tier: ValuationTier = "composite",
  preferredCurrency?: string
): RoutingResult {
  // Track how much of each card's custom cap has been consumed this month.
  // Key: walletCard.id + "|custom"
  const customCapUsed: Record<string, number> = {};

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
  tier: ValuationTier = "composite",
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
  tier: ValuationTier = "composite"
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

/**
 * Optimizer engine: scores every card not in the wallet and returns the top 8
 * ranked by net annual value (earn gain + SUB value − annual fee).
 */
export function getRecommendations(
  walletCards: WalletCard[],
  spend: Record<string, number>,
  preferences: OptimizerPreferences,
  allCards: Card[],
  tier: ValuationTier = "composite"
): Recommendation[] {
  const walletCardIds = new Set(walletCards.map((wc) => wc.card.id));

  // Current best earn rate per category across all wallet cards
  const currentBestRate: Record<string, number> = {};
  for (const cat of CATEGORIES) {
    currentBestRate[cat.id] = 0;
    for (const wc of walletCards) {
      // Use Q1 as a baseline for optimizer comparisons
      const rate = getEarnRate(wc.card, cat.id, wc.config, 1);
      if (rate > currentBestRate[cat.id]) currentBestRate[cat.id] = rate;
    }
  }

  const results: Recommendation[] = [];

  for (const card of allCards) {
    if (card.status !== "active") continue;
    if (walletCardIds.has(card.id)) continue;

    // Apply preference filters
    if (preferences.maxFee != null && card.fee > preferences.maxFee) continue;
    if (preferences.minCreditScore != null && card.fico_min != null && card.fico_min > preferences.minCreditScore) continue;
    if (preferences.preferredIssuers.length > 0 && !preferences.preferredIssuers.includes(card.issuer)) continue;
    if (preferences.preferredCurrencies.length > 0 && !preferences.preferredCurrencies.includes(card.currency)) continue;

    const cpp = getCpp(card.currency, tier);

    // For custom-select / rotating cards, use a synthetic "best-case" config
    const syntheticConfig: WalletCard["config"] = {
      rotQ: [
        card.rot_opts?.[0] ?? null,
        card.rot_opts?.[0] ?? null,
        card.rot_opts?.[0] ?? null,
        card.rot_opts?.[0] ?? null,
      ],
      custom: card.custom_opts?.slice(0, card.custom_max ?? 0) ?? [],
    };

    const improvements: CategoryImprovement[] = [];
    let earnGain = 0;

    for (const cat of CATEGORIES) {
      const monthly = spend[cat.id] ?? 0;
      if (monthly === 0) continue;

      const candidateRate = getEarnRate(card, cat.id, syntheticConfig, 1);
      const current = currentBestRate[cat.id];

      if (candidateRate > current) {
        const annualGain = ((candidateRate - current) * monthly * 12 * cpp) / 10000;
        earnGain += annualGain;
        improvements.push({
          categoryId: cat.id,
          currentRate: current,
          candidateRate,
          annualGain,
        });
      }
    }

    // SUB value
    const subValue = card.sub_json ? (card.sub_json.points * cpp) / 10000 : 0;

    const netValue = earnGain + subValue - card.fee;

    results.push({ card, earnGain, subValue, improvements, netValue });
  }

  // Rank by net value descending, return top 8
  results.sort((a, b) => b.netValue - a.netValue);
  return results.slice(0, 8);
}
