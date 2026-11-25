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
      for (const id of p.cardIds) {
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

describe("scoreWallet", () => {
  it("is zero for an empty wallet", () => {
    expect(scoreWallet([], SPEND).net).toBe(0);
  });

  it("subtracts fees and caps credits at each card's fee", () => {
    const w = buildWallet([{ cardId: "amex_plat" }], SPEND);
    const all = scoreWallet(w, SPEND, "composite", "all");
    expect(all.fees).toBe(CARD_MAP.amex_plat.fee);
    expect(all.credits).toBeLessThanOrEqual(all.fees);
    const none = scoreWallet(w, SPEND, "composite", "none");
    expect(none.credits).toBe(0);
    expect(none.net).toBeCloseTo(none.rewards - none.fees);
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
