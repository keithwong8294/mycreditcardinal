"use client";

import { useState } from "react";
import { useStore, HOUSEHOLD_ID } from "@/lib/store";
import {
  averageMonthlySpend,
  BENCHMARK_SOURCE,
  HOUSEHOLD_SIZES,
  type HouseholdSize,
} from "@/lib/spendingBenchmarks";

/**
 * "US average spending" button: fills every category's typical monthly spend
 * with BLS Consumer Expenditure Survey averages for a 1-4 person household.
 * In per-person mode the household total is split evenly between people.
 */
export function AverageSpendPreset({ merged }: { merged: boolean }) {
  const people = useStore((s) => s.people);
  const replaceSpend = useStore((s) => s.replaceSpend);
  const [open, setOpen] = useState(false);
  const [applied, setApplied] = useState<HouseholdSize | null>(null);

  const split = !merged && people.length > 1 ? people.length : 1;

  function apply(size: HouseholdSize) {
    const household = averageMonthlySpend(size);
    if (merged) {
      replaceSpend(HOUSEHOLD_ID, household);
    } else {
      const share = Object.fromEntries(
        Object.entries(household).map(([id, v]) => [
          id,
          Math.round(v / split / 5) * 5,
        ]),
      );
      for (const p of people) replaceSpend(p.id, share);
    }
    setApplied(size);
  }

  const preview = applied ? averageMonthlySpend(applied) : null;
  const total = preview ? Object.values(preview).reduce((a, b) => a + b, 0) : 0;

  return (
    <>
      <div className="min-w-0">
        <div className="text-[12px] font-medium text-tertiary mb-1">
          Starting point
        </div>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className={`px-3 py-1.5 text-[13px] font-medium rounded-lg border whitespace-nowrap transition-colors duration-150 ${
            open
              ? "bg-ink text-paper border-ink"
              : "bg-white text-primary border-subtle hover:bg-surface"
          }`}
        >
          US average spending
        </button>
      </div>
      {open && (
        <div className="basis-full max-w-[640px] p-3 bg-white border border-subtle rounded-lg text-[13px] text-secondary space-y-2.5">
          <p>
            Fill every category with what a typical US household spends a month,
            then adjust from there.
            {split > 1 &&
              ` The household total is split evenly across your ${split} people.`}
          </p>
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Household size"
          >
            {HOUSEHOLD_SIZES.map((s) => (
              <button
                key={String(s.value)}
                type="button"
                aria-pressed={applied === s.value}
                onClick={() => apply(s.value)}
                className={`px-3 py-1.5 rounded-lg border font-medium transition-colors duration-150 ${
                  applied === s.value
                    ? "bg-cardinal text-white border-cardinal"
                    : "bg-white text-primary border-subtle hover:bg-surface"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          {applied !== null && (
            <p className="text-primary">
              Filled in about <strong>${total.toLocaleString()}/month</strong>{" "}
              for the household. This replaces your typical spending; one-month
              changes are kept.
            </p>
          )}
          <p className="text-[12px] text-tertiary">
            Source:{" "}
            <a
              href={BENCHMARK_SOURCE.url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              {BENCHMARK_SOURCE.name}, {BENCHMARK_SOURCE.year}
            </a>{" "}
            (collected by the Census Bureau). Household sizes are scaled with
            BLS spending-by-household-size ratios. Streaming, online shopping
            and the travel/transit split are estimates, since the survey
            doesn&apos;t track them separately.
          </p>
        </div>
      )}
    </>
  );
}
