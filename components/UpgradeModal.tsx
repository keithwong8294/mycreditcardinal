"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  reason: "card_limit" | "person_limit" | "optimizer" | "export" | "profile_limit" | "generic";
}

const REASON_COPY: Record<UpgradeModalProps["reason"], { title: string; body: string }> = {
  card_limit: {
    title: "5-card limit reached",
    body: "Free accounts can hold up to 5 cards. Upgrade to Pro for unlimited cards across unlimited people.",
  },
  person_limit: {
    title: "1-person limit reached",
    body: "Free accounts support 1 household member. Upgrade to Pro to add more people and track multiple wallets.",
  },
  optimizer: {
    title: "Optimizer results locked",
    body: "Free accounts see the top 2 optimizer results. Upgrade to Pro to unlock all 8 recommendations and what-if analysis.",
  },
  export: {
    title: "Export is a Pro feature",
    body: "Upgrade to Pro to export your wallet and spend analysis as a PDF or shareable link.",
  },
  profile_limit: {
    title: "Multiple spend profiles are Pro-only",
    body: "Free accounts get 1 spend profile. Upgrade to Pro for unlimited spending scenarios.",
  },
  generic: {
    title: "Upgrade to Pro",
    body: "Unlock unlimited cards, household members, full optimizer results, monthly health reports, and more.",
  },
};

async function redirectToCheckout(cadence: "monthly" | "annual") {
  const priceId =
    cadence === "monthly"
      ? process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY
      : process.env.NEXT_PUBLIC_STRIPE_PRICE_ANNUAL;

  const res = await fetch("/api/stripe/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ priceId }),
  });
  const data = await res.json() as { url?: string; error?: string };
  if (data.url) window.location.href = data.url;
  else alert(data.error ?? "Something went wrong. Please try again.");
}

export function UpgradeModal({ open, onClose, reason }: UpgradeModalProps) {
  const [loading, setLoading] = useState<"monthly" | "annual" | null>(null);
  const copy = REASON_COPY[reason];

  async function handleCheckout(cadence: "monthly" | "annual") {
    setLoading(cadence);
    await redirectToCheckout(cadence);
    setLoading(null);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-[15px] font-semibold text-primary">{copy.title}</DialogTitle>
        </DialogHeader>

        <p className="text-[13px] text-secondary">{copy.body}</p>

        {/* Feature highlights */}
        <ul className="space-y-1.5">
          {[
            "Unlimited cards & household members",
            "All 8 optimizer recommendations",
            "Monthly Wallet Health Report",
            "Export & shareable wallet links",
          ].map((feat) => (
            <li key={feat} className="flex items-center gap-2 text-[12px] text-secondary">
              <span className="text-green font-semibold">✓</span>
              {feat}
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-2 pt-1">
          <button
            onClick={() => handleCheckout("annual")}
            disabled={loading !== null}
            className="flex flex-col items-center px-4 py-2.5 bg-green hover:bg-green/90 text-white rounded-md transition-colors duration-150 disabled:opacity-50"
          >
            <span className="text-[13px] font-semibold">
              {loading === "annual" ? "Redirecting…" : "Annual — $59.99/yr"}
            </span>
            <span className="text-[11px] text-white/70">Save 37% vs monthly</span>
          </button>
          <button
            onClick={() => handleCheckout("monthly")}
            disabled={loading !== null}
            className="px-4 py-2 border border-subtle text-primary hover:border-medium rounded-md text-[13px] font-medium transition-colors duration-150 disabled:opacity-50"
          >
            {loading === "monthly" ? "Redirecting…" : "Monthly — $7.99/mo"}
          </button>
          <button
            onClick={onClose}
            className="text-[12px] text-tertiary hover:text-secondary text-center transition-colors"
          >
            Maybe later
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
