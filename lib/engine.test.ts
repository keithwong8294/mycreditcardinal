import { describe, it, expect } from "vitest";
import {
  getEarnRate,
  routeMonth,
  routeAnnual,
  calculateFees,
  calculateSubValue,
  getRecommendations,
  getRecommendationSummary,
  DEFAULT_OPTIMIZER_PREFERENCES,
} from "./engine";
import type { OptimizerPreferences } from "./engine";
import { CARDS } from "./cards";
import type { WalletCard, CardConfig } from "@/types";

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

  it("returns base + 5 for rotating card when quarterly category matches", () => {
    const cff = CARDS.find((c) => c.id === "cff")!;
    const config: CardConfig = { rotQ: ["dining", null, null, null], custom: [] };
    // CFF dining base = 3, rotating bonus = +5 → 8x
    expect(getEarnRate(cff, "dining", config, 1)).toBe(8);
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
    expect(getEarnRate(cff, "gas", config, 2)).toBe(cff.earn_json["gas"] + 5);
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

  it("routes dining to Freedom Flex at 8x when quarterly is set to dining (Q1)", () => {
    const wallet = [
      makeWalletCard("cff", { rotQ: ["dining", null, null, null], custom: [] }),
      makeWalletCard("csr"),
    ];
    const result = routeMonth(wallet, { dining: 300 }, {}, 1);
    const diningRow = result.rows.find((r) => r.categoryId === "dining");
    expect(diningRow).toBeDefined();
    expect(diningRow!.walletCard.card.id).toBe("cff");
    expect(diningRow!.earnRate).toBe(8);
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

    // dining=$400 uses $400 of $500 cap; groceries=$200 → only $100 can go to CC, rest overflows
    const result = routeMonth(wallet, { dining: 400, groceries: 200 }, {}, 1);
    const grocRow = result.rows.find((r) => r.categoryId === "groceries");

    expect(grocRow).toBeDefined();
    // After $400 dining consumed cap, $100 left for groceries on CC
    expect(grocRow!.spend).toBeCloseTo(100);
    expect(grocRow!.overflow.length).toBeGreaterThan(0);
    expect(grocRow!.overflow[0].spend).toBeCloseTo(100);
  });

  it("Freedom Flex rotating cap is quarterly / 3 per month", () => {
    // CFF rot_cap = 1500 quarterly → 500/mo
    // Set dining spend = 700 → 500 to CFF at 8x, 200 overflow to next card
    const cff = makeWalletCard("cff", { rotQ: ["dining", null, null, null], custom: [] });
    const csr = makeWalletCard("csr"); // 3x dining
    const result = routeMonth([cff, csr], { dining: 700 }, {}, 1);
    const diningRow = result.rows.find((r) => r.categoryId === "dining");

    expect(diningRow!.walletCard.card.id).toBe("cff");
    expect(diningRow!.spend).toBeCloseTo(500);
    expect(diningRow!.capHit).toBe(true);
    expect(diningRow!.overflow[0].walletCard.card.id).toBe("csr");
    expect(diningRow!.overflow[0].spend).toBeCloseTo(200);
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
    // CSR SUB: 125,000 chase_ur at 2.00¢ = $2,500
    const wc = makeWalletCard("csr");
    const value = calculateSubValue([wc], new Set([wc.id]), "composite");
    expect(value).toBeCloseTo(2500);
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
