"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { createClient } from "@/lib/supabase/client";

export interface ProCheckResult {
  /** True if on an active Pro subscription */
  isPro: boolean;
  /** True if on the 30-day trial (may also be expired) */
  isTrial: boolean;
  /** True if trial has ended and user hasn't subscribed */
  isExpired: boolean;
  /** Days remaining on trial, or null if not on trial */
  daysLeft: number | null;
  /** True while fetching plan data */
  loading: boolean;
}

function computeDaysLeft(trialEndsAt: string | null): number | null {
  if (!trialEndsAt) return null;
  const diff = new Date(trialEndsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function useProCheck(): ProCheckResult {
  const { user } = useAuth();
  const [plan, setPlan] = useState<"trial" | "free" | "pro" | null>(null);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    supabase
      .from("users")
      .select("plan, trial_ends_at")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setPlan(data.plan as "trial" | "free" | "pro");
          setTrialEndsAt(data.trial_ends_at ?? null);
        }
        setLoading(false);
      });
  }, [user]);

  const isPro = plan === "pro";
  const isTrial = plan === "trial";
  const daysLeft = isTrial ? computeDaysLeft(trialEndsAt) : null;
  const isExpired = isTrial && daysLeft !== null && daysLeft <= 0;

  // During loading, assume trial (full access) so UI doesn't flash locked
  if (loading) {
    return { isPro: true, isTrial: true, isExpired: false, daysLeft: null, loading: true };
  }

  return { isPro: isPro || isTrial, isTrial, isExpired, daysLeft, loading: false };
}
