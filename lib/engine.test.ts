import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import {
  getEarnRate,
  rotatingCategories,
  currentQuarter,
  routeMonth,
  routeAnnual,
  routeYear,
  calculateFees,
  calculateSubValue,
  getRecommendations,
  getRecommendationSummary,
  DEFAULT_OPTIMIZER_PREFERENCES,
} from "./engine";
import type { OptimizerPreferences } from "./engine";
import { CARDS } from "./cards";
import type { WalletCard, CardConfig } from "@/types";

// Pin the clock to a year with no announced rotating schedule so the user's
// quarterly picks apply; schedule-specific tests set their own date.
beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2030-02-01T12:00:00Z"));
});
afterAll(() => {
  vi.useRealTimers();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeWalletCard(cardId: string, config?: Partial<CardConfig>): WalletCard {
  const card = CARDS.find((c) => c.id === cardId);
  if (!card) throw new Error(`Card not found: ${cardId}`);
  return {
    id: `wc_${cardId}`,
    card,
    config: {
      rotQ: [null, null, null, null],
      custom: [],
      ...config,
    },
  };
}

const defaultSpend: Record<string, number> = {
  dining: 300,
  groceries: 500,
  gas: 150,
  travel: 200,
  hotels: 100,
  streaming: 100,
  online: 200,
  entertainment: 150,
  transit: 80,
  rent: 0,
  drugstore: 40,
  other: 200,
};

// ─── getEarnRate ──────────────────────────────────────────────────────────────

describe("getEarnRate", () => {
  it("returns base rate for a standard card", () => {
    const csr = CARDS.find((c) => c.id === "csr")!;
    const config: CardConfig = { rotQ: [null, null, null, null], custom: [] };
    // CSR: dining = 3x
    expect(getEarnRate(csr, "dining", config, 1)).toBe(3);
    // CSR: other = 1x
    expect(getEarnRate(csr, "other", config, 1)).toBe(1);
  });

  it("stacks the rotating +4% on the card's own rate (Freedom Flex dining = 7x)", () => {
    const cff = CARDS.find((c) => c.id === "cff")!;
    const config: CardConfig = { rotQ: ["dining", "gas", null, null], custom: [] };
    // Chase: "the most you will earn on eligible dining purchases during that quarter is 7%"
    expect(getEarnRate(cff, "dining", config, 1)).toBe(7);
    // A 1x category becomes 5x
    expect(getEarnRate(cff, "gas", config, 2)).toBe(5);
  });

  it("returns base rate for rotating card when quarterly category does not match", () => {
    const cff = CARDS.find((c) => c.id === "cff")!;
    const config: CardConfig = { rotQ: ["groceries", null, null, null], custom: [] };
    // CFF dining base = 3, no bonus
    expect(getEarnRate(cff, "dining", config, 1)).toBe(3);
  });

  it("returns custom_rate for custom-select card on selected category", () => {
    const cc = CARDS.find((c) => c.id === "citi_custom_cash")!;
    const config: CardConfig = { rotQ: [null, null, null, null], custom: ["dining"] };
    expect(getEarnRate(cc, "dining", config, 1)).toBe(cc.custom_rate!);
  });

  it("returns base rate for custom-select card on non-selected category", () => {
    const cc = CARDS.find((c) => c.id === "citi_custom_cash")!;
    const config: CardConfig = { rotQ: [null, null, null, null], custom: ["dining"] };
    // groceries not selected → base rate (1)
    expect(getEarnRate(cc, "groceries", config, 1)).toBe(cc.earn_json["groceries"] ?? 1);
  });

  it("uses the correct quarter for rotating selection", () => {
    const cff = CARDS.find((c) => c.id === "cff")!;
    const config: CardConfig = { rotQ: [null, "gas", null, null], custom: [] };
    // Q2 = gas
    expect(getEarnRate(cff, "gas", config, 2)).toBe(5);
    // Q1 = null → base rate
    expect(getEarnRate(cff, "gas", config, 1)).toBe(cff.earn_json["gas"]);
  });
});

// ─── routeMonth — basic routing ───────────────────────────────────────────────

describe("routeMonth — basic routing", () => {
  it("routes dining to the highest earn-rate card", () => {
    // CSR: 3x dining. CSP: 3x dining. CFU: 3x dining.
    // All tie at 3x dining → tiebreak by currency composite.
    const wallet = [makeWalletCard("csr"), makeWalletCard("csp")];
    const result = routeMonth(wallet, { dining: 300 }, {}, 1);
    const diningRow = result.rows.find((r) => r.categoryId === "dining");
    expect(diningRow).toBeDefined();
    expect(diningRow!.earnRate).toBe(3);
  });

  it("routes dining to Freedom Flex at 7x when quarterly is set to dining (Q1)", () => {
    const wallet = [
      makeWalletCard("cff", { rotQ: ["dining", null, null, null], custom: [] }),
      makeWalletCard("csr"),
    ];
    const result = routeMonth(wallet, { dining: 300 }, {}, 1);
    const diningRow = result.rows.find((r) => r.categoryId === "dining");
    expect(diningRow).toBeDefined();
    expect(diningRow!.walletCard.card.id).toBe("cff");
    expect(diningRow!.earnRate).toBe(7);
  });

  it("calculates points and dollar value correctly", () => {
    // CSR: 3x dining, chase_ur at composite 2.00¢
    // $300 dining * 3x = 900 pts * 2.00¢ = $18.00
    const wallet = [makeWalletCard("csr")];
    const result = routeMonth(wallet, { dining: 300 }, {}, 1, "composite");
    const diningRow = result.rows.find((r) => r.categoryId === "dining");
    expect(diningRow!.points).toBeCloseTo(900);
    expect(diningRow!.dollarValue).toBeCloseTo(18);
  });

  it("changing valuation tier changes dollar value but not earn rate or routing", () => {
    const wallet = [makeWalletCard("csr"), makeWalletCard("csp")];
    const composite = routeMonth(wallet, { dining: 300 }, {}, 1, "composite");
    const ceiling  = routeMonth(wallet, { dining: 300 }, {}, 1, "ceiling");

    const compRow = composite.rows.find((r) => r.categoryId === "dining");
    const ceilRow  = ceiling.rows.find((r) => r.categoryId === "dining");

    // Routing should be the same card
    expect(compRow!.walletCard.card.id).toBe(ceilRow!.walletCard.card.id);
    expect(compRow!.earnRate).toBe(ceilRow!.earnRate);
    // Dollar value should differ
    expect(ceilRow!.dollarValue).toBeGreaterThan(compRow!.dollarValue);
  });

  it("applies manual override", () => {
    // CSR 3x dining, CFU 3x dining (tie) — force CFU via override
    const csr = makeWalletCard("csr");
    const cfu = makeWalletCard("cfu");
    const result = routeMonth([csr, cfu], { dining: 300 }, { dining: cfu.id }, 1);
    const diningRow = result.rows.find((r) => r.categoryId === "dining");
    expect(diningRow!.walletCard.card.id).toBe("cfu");
  });
});

// ─── routeMonth — cap overflow ────────────────────────────────────────────────

describe("routeMonth — cap overflow", () => {
  it("overflows to second-best card when primary cap is hit", () => {
    // Citi Custom Cash: 5x dining up to $500/mo, base 1x after
    // Set spend > $500 to trigger overflow
    const cc = makeWalletCard("citi_custom_cash", { rotQ: [null, null, null, null], custom: ["dining"] });
    const csr = makeWalletCard("csr"); // 3x dining, no cap
    const wallet = [cc, csr];
    const result = routeMonth(wallet, { dining: 700 }, {}, 1);
    const diningRow = result.rows.find((r) => r.categoryId === "dining");

    expect(diningRow).toBeDefined();
    expect(diningRow!.walletCard.card.id).toBe("citi_custom_cash");
    expect(diningRow!.capHit).toBe(true);
    expect(diningRow!.overflow.length).toBeGreaterThan(0);

    // Overflow should go to CSR at 3x for remaining $200
    const ov = diningRow!.overflow[0];
    expect(ov.walletCard.card.id).toBe("csr");
    expect(ov.spend).toBeCloseTo(200);
  });

  it("custom-select cap is shared across selected categories", () => {
    // Citi Custom Cash: $500/mo shared cap across custom-selected categories
    const cc = makeWalletCard("citi_custom_cash", { rotQ: [null, null, null, null], custom: ["dining", "groceries"] });
    const fallback = makeWalletCard("csr");
    const wallet = [cc, fallback];

    // $600 of spend for a $500 cap. The cap goes where it gains most:
    // groceries (else 1x on CSR) before dining (else 3x on CSR).
    const result = routeMonth(wallet, { dining: 400, groceries: 200 }, {}, 1);
    const grocRow = result.rows.find((r) => r.categoryId === "groceries")!;
    const dinRow = result.rows.find((r) => r.categoryId === "dining")!;

    expect(grocRow.walletCard.card.id).toBe("citi_custom_cash");
    expect(grocRow.spend).toBeCloseTo(200);
    expect(dinRow.walletCard.card.id).toBe("citi_custom_cash");
    expect(dinRow.spend).toBeCloseTo(300);
    expect(dinRow.overflow[0].walletCard.card.id).toBe("csr");
    expect(dinRow.overflow[0].spend).toBeCloseTo(100);
    // Rows still come back in category order
    expect(result.rows.map((r) => r.categoryId).indexOf("dining")).toBeLessThan(
      result.rows.map((r) => r.categoryId).indexOf("groceries")
    );
  });

  it("Freedom Flex's $1,500 cap is per quarter, drawn down month by month", () => {
    // $700/mo dining in a dining quarter: Jan 700 + Feb 700 at 7x, then only
    // $100 of March fits under the $1,500; the rest earns CFF's own 3x.
    const cff = makeWalletCard("cff", { rotQ: ["dining", null, null, null], custom: [] });
    const { months } = routeYear([cff], () => ({ dining: 700 }), {});
    const bonusSpend = (m: number) => {
      const row = months[m].rows.find((r) => r.categoryId === "dining")!;
      return [row, ...row.overflow].filter((r) => r.earnRate === 7).reduce((s, r) => s + r.spend, 0);
    };
    expect(bonusSpend(0)).toBeCloseTo(700);
    expect(bonusSpend(1)).toBeCloseTo(700);
    expect(bonusSpend(2)).toBeCloseTo(100);
    const march = months[2].rows.find((r) => r.categoryId === "dining")!;
    expect(march.capHit).toBe(true);
    expect(march.overflow[0].earnRate).toBe(3);
    expect(march.overflow[0].spend).toBeCloseTo(600);
    // The cap resets in April (no dining bonus in Q2 → plain 3x)
    expect(months[3].rows.find((r) => r.categoryId === "dining")!.earnRate).toBe(3);
    // Where the cap stands is reported for the UI
    const cap = months[2].caps!.find((c) => c.bucket === "rotating")!;
    expect(cap.limit).toBe(1500);
    expect(cap.used).toBeCloseTo(1500);
    expect(months[1].caps!.find((c) => c.bucket === "rotating")!.used).toBeCloseTo(1400);
  });

  it("spend past a rotating cap keeps the card's own regular rate when that's best", () => {
    // Past $1,500 at 7x, CFF still earns 3x Chase points on dining (~6%),
    // which beats SavorOne's 3% cash back.
    const cff = makeWalletCard("cff", { rotQ: ["dining", null, null, null], custom: [] });
    const savor = makeWalletCard("c1_savorone");
    const row = routeMonth([savor, cff], { dining: 2000 }, {}, 1).rows.find((r) => r.categoryId === "dining")!;
    expect(row.walletCard.card.id).toBe("cff");
    expect(row.earnRate).toBe(7);
    expect(row.overflow).toHaveLength(1);
    expect(row.overflow[0].walletCard.card.id).toBe("cff");
    expect(row.overflow[0].earnRate).toBe(3);
    expect(row.overflow[0].spend).toBeCloseTo(500);
  });

  it("a lone month gets the whole quarterly cap", () => {
    const cff = makeWalletCard("cff", { rotQ: ["dining", null, null, null], custom: [] });
    const row = routeMonth([cff], { dining: 1600 }, {}, 1).rows.find((r) => r.categoryId === "dining")!;
    expect(row.spend).toBeCloseTo(1500);
    expect(row.overflow[0].spend).toBeCloseTo(100);
  });

  it("yearly caps last the whole year (Blue Cash Preferred groceries $6,000/yr)", () => {
    const bcp = makeWalletCard("amex_bcp");
    const { months } = routeYear([bcp], () => ({ groceries: 1000 }), {});
    const at6 = (m: number) => months[m].rows.find((r) => r.categoryId === "groceries")!;
    expect(at6(0).earnRate).toBe(bcp.card.earn_json.groceries);
    expect(at6(0).spend).toBeCloseTo(1000);
    expect(at6(5).spend).toBeCloseTo(1000);
    expect(at6(6).earnRate).toBe(1); // July: cap used up, 1% after
  });
});

describe("announced rotating schedule", () => {
  beforeAll(() => vi.setSystemTime(new Date("2026-11-24T12:00:00Z")));
  afterAll(() => vi.setSystemTime(new Date("2030-02-01T12:00:00Z")));

  it("knows the current quarter", () => {
    expect(currentQuarter()).toBe(4);
  });

  it("applies every announced category for the quarter and ignores stale picks", () => {
    const cff = CARDS.find((c) => c.id === "cff")!;
    // Stale pick from an old guessed schedule
    const config: CardConfig = { rotQ: [null, null, null, "online"], custom: [] };
    expect(rotatingCategories(cff, config, 4).sort()).toEqual(["dining", "groceries"]);
    expect(getEarnRate(cff, "groceries", config, 4)).toBe(5);
    expect(getEarnRate(cff, "dining", config, 4)).toBe(7);
    expect(getEarnRate(cff, "online", config, 4)).toBe(1);
  });

  it("Discover it Q4 2026 is entertainment + restaurants", () => {
    const d = CARDS.find((c) => c.id === "discover_it")!;
    const config: CardConfig = { rotQ: [null, null, null, null], custom: [] };
    expect(getEarnRate(d, "entertainment", config, 4)).toBe(5);
    expect(getEarnRate(d, "dining", config, 4)).toBe(5);
    expect(getEarnRate(d, "groceries", config, 4)).toBe(1);
  });

  it("shares the quarterly cap across all bonus categories", () => {
    // CFF Q4: groceries + dining share one $1,500 quarterly cap
    const cff = makeWalletCard("cff");
    const csr = makeWalletCard("csr");
    const result = routeMonth([cff, csr], { dining: 1000, groceries: 1000 }, {}, 4);
    const onBonus = result.rows
      .flatMap((r) => [r, ...r.overflow])
      .filter((r) => r.walletCard.card.id === "cff" && r.earnRate >= 5)
      .reduce((sum, r) => sum + r.spend, 0);
    expect(onBonus).toBeCloseTo(1500);
  });
});

// ─── routeAnnual ──────────────────────────────────────────────────────────────

describe("routeAnnual", () => {
  it("returns approximately 12x the monthly result with no rotating changes", () => {
    const wallet = [makeWalletCard("csr")];
    const monthly = routeMonth(wallet, defaultSpend, {}, 1, "composite");
    const annual  = routeAnnual(wallet, defaultSpend, {}, {}, "composite");

    // Annual total should be 12 * monthly (4 quarters * 3 months each)
    expect(annual.totalDollarValue).toBeCloseTo(monthly.totalDollarValue * 12, 0);
  });

  it("accumulates rotating quarter bonuses correctly", () => {
    // CFF with different dining rotation each quarter
    const cff = makeWalletCard("cff", { rotQ: ["dining", "groceries", "gas", "online"], custom: [] });
    const csr  = makeWalletCard("csr");
    const wallet = [cff, csr];

    const annual = routeAnnual(wallet, defaultSpend, {}, {}, "composite");
    expect(annual.totalDollarValue).toBeGreaterThan(0);
  });
});

// ─── calculateFees ────────────────────────────────────────────────────────────

describe("calculateFees", () => {
  it("sums gross fees", () => {
    const wallet = [makeWalletCard("csr"), makeWalletCard("csp")]; // $795 + $95
    const { grossFees } = calculateFees(wallet);
    expect(grossFees).toBe(890);
  });

  it("subtracts annual credits to get net fees", () => {
    const wallet = [makeWalletCard("csr")]; // $795 fee, $300 travel credit + more
    const { grossFees, estimatedCredits, netFees } = calculateFees(wallet);
    expect(grossFees).toBe(795);
    expect(estimatedCredits).toBeGreaterThanOrEqual(300);
    expect(netFees).toBe(grossFees - estimatedCredits);
  });
});

// ─── calculateSubValue ────────────────────────────────────────────────────────

describe("calculateSubValue", () => {
  it("returns 0 when no SUBs are earned", () => {
    const wallet = [makeWalletCard("csr")];
    expect(calculateSubValue(wallet, new Set(), "composite")).toBe(0);
  });

  it("calculates dollar value of earned SUB at composite cpp", () => {
    // CSR SUB: 100,000 chase_ur at 2.00¢ = $2,000
    const wc = makeWalletCard("csr");
    const value = calculateSubValue([wc], new Set([wc.id]), "composite");
    expect(value).toBeCloseTo(2000);
  });
});

// ─── getRecommendations ───────────────────────────────────────────────────────

describe("getRecommendations", () => {
  it("returns up to 8 recommendations", () => {
    const wallet = [makeWalletCard("csr")];
    const recs = getRecommendations(wallet, defaultSpend, { maxFee: null, minCreditScore: null, preferredIssuers: [], preferredCurrencies: [] }, CARDS);
    expect(recs.length).toBeLessThanOrEqual(8);
  });

  it("does not recommend cards already in the wallet", () => {
    const wallet = [makeWalletCard("csr")];
    const recs = getRecommendations(wallet, defaultSpend, { maxFee: null, minCreditScore: null, preferredIssuers: [], preferredCurrencies: [] }, CARDS);
    expect(recs.every((r) => r.card.id !== "csr")).toBe(true);
  });

  it("ranks by net value descending", () => {
    const wallet: WalletCard[] = [];
    const recs = getRecommendations(wallet, defaultSpend, { maxFee: null, minCreditScore: null, preferredIssuers: [], preferredCurrencies: [] }, CARDS);
    for (let i = 0; i < recs.length - 1; i++) {
      expect(recs[i].netValue).toBeGreaterThanOrEqual(recs[i + 1].netValue);
    }
  });

  it("filters by max fee", () => {
    const wallet: WalletCard[] = [];
    const recs = getRecommendations(wallet, defaultSpend, { maxFee: 0, minCreditScore: null, preferredIssuers: [], preferredCurrencies: [] }, CARDS);
    expect(recs.every((r) => r.card.fee === 0)).toBe(true);
  });

  it("recommends Amex Gold when wallet has no 4x grocery/dining card", () => {
    // Amex Gold: 4x dining, 4x groceries — should appear with an empty wallet
    const wallet: WalletCard[] = [];
    const recs = getRecommendations(wallet, { ...defaultSpend, dining: 500, groceries: 800 }, { maxFee: null, minCreditScore: null, preferredIssuers: [], preferredCurrencies: [] }, CARDS);
    const amexGold = recs.find((r) => r.card.id === "amex_gold");
    expect(amexGold).toBeDefined();
    expect(amexGold!.improvements.some((i) => i.categoryId === "dining" || i.categoryId === "groceries")).toBe(true);
  });
});

// ─── Optimizer questionnaire ──────────────────────────────────────────────────

describe("getRecommendations — questionnaire answers", () => {
  const prefs = (p: Partial<OptimizerPreferences> = {}): OptimizerPreferences => ({
    ...DEFAULT_OPTIMIZER_PREFERENCES,
    ...p,
  });

  it("hides business cards unless the user has a business", () => {
    const hidden = getRecommendationSummary([], defaultSpend, prefs(), CARDS);
    expect(hidden.recommendations.some((r) => r.card.business)).toBe(false);
    expect(hidden.hiddenBusinessCount).toBeGreaterThan(0);

    const shown = getRecommendations([], defaultSpend, prefs({ openToBusinessCards: true }), CARDS);
    expect(shown.some((r) => r.card.business)).toBe(true);
  });

  it("hides Chase cards for applicants over 5/24", () => {
    const recs = getRecommendations([], defaultSpend, prefs({ over524: true }), CARDS);
    expect(recs.some((r) => r.card.issuer === "Chase")).toBe(false);
  });

  it("doesn't count a bonus the user's spend can't reach", () => {
    const lowSpend = { ...defaultSpend, dining: 100, groceries: 100, other: 0, travel: 0, hotels: 0 };
    const recs = getRecommendations([], lowSpend, prefs({ goal: "bonuses" }), CARDS);
    const csr = recs.find((r) => r.card.id === "csr");
    expect(csr).toBeUndefined();
    for (const r of recs) {
      if (r.card.sub_json && !r.subReachable) expect(r.subValue).toBe(0);
    }
  });

  it("everyday goal skips cards that lose money every year", () => {
    const recs = getRecommendations([makeWalletCard("csp")], defaultSpend, prefs(), CARDS);
    expect(recs.every((r) => r.ongoingValue >= 0)).toBe(true);
  });

  it("build-credit goal only recommends no-fee, easy-approval cards", () => {
    const recs = getRecommendations([], defaultSpend, prefs({ goal: "credit" }), CARDS);
    expect(recs.length).toBeGreaterThan(0);
    expect(recs.every((r) => r.card.fee === 0 && (r.card.fico_min ?? 0) <= 670)).toBe(true);
  });

  it("staying in your ecosystem favors programs already in the wallet", () => {
    const wallet = [makeWalletCard("csp")];
    const open = getRecommendations(wallet, defaultSpend, prefs(), CARDS);
    const stay = getRecommendations(wallet, defaultSpend, prefs({ ecosystem: "stay" }), CARDS);
    expect(stay[0].card.currency).toBe("chase_ur");
    // Points in programs the user doesn't have are valued at cash-out, never higher
    for (const r of stay) {
      const before = open.find((o) => o.card.id === r.card.id);
      if (before && r.card.currency !== "chase_ur") {
        expect(r.netValue).toBeLessThanOrEqual(before.netValue + 0.01);
      }
    }
  });

  it("counts caps instead of assuming unlimited bonus spend", () => {
    // Custom Cash: 5x on one category, capped at $500/month
    const bigDining = { ...defaultSpend, dining: 2000 };
    const recs = getRecommendationSummary([], bigDining, prefs({ goal: "cashback" }), CARDS, "composite");
    const cc = recs.recommendations.find((r) => r.card.id === "citi_custom_cash");
    if (cc) {
      const dining = cc.improvements.find((i) => i.categoryId === "dining");
      // Uncapped 5x on $2,000 would be $1,200/yr; with the cap it must be far less.
      expect(dining?.annualGain ?? 0).toBeLessThan(1200);
    }
  });
});

// ─── Root-cause regressions (Nov 2026) ───────────────────────────────────────

describe("routing and ranking use real value, not raw multipliers", () => {
  const prefs = (p: Partial<OptimizerPreferences> = {}): OptimizerPreferences => ({
    ...DEFAULT_OPTIMIZER_PREFERENCES,
    ...p,
  });

  it("routes to the card worth more per dollar, not the bigger multiplier", () => {
    // 1.5x Chase points (~2¢) = 3% vs 2% cash back
    const wallet = [makeWalletCard("wf_active_cash"), makeWalletCard("cfu")];
    const r = routeMonth(wallet, { other: 1000 }, {}, 1, "floor");
    expect(r.rows.find((x) => x.categoryId === "other")!.walletCard.card.id).toBe("cfu");
    // ...but someone cashing out points gets the 2% card
    const cashOut = routeMonth(wallet, { other: 1000 }, {}, 1, () => 100);
    expect(cashOut.rows.find((x) => x.categoryId === "other")!.walletCard.card.id).toBe("wf_active_cash");
  });

  describe("with a real 2026 rotating calendar", () => {
    beforeAll(() => vi.setSystemTime(new Date("2026-11-24T12:00:00Z")));
    afterAll(() => vi.setSystemTime(new Date("2030-02-01T12:00:00Z")));
    const wallet = () => [makeWalletCard("cff"), makeWalletCard("cfu"), makeWalletCard("c1_venturex")];

    it("reports whole-year returns, not the best single quarter", () => {
      const { recommendations } = getRecommendationSummary(wallet(), defaultSpend, prefs(), CARDS);
      for (const r of recommendations) {
        for (const imp of r.improvements) {
          expect(imp.newReturn).toBeGreaterThan(imp.currentReturn);
          expect(imp.annualGain).toBeGreaterThan(0);
        }
      }
    });

    it("'stick with my programs' only shows banks or points already held", () => {
      const s = getRecommendationSummary(wallet(), defaultSpend, prefs({ ecosystem: "stay", creditUsage: "some" }), CARDS);
      expect(s.recommendations.length).toBeGreaterThan(0);
      for (const r of s.recommendations) {
        expect(["Chase", "Capital One"]).toContain(r.card.issuer);
      }
      expect(s.hiddenNewBankCount).toBeGreaterThan(0);
    });

    it("everyday-spending goal never ranks a card that earns nothing extra", () => {
      const recs = getRecommendations(wallet(), defaultSpend, prefs({ creditUsage: "some" }), CARDS);
      expect(recs.every((r) => r.earnGain >= 1)).toBe(true);
    });

    it("a focus category only shows cards that raise it, listed first", () => {
      const recs = getRecommendations(wallet(), defaultSpend, prefs({ focusCategory: "gas" }), CARDS);
      expect(recs.length).toBeGreaterThan(0);
      for (const r of recs) expect(r.improvements[0].categoryId).toBe("gas");
    });
  });
});

// ─── Card database integrity ──────────────────────────────────────────────────

import { CARD_MAP } from "./cards";
import { CURRENCY_MAP } from "./currencies";
import { CATEGORY_IDS } from "./categories";

describe("card database", () => {
  it("has unique ids and a lookup map entry for every card", () => {
    const ids = CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of CARDS) expect(CARD_MAP[c.id]).toBe(c);
  });

  it("uses known currencies and fills every category", () => {
    for (const c of CARDS) {
      expect(CURRENCY_MAP[c.currency], `${c.id} currency`).toBeDefined();
      for (const cat of CATEGORY_IDS) {
        expect(typeof c.earn_json[cat], `${c.id}.${cat}`).toBe("number");
      }
    }
  });

  it("only offers custom/rotating options that are real categories", () => {
    for (const c of CARDS) {
      for (const opt of [...(c.custom_opts ?? []), ...(c.rot_opts ?? [])]) {
        expect(CATEGORY_IDS, `${c.id} option ${opt}`).toContain(opt);
      }
    }
  });
});
