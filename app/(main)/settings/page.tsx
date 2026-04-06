"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { signOut } from "@/lib/supabase/actions";

interface UserRecord {
  plan: "trial" | "free" | "pro";
  trial_ends_at: string | null;
  name: string | null;
  email: string;
  stripe_customer_id: string | null;
}

function planLabel(plan: string): string {
  if (plan === "trial") return "Trial";
  if (plan === "pro") return "Pro";
  return "Free";
}

function daysLeft(trialEndsAt: string | null): number | null {
  if (!trialEndsAt) return null;
  const diff = new Date(trialEndsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

async function redirectToUrl(endpoint: string, body: object) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json() as { url?: string; error?: string };
  if (data.url) {
    window.location.href = data.url;
  } else {
    alert(data.error ?? "Something went wrong.");
  }
}

export default function SettingsPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const upgraded = searchParams.get("upgraded") === "1";

  const [dbUser, setDbUser] = useState<UserRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<"monthly" | "annual" | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase
      .from("users")
      .select("plan, trial_ends_at, name, email, stripe_customer_id")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        setDbUser(data as UserRecord | null);
        setLoading(false);
      });
  }, [user]);

  const displayName =
    dbUser?.name ??
    user?.user_metadata?.full_name ??
    user?.user_metadata?.name ??
    user?.email?.split("@")[0] ??
    "—";

  const plan = dbUser?.plan ?? "free";
  const trialDays = daysLeft(dbUser?.trial_ends_at ?? null);
  const isPro = plan === "pro";
  const isTrial = plan === "trial";

  async function handleCheckout(cadence: "monthly" | "annual") {
    setCheckoutLoading(cadence);
    const priceId =
      cadence === "monthly"
        ? process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY
        : process.env.NEXT_PUBLIC_STRIPE_PRICE_ANNUAL;
    await redirectToUrl("/api/stripe/checkout", { priceId });
    setCheckoutLoading(null);
  }

  async function handlePortal() {
    setPortalLoading(true);
    await redirectToUrl("/api/stripe/portal", {});
    setPortalLoading(false);
  }

  return (
    <div className="p-6 space-y-5 max-w-xl">
      {/* Page header */}
      <div>
        <h1 className="text-[14px] font-semibold text-secondary uppercase tracking-wider">Settings</h1>
      </div>

      {/* Upgraded confirmation */}
      {upgraded && (
        <div className="bg-green/10 border border-green/30 rounded-lg px-4 py-3 text-[13px] text-green font-medium">
          You&apos;re now on Pro. Welcome to the full experience!
        </div>
      )}

      {/* Account */}
      <div className="bg-white border border-subtle rounded-lg">
        <div className="px-4 py-3 border-b border-subtle">
          <div className="text-[10px] font-semibold text-tertiary uppercase tracking-wider">Account</div>
        </div>
        <div className="px-4 py-3 space-y-2">
          <div className="flex justify-between text-[13px]">
            <span className="text-secondary">Name</span>
            <span className="text-primary font-medium">{displayName}</span>
          </div>
          <div className="flex justify-between text-[13px]">
            <span className="text-secondary">Email</span>
            <span className="text-primary">{dbUser?.email ?? user?.email ?? "—"}</span>
          </div>
          <div className="pt-2 border-t border-subtle">
            <form action={signOut}>
              <button
                type="submit"
                className="text-[12px] text-red hover:text-red/80 transition-colors duration-150"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Plan */}
      <div className="bg-white border border-subtle rounded-lg">
        <div className="px-4 py-3 border-b border-subtle flex items-center justify-between">
          <div className="text-[10px] font-semibold text-tertiary uppercase tracking-wider">Plan</div>
          {!loading && (
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                isPro
                  ? "bg-green/10 text-green"
                  : isTrial
                  ? "bg-amber/10 text-amber"
                  : "bg-surface text-secondary border border-subtle"
              }`}
            >
              {planLabel(plan)}
            </span>
          )}
        </div>
        <div className="px-4 py-3 space-y-3">
          {loading ? (
            <div className="text-[13px] text-tertiary">Loading…</div>
          ) : isPro ? (
            <>
              <p className="text-[13px] text-secondary">
                You&apos;re on Pro. Enjoy unlimited cards, household members, and full optimizer access.
              </p>
              {dbUser?.stripe_customer_id && (
                <button
                  onClick={handlePortal}
                  disabled={portalLoading}
                  className="text-[12px] font-medium px-3 py-1.5 rounded-md border border-subtle text-secondary hover:text-primary hover:border-medium transition-colors duration-150 disabled:opacity-50"
                >
                  {portalLoading ? "Opening…" : "Manage billing →"}
                </button>
              )}
            </>
          ) : isTrial ? (
            <>
              <p className="text-[13px] text-secondary">
                You&apos;re on a free trial with full Pro access.
                {trialDays !== null && trialDays > 0
                  ? ` ${trialDays} day${trialDays !== 1 ? "s" : ""} remaining.`
                  : " Your trial has ended."}
              </p>
              <p className="text-[12px] text-tertiary">Subscribe to keep Pro features after your trial.</p>
              <UpgradeButtons
                checkoutLoading={checkoutLoading}
                onCheckout={handleCheckout}
              />
            </>
          ) : (
            <>
              <p className="text-[13px] text-secondary">
                You&apos;re on the free tier. Upgrade to unlock unlimited cards, household members, and full optimizer access.
              </p>
              <UpgradeButtons
                checkoutLoading={checkoutLoading}
                onCheckout={handleCheckout}
              />
            </>
          )}
        </div>
      </div>

      {/* Pro features comparison */}
      {!isPro && (
        <div className="bg-white border border-subtle rounded-lg">
          <div className="px-4 py-3 border-b border-subtle">
            <div className="text-[10px] font-semibold text-tertiary uppercase tracking-wider">Free vs Pro</div>
          </div>
          <div className="divide-y divide-subtle">
            {[
              { feature: "Card browser", free: true, pro: true },
              { feature: "Spend simulator", free: true, pro: true },
              { feature: "Cards per person", free: "Up to 5", pro: "Unlimited" },
              { feature: "Household members", free: "1 person", pro: "Unlimited" },
              { feature: "Optimizer results", free: "Top 2", pro: "All 8" },
              { feature: "What-if analysis", free: "✓", pro: "✓" },
              { feature: "Wallet Health Report", free: "Preview only", pro: "Full monthly report" },
              { feature: "Export & sharing", free: "—", pro: "✓" },
            ].map(({ feature, free, pro }) => (
              <div key={feature} className="grid grid-cols-3 px-4 py-2 text-[12px]">
                <span className="text-secondary">{feature}</span>
                <span className="text-center text-tertiary">
                  {free === true ? "✓" : free === false ? "—" : free}
                </span>
                <span className="text-center text-green font-medium">
                  {pro === true ? "✓" : pro === false ? "—" : pro}
                </span>
              </div>
            ))}
            <div className="grid grid-cols-3 px-4 py-2 text-[10px] font-semibold text-tertiary uppercase tracking-wider">
              <span />
              <span className="text-center">Free</span>
              <span className="text-center text-green">Pro</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UpgradeButtons({
  checkoutLoading,
  onCheckout,
}: {
  checkoutLoading: "monthly" | "annual" | null;
  onCheckout: (cadence: "monthly" | "annual") => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row gap-2 pt-1">
      <button
        onClick={() => onCheckout("annual")}
        disabled={checkoutLoading !== null}
        className="flex-1 flex flex-col items-center px-4 py-2.5 bg-green hover:bg-green/90 text-white rounded-md transition-colors duration-150 disabled:opacity-50"
      >
        <span className="text-[13px] font-semibold">
          {checkoutLoading === "annual" ? "Redirecting…" : "Annual — $59.99/yr"}
        </span>
        <span className="text-[11px] text-white/70">Save 37% vs monthly</span>
      </button>
      <button
        onClick={() => onCheckout("monthly")}
        disabled={checkoutLoading !== null}
        className="flex-1 px-4 py-2.5 border border-subtle text-primary hover:border-medium rounded-md text-[13px] font-medium transition-colors duration-150 disabled:opacity-50"
      >
        {checkoutLoading === "monthly" ? "Redirecting…" : "Monthly — $7.99/mo"}
      </button>
    </div>
  );
}
