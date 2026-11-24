"use client";

import { useAuth } from "@/components/AuthProvider";

export interface ProCheckResult {
  /** True if Pro features should be unlocked */
  isPro: boolean;
  /** True if on the 30-day trial (may also be expired) */
  isTrial: boolean;
  /** True if trial has ended and user hasn't subscribed */
  isExpired: boolean;
  /** Days remaining on trial, or null if not on trial */
  daysLeft: number | null;
  /** True while fetching plan data */
  loading: boolean;
  /** True when browsing without an account (demo mode) */
  isGuest: boolean;
}

function computeDaysLeft(trialEndsAt: string | null): number | null {
  if (!trialEndsAt) return null;
  const diff = new Date(trialEndsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}

/**
 * Plan gate. Reads the plan that AuthProvider fetched once, instead of every
 * caller issuing its own Supabase query.
 *
 * Guests (continue without signing in) get full access so the app demos well;
 * their data never leaves the device anyway.
 */
export function useProCheck(): ProCheckResult {
  const { user, loading: authLoading, plan, trialEndsAt, planLoading } = useAuth();

  if (authLoading) {
    return { isPro: true, isTrial: false, isExpired: false, daysLeft: null, loading: true, isGuest: false };
  }

  if (!user) {
    return { isPro: true, isTrial: false, isExpired: false, daysLeft: null, loading: false, isGuest: true };
  }

  // During loading, assume full access so UI doesn't flash locked
  if (planLoading) {
    return { isPro: true, isTrial: true, isExpired: false, daysLeft: null, loading: true, isGuest: false };
  }

  const isTrial = plan === "trial";
  const daysLeft = isTrial ? computeDaysLeft(trialEndsAt) : null;
  const isExpired = isTrial && daysLeft !== null && daysLeft <= 0;

  return {
    isPro: plan === "pro" || (isTrial && !isExpired),
    isTrial,
    isExpired,
    daysLeft,
    loading: false,
    isGuest: false,
  };
}
