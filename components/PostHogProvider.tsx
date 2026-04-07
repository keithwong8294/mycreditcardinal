"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, Suspense, type ReactNode } from "react";
import { useAuth } from "./AuthProvider";

// ── Init ──────────────────────────────────────────────────────────────────────

if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    capture_pageview: false,   // we fire manually to get correct SPA paths
    capture_pageleave: true,
    person_profiles: "identified_only",
  });
}

// ── Page view tracker (needs Suspense for useSearchParams) ───────────────────

function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ph = usePostHog();

  useEffect(() => {
    ph?.capture("$pageview", { $current_url: window.location.href });
  }, [pathname, searchParams, ph]);

  return null;
}

// ── User identity sync ────────────────────────────────────────────────────────

function UserIdentifier() {
  const { user } = useAuth();
  const ph = usePostHog();

  useEffect(() => {
    if (!ph) return;
    if (user) {
      ph.identify(user.id, {
        email: user.email,
        name: user.user_metadata?.full_name ?? user.user_metadata?.name,
      });
    } else {
      ph.reset();
    }
  }, [user, ph]);

  return null;
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function PostHogProvider({ children }: { children: ReactNode }) {
  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PageViewTracker />
      </Suspense>
      <UserIdentifier />
      {children}
    </PHProvider>
  );
}
