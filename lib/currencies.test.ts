import { describe, it, expect } from "vitest";
import { CURRENCIES } from "./currencies";

const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

describe("MCC values", () => {
  it("are the median of their published sources", () => {
    for (const c of CURRENCIES) {
      const v = Object.values(c.sources ?? {});
      if (v.length) expect(c.composite, c.id).toBe(median(v));
    }
  });
  it("sit between cash-out and best case", () => {
    for (const c of CURRENCIES) {
      expect(c.composite, c.id).toBeGreaterThanOrEqual(c.floor);
      expect(c.ceiling, c.id).toBeGreaterThanOrEqual(c.composite);
    }
  });
});
