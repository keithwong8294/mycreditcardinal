import Stripe from "stripe";

// Lazy singleton — throws only when actually used, not on import.
// This prevents build failures when STRIPE_SECRET_KEY is not yet configured.
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("Missing STRIPE_SECRET_KEY environment variable");
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-03-25.dahlia",
    });
  }
  return _stripe;
}

// Convenience alias used in route handlers
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripe() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export const STRIPE_PRICES = {
  get monthly() {
    return process.env.STRIPE_PRICE_MONTHLY ?? "";
  },
  get annual() {
    return process.env.STRIPE_PRICE_ANNUAL ?? "";
  },
} as const;
