import { describe, it, expect } from "vitest";
import { addMonths, dateReaching, projectSub, spendBetween, spendByCard, toDateKey, parseDateKey } from "./subTracker";
import type { RoutingResult, WalletCard } from "@/types";

const flat = (n: number) => Array<number>(12).fill(n);
const d = (s: string) => parseDateKey(s)!;

describe("date helpers", () => {
  it("adds months, clamping to the month's last day", () => {
    expect(toDateKey(addMonths(d("2026-01-31"), 1))).toBe("2026-02-28");
    expect(toDateKey(addMonths(d("2026-11-15"), 3))).toBe("2027-02-15");
  });

  it("rejects malformed dates", () => {
    expect(parseDateKey("")).toBeNull();
    expect(parseDateKey("2026/01/01")).toBeNull();
    expect(parseDateKey(undefined)).toBeNull();
  });
});

describe("spendBetween", () => {
  it("counts a whole month as that month's spend", () => {
    expect(spendBetween(d("2026-03-01"), d("2026-04-01"), flat(3100))).toBeCloseTo(3100);
  });

  it("prorates partial months by day", () => {
    // 15 of April's 30 days at $3,000/mo
    expect(spendBetween(d("2026-04-01"), d("2026-04-16"), flat(3000))).toBeCloseTo(1500);
  });

  it("uses each calendar month's own amount", () => {
    const m = flat(0);
    m[0] = 1000; // Jan
    m[1] = 2000; // Feb
    expect(spendBetween(d("2026-01-01"), d("2026-03-01"), m)).toBeCloseTo(3000);
  });

  it("repeats the year's pattern into the next year", () => {
    expect(spendBetween(d("2026-12-01"), d("2027-02-01"), flat(500))).toBeCloseTo(1000);
  });
});

describe("dateReaching", () => {
  it("finds the day spend crosses the amount", () => {
    // $30/day in April; $300 is reached at the end of the 10th day
    expect(toDateKey(dateReaching(d("2026-04-01"), 300, flat(900))!)).toBe("2026-04-10");
  });

  it("carries over into later months", () => {
    // $1,000/mo; $2,500 is reached mid-March
    const hit = dateReaching(d("2026-01-01"), 2500, flat(1000))!;
    expect(toDateKey(hit)).toBe("2026-03-16");
  });

  it("returns null with no spend", () => {
    expect(dateReaching(d("2026-01-01"), 100, flat(0))).toBeNull();
  });

  it("returns the start day for nothing left", () => {
    expect(toDateKey(dateReaching(d("2026-05-05"), 0, flat(0))!)).toBe("2026-05-05");
  });
});

describe("projectSub", () => {
  const base = { requirement: 4000, timeframeMonths: 3 };

  it("is on track when monthly spend clears the minimum in time", () => {
    const p = projectSub({ ...base, opened: d("2026-11-01"), monthly: flat(2000), today: d("2026-11-01") });
    expect(p.status).toBe("on_track");
    expect(toDateKey(p.deadline!)).toBe("2027-01-31");
    expect(toDateKey(p.projected!)).toBe("2026-12-31");
    expect(p.spent).toBe(0);
    expect(Math.abs(p.monthlyRate - 2000)).toBeLessThan(25);
  });

  it("flags a bonus that won't be met before the deadline", () => {
    const p = projectSub({ ...base, opened: d("2026-11-01"), monthly: flat(1000), today: d("2026-11-01") });
    expect(p.status).toBe("late");
    expect(p.projected! > p.deadline!).toBe(true);
    // $4,000 over 92 days ≈ $1,323/mo needed
    expect(p.neededPerMonth!).toBeCloseTo((4000 * 30.4375) / 92, 0);
  });

  it("estimates spend so far from the open date", () => {
    const p = projectSub({ ...base, opened: d("2026-10-01"), monthly: flat(1550), today: d("2026-11-01") });
    expect(p.spentIsEstimate).toBe(true);
    expect(p.spent).toBeCloseTo(1550);
    expect(p.remaining).toBeCloseTo(2450);
  });

  it("uses spend the user entered over the estimate", () => {
    const p = projectSub({ ...base, opened: d("2026-10-01"), monthly: flat(1550), spentSoFar: 3900, today: d("2026-11-01") });
    expect(p.spentIsEstimate).toBe(false);
    expect(p.remaining).toBeCloseTo(100);
    expect(p.status).toBe("on_track");
    expect(toDateKey(p.projected!)).toBe("2026-11-02");
  });

  it("reports met once spend reaches the minimum", () => {
    const p = projectSub({ ...base, opened: d("2026-08-01"), monthly: flat(2000), today: d("2026-11-01") });
    expect(p.status).toBe("met");
    expect(p.progress).toBe(1);
    expect(toDateKey(p.projected!)).toBe("2026-09-30");
  });

  it("expires after the deadline", () => {
    const p = projectSub({ ...base, opened: d("2026-01-01"), monthly: flat(100), today: d("2026-11-01") });
    expect(p.status).toBe("expired");
    expect(p.daysLeft!).toBeLessThan(0);
  });

  it("says when nothing is routed to the card", () => {
    const p = projectSub({ ...base, opened: d("2026-11-01"), monthly: flat(0), today: d("2026-11-01") });
    expect(p.status).toBe("no_spend");
    expect(p.projected).toBeNull();
  });

  it("treats a 0-month window as no deadline", () => {
    const p = projectSub({ requirement: 500, timeframeMonths: 0, opened: d("2026-11-01"), monthly: flat(100), today: d("2026-11-01") });
    expect(p.deadline).toBeNull();
    expect(p.status).toBe("on_track");
  });
});

describe("spendByCard", () => {
  it("sums primary and overflow spend per card and month", () => {
    const a = { id: "a" } as WalletCard;
    const b = { id: "b" } as WalletCard;
    const row = (wc: WalletCard, spend: number, overflow: { walletCard: WalletCard; spend: number }[] = []) => ({
      categoryId: "x", walletCard: wc, earnRate: 1, spend, points: 0, dollarValue: 0, capHit: false, override: null,
      overflow: overflow.map((o) => ({ ...o, earnRate: 1, points: 0, dollarValue: 0 })),
    });
    const months: RoutingResult[] = Array.from({ length: 12 }, () => ({ rows: [], currencyTotals: [], totalDollarValue: 0 }));
    months[0].rows = [row(a, 100, [{ walletCard: b, spend: 50 }]), row(b, 25)];
    months[1].rows = [row(a, 10)];
    const out = spendByCard(months);
    expect(out.get("a")!.slice(0, 2)).toEqual([100, 10]);
    expect(out.get("b")![0]).toBe(75);
  });
});
