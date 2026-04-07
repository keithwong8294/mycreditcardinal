import posthog from "posthog-js";

// Typed wrappers for every custom event in the spec.
// All functions are no-ops when PostHog is not initialised (e.g. SSR, no key).

function capture(event: string, props?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  posthog.capture(event, props);
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
