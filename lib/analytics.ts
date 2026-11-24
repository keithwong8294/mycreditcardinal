import type { PostHog } from "posthog-js";

// PostHog is ~170 KB of JavaScript, so it is never part of the page bundle.
// It loads on demand, after the page is idle, and only when a key is set.
// Typed wrappers for every custom event in the spec are below; all of them
// are no-ops when PostHog is not configured (e.g. SSR, no key).

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
let posthogPromise: Promise<PostHog | null> | null = null;

export function loadPosthog(): Promise<PostHog | null> {
  if (typeof window === "undefined" || !POSTHOG_KEY) return Promise.resolve(null);
  posthogPromise ??= import("posthog-js")
    .then(({ default: posthog }) => {
      posthog.init(POSTHOG_KEY, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
        capture_pageview: false, // fired manually to get correct SPA paths
        capture_pageleave: true,
        person_profiles: "identified_only",
      });
      return posthog;
    })
    .catch(() => null);
  return posthogPromise;
}

export function capture(event: string, props?: Record<string, unknown>) {
  if (typeof window === "undefined" || !POSTHOG_KEY) return;
  loadPosthog().then((ph) => ph?.capture(event, props));
}

// ── Wallet events ─────────────────────────────────────────────────────────────

export function trackCardAdded(cardId: string, cardName: string, personId: string) {
  capture("card_added", { card_id: cardId, card_name: cardName, person_id: personId });
}

export function trackCardRemoved(cardId: string, cardName: string, personId: string) {
  capture("card_removed", { card_id: cardId, card_name: cardName, person_id: personId });
}

// ── Simulator events ──────────────────────────────────────────────────────────

export function trackSpendUpdated(categoryId: string, amount: number, month: string | null) {
  capture("spend_updated", { category_id: categoryId, amount, month: month ?? "annual" });
}

// ── Optimizer events ──────────────────────────────────────────────────────────

export function trackOptimizerViewed() {
  capture("optimizer_viewed");
}

export function trackOptimizerCardAdded(cardId: string, cardName: string, estimatedGain: number) {
  capture("optimizer_card_added", { card_id: cardId, card_name: cardName, estimated_gain: estimatedGain });
}

// ── Monetization events ───────────────────────────────────────────────────────

export function trackProUpgradeClicked(source: string) {
  capture("pro_upgrade_clicked", { source });
}

export function trackProSubscribed(plan: "monthly" | "annual") {
  capture("pro_subscribed", { plan });
}

export function trackTrialStarted() {
  capture("trial_started");
}

export function trackTrialExpired() {
  capture("trial_expired");
}

// ── Report events ─────────────────────────────────────────────────────────────

export function trackHealthReportOpened(month: string) {
  capture("health_report_opened", { month });
}
