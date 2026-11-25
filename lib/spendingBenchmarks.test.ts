import { describe, it, expect } from "vitest";
import { averageMonthlySpend, HOUSEHOLD_SIZES } from "./spendingBenchmarks";
import { CATEGORY_IDS } from "./categories";

describe("averageMonthlySpend", () => {
  it("covers every simulator category for every household size", () => {
    for (const { value } of HOUSEHOLD_SIZES) {
      const spend = averageMonthlySpend(value);
      expect(Object.keys(spend).sort()).toEqual([...CATEGORY_IDS].sort());
      for (const v of Object.values(spend)) expect(v).toBeGreaterThanOrEqual(0);
    }
  });

  it("uses BLS 2025 food figures for the average household", () => {
    const s = averageMonthlySpend("avg");
    expect(s.groceries).toBe(540); // $6,491 / 12
    expect(s.dining).toBe(345); // $4,142 / 12
  });

  it("bigger households spend more in total", () => {
    const total = (s: Record<string, number>) => Object.values(s).reduce((a, b) => a + b, 0);
    const totals = ([1, 2, 3, 4] as const).map((n) => total(averageMonthlySpend(n)));
    for (let i = 1; i < totals.length; i++) expect(totals[i]).toBeGreaterThan(totals[i - 1]);
  });
});
