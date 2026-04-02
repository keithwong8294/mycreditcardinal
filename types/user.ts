export type Plan = "trial" | "free" | "pro";

export interface User {
  id: string;
  email: string;
  name: string;
  plan: Plan;
  trialEndsAt: string | null;
  stripeCustomerId: string | null;
  deviceFingerprint: string | null;
  createdAt: string;
}
