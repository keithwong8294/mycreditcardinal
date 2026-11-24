"use client";

import Link from "next/link";
import { useProCheck } from "@/lib/useProCheck";

export function TrialBanner() {
  const { isTrial, isExpired, daysLeft, loading } = useProCheck();

  if (loading) return null;

  if (isExpired) {
    return (
      <div className="bg-amber/10 border-b border-amber/30 px-4 py-2 flex items-center justify-between gap-3">
        <span className="text-[13px] text-amber font-medium">
          Your trial has ended. Upgrade to keep Pro features.
        </span>
        <Link
          href="/settings"
          className="shrink-0 text-[13px] font-semibold px-3 py-1 bg-ink hover:bg-ink/85 text-paper rounded-md transition-colors"
        >
          Upgrade
        </Link>
      </div>
    );
  }

  if (isTrial && daysLeft !== null && daysLeft <= 7) {
    return (
      <div className="bg-surface border-b border-subtle px-4 py-2 flex items-center justify-between gap-3">
        <span className="text-[13px] text-secondary">
          {daysLeft === 0
            ? "Your trial expires today."
            : `${daysLeft} day${daysLeft !== 1 ? "s" : ""} left on your free trial.`}
        </span>
        <Link
          href="/settings"
          className="shrink-0 text-[13px] font-medium text-green hover:underline"
        >
          Upgrade to Pro →
        </Link>
      </div>
    );
  }

  return null;
}
