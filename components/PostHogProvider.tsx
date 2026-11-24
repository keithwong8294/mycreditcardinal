"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, Suspense, type ReactNode } from "react";
import { useAuth } from "./AuthProvider";
import { capture, loadPosthog } from "@/lib/analytics";

const ENABLED = Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY);

/** Run once the browser is idle, so analytics never competes with first paint. */
function whenIdle(fn: () => void) {
  if ("requestIdleCallback" in window) {
    const id = window.requestIdleCallback(fn, { timeout: 4000 });
    return () => window.cancelIdleCallback(id);
  }
  const id = setTimeout(fn, 2000);
  return () => clearTimeout(id);
}

// ── Page view tracker (needs Suspense for useSearchParams) ───────────────────

function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(
    () => whenIdle(() => capture("$pageview", { $current_url: window.location.href })),
    [pathname, searchParams]
  );

  return null;
}

// ── User identity sync ────────────────────────────────────────────────────────

function UserIdentifier() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    return whenIdle(() => {
      loadPosthog().then((ph) => {
        if (!ph) return;
        if (user) {
          ph.identify(user.id, {
            email: user.email,
            name: user.user_metadata?.full_name ?? user.user_metadata?.name,
          });
        } else if (ph._isIdentified()) {
          // Only after a sign-out; resetting a guest would churn anonymous ids.
          ph.reset();
        }
      });
    });
  }, [user, loading]);

  return null;
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function PostHogProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {ENABLED && (
        <>
          <Suspense fallback={null}>
            <PageViewTracker />
          </Suspense>
          <UserIdentifier />
        </>
      )}
      {children}
    </>
  );
}
