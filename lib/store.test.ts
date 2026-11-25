import { describe, it, expect } from "vitest";
import { refreshPeople } from "./store";
import { CARDS } from "./cards";

describe("refreshPeople", () => {
  it("replaces a saved, stale card copy with the current card data", () => {
    const savor = CARDS.find((c) => c.id === "c1_savorone")!;
    const stale = { ...savor, pools_into: undefined, earn_json: { ...savor.earn_json, groceries: 1 } };
    const [person] = refreshPeople([{ id: "p", name: "You", sortOrder: 0, cards: [{ id: "w", card: stale, config: { rotQ: [null, null, null, null], custom: [] } }] }], []);
    expect(person.cards[0].card).toBe(savor);
    expect(person.cards[0].id).toBe("w");
  });

  it("keeps cards it can't find", () => {
    const ghost = { ...CARDS[0], id: "gone" };
    const [person] = refreshPeople([{ id: "p", name: "You", sortOrder: 0, cards: [{ id: "w", card: ghost, config: { rotQ: [null, null, null, null], custom: [] } }] }], []);
    expect(person.cards[0].card).toBe(ghost);
  });
});

import { nextPlayerName } from "./store";

describe("nextPlayerName", () => {
  it("numbers people Player 1, 2, 3 and skips names in use", () => {
    expect(nextPlayerName([])).toBe("Player 1");
    expect(nextPlayerName([{ name: "Player 1" }])).toBe("Player 2");
    expect(nextPlayerName([{ name: "Player 1" }, { name: "Player 3" }])).toBe("Player 4");
    expect(nextPlayerName([{ name: "Keith" }, { name: "Player 2" }])).toBe("Player 3");
  });

  it("renames the old default 'You' to Player 1 on load", () => {
    expect(refreshPeople([{ id: "p", name: "You", sortOrder: 0, cards: [] }], [])[0].name).toBe("Player 1");
  });
});
