import { describe, expect, it } from "vitest";
import { CARD_MAP } from "./cards";
import {
  WALLET_PRESETS,
  bestAdditions,
  buildWallet,
  decodeWallet,
  encodeWallet,
  scoreWallet,
  whatIfAdd,
} from "./sandbox";

const SPEND: Record<string, number> = {
  dining: 420, groceries: 610, gas: 160, travel: 250, hotels: 0, streaming: 45,
  online: 310, entertainment: 0, transit: 90, rent: 0, drugstore: 35, other: 680,
};

describe("presets", () => {
  it("only use real, active cards", () => {
    for (const p of WALLET_PRESETS) {
      for (const id of [...p.cardIds, ...(p.alternatives ?? [])]) {
        expect(CARD_MAP[id], `${p.id}: ${id}`).toBeDefined();
        expect(CARD_MAP[id].status).toBe("active");
      }
    }
  });

  it("score every preset", () => {
    for (const p of WALLET_PRESETS) {
      const s = scoreWallet(buildWallet(p.cardIds.map((cardId) => ({ cardId })), SPEND), SPEND);
      console.log(p.id, Math.round(s.net), Math.round(s.rewards), s.fees, s.returnPct.toFixed(2));
      expect(Number.isFinite(s.net)).toBe(true);
    }
  });
});

describe("preset alternatives", () => {
  it("score the same as the card they stand in for", () => {
    for (const p of WALLET_PRESETS) {
      if (!p.alternatives) continue;
      const base = scoreWallet(buildWallet(p.cardIds.map((cardId) => ({ cardId })), SPEND), SPEND).net;
      for (const alt of p.alternatives) {
        const w = buildWallet([alt].map((cardId) => ({ cardId })), SPEND);
        expect(scoreWallet(w, SPEND).net, alt).toBeCloseTo(base, 0);
      }
    }
  });
});

describe("scoreWallet", () => {
  it("is zero for an empty wallet", () => {
    expect(scoreWallet([], SPEND).net).toBe(0);
  });

  it("subtracts fees and counts credits at face value", () => {
    const w = buildWallet([{ cardId: "amex_plat" }], SPEND);
    const all = scoreWallet(w, SPEND, "composite", "all");
    expect(all.fees).toBe(CARD_MAP.amex_plat.fee);
    expect(all.credits).toBe(CARD_MAP.amex_plat.perks_json.reduce((s, p) => s + (p.annual_credit ?? 0), 0));
    expect(scoreWallet(w, SPEND, "composite", "some").credits).toBeCloseTo(all.credits / 2);
    const none = scoreWallet(w, SPEND, "composite", "none");
    expect(none.credits).toBe(0);
    expect(none.net).toBeCloseTo(none.rewards - none.fees);
  });

  it("counts Venture X's $300 credit and 10,000 anniversary miles, beating its fee", () => {
    const w = buildWallet([{ cardId: "c1_venturex" }], SPEND);
    const s = scoreWallet(w, SPEND, () => 100, "all");
    expect(s.credits).toBe(400);
    expect(s.credits - s.fees).toBe(5);
    // Anniversary miles are automatic, so they count even with no credits used.
    expect(scoreWallet(w, SPEND, () => 100, "none").credits).toBe(100);
  });
});

describe("what if", () => {
  it("adding a card to an empty wallet adds its own value", () => {
    const r = whatIfAdd([], SPEND, CARD_MAP.wf_active_cash);
    expect(r.delta).toBeCloseTo(scoreWallet(buildWallet([{ cardId: "wf_active_cash" }], SPEND), SPEND).net);
  });

  it("ranks additions best first and skips held cards", () => {
    const w = buildWallet([{ cardId: "cfu" }], SPEND);
    const adds = bestAdditions(w, SPEND);
    expect(adds.length).toBeGreaterThan(0);
    expect(adds.some((a) => a.card.id === "cfu")).toBe(false);
    for (let i = 1; i < adds.length; i++) expect(adds[i - 1].delta).toBeGreaterThanOrEqual(adds[i].delta);
  });
});

describe("share links", () => {
  it("round-trips cards and custom picks", () => {
    const w = buildWallet([{ cardId: "csp" }, { cardId: "citi_custom_cash", config: { rotQ: [null, null, null, null], custom: ["gas"] } }], SPEND);
    const code = encodeWallet(w);
    expect(code).toBe("csp.citi_custom_cash~gas");
    expect(decodeWallet(code)).toEqual([
      { cardId: "csp" },
      { cardId: "citi_custom_cash", config: { rotQ: [null, null, null, null], custom: ["gas"] } },
    ]);
  });

  it("ignores unknown cards, bad picks and duplicates", () => {
    expect(decodeWallet("nope.csp.csp.citi_custom_cash~notacat")).toEqual([
      { cardId: "csp" },
      { cardId: "citi_custom_cash" },
    ]);
    expect(decodeWallet(null)).toEqual([]);
  });
});

describe("sign-up bonuses in the score", () => {
  it("count in year 1 only, and only when the spending reaches them", () => {
    const w = buildWallet([{ cardId: "csp" }], SPEND);
    const s = scoreWallet(w, SPEND);
    expect(s.subs).toBeGreaterThan(0);
    expect(s.firstYear).toBeCloseTo(s.net + s.subs);
    const tiny = { ...Object.fromEntries(Object.keys(SPEND).map((k) => [k, 0])), other: 100 };
    expect(scoreWallet(buildWallet([{ cardId: "csp" }], tiny), tiny).subs).toBe(0);
  });
});
