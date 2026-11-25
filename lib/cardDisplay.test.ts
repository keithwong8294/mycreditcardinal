import { describe, expect, it } from "vitest";
import { CARDS } from "./cards";
import { categoryValue, sortCards, welcomeBonusValue } from "./cardDisplay";

const INDEX = new Map(CARDS.map((c, i) => [c.id, i]));

describe("sortCards", () => {
  it("sorts by annual fee both ways", () => {
    const asc = sortCards(CARDS, "fee-asc", INDEX);
    const desc = sortCards(CARDS, "fee-desc", INDEX);
    expect(asc[0].fee).toBe(0);
    expect(desc[0].fee).toBe(Math.max(...CARDS.map((c) => c.fee)));
  });

  it("sorts by welcome bonus value", () => {
    const vals = sortCards(CARDS, "bonus", INDEX).map(welcomeBonusValue);
    expect(vals).toEqual([...vals].sort((a, b) => b - a));
  });

  it("sorts by value in a category", () => {
    const vals = sortCards(CARDS, "cat:dining", INDEX).map((c) => categoryValue(c, "dining"));
    expect(vals).toEqual([...vals].sort((a, b) => b - a));
  });

  it("puts the last catalog entry first for newest", () => {
    expect(sortCards(CARDS, "newest", INDEX)[0].id).toBe(CARDS[CARDS.length - 1].id);
  });

  it("keeps catalog order for featured and does not mutate input", () => {
    const copy = [...CARDS];
    expect(sortCards(CARDS, "featured", INDEX)).toEqual(CARDS);
    sortCards(CARDS, "name", INDEX);
    expect(CARDS).toEqual(copy);
  });
});
