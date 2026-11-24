"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";

export type PlanName = "trial" | "free" | "pro";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  /** Plan row from public.users (null for guests or while loading). */
  plan: PlanName | null;
  trialEndsAt: string | null;
  planLoading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  plan: null,
  trialEndsAt: null,
  planLoading: true,
});

export function useAuth() {
  return useContext(AuthContext);
}

/**
 * Client-side auth state. The session is read from cookies in the browser
 * (no server round-trip in the root layout), so marketing/legal pages stay
 * static and every page render avoids an extra Supabase Auth request.
 * The plan is fetched once here and shared, instead of once per component.
 *
 * Guests (the demo path) have no Supabase session cookie, so the Supabase
 * client and sync code (~60 KB gzipped) are only downloaded when one exists.
 * Every sign-in ends in a full page load via /auth/callback, so a guest who
 * signs in is picked up on that load.
 */
function hasSessionCookie() {
  return document.cookie.split(";").some((c) => {
    const name = c.trim().split("=")[0];
    return name.startsWith("sb-") && name.includes("-auth-token");
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<PlanName | null>(null);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [planLoading, setPlanLoading] = useState(true);

  const syncedUserIdRef = useRef<string | null>(null);
  const syncerTeardownRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!hasSessionCookie()) {
      setLoading(false);
      setPlanLoading(false);
      return;
    }

    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    Promise.all([import("@/lib/supabase/client"), import("@/lib/sync")])
      .then(([{ createClient }, { hydrateFromSupabase, createSyncer }]) => {
        if (cancelled) return;
        const supabase = createClient();

        function startSync(nextUser: User) {
          if (syncedUserIdRef.current === nextUser.id) return;
          syncedUserIdRef.current = nextUser.id;
          syncerTeardownRef.current?.();
          syncerTeardownRef.current = null;

          hydrateFromSupabase(nextUser.id)
            .then(() => {
              if (syncedUserIdRef.current === nextUser.id) {
                syncerTeardownRef.current = createSyncer(nextUser.id);
              }
            })
            .catch(console.error);

          supabase
            .from("users")
            .select("plan, trial_ends_at")
            .eq("id", nextUser.id)
            .maybeSingle()
            .then(({ data }) => {
              setPlan((data?.plan as PlanName | undefined) ?? null);
              setTrialEndsAt(data?.trial_ends_at ?? null);
              setPlanLoading(false);
            });
        }

        function stopSync() {
          syncedUserIdRef.current = null;
          syncerTeardownRef.current?.();
          syncerTeardownRef.current = null;
          setPlan(null);
          setTrialEndsAt(null);
          setPlanLoading(false);
        }

        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
          const nextUser = session?.user ?? null;
          setUser(nextUser);
          setLoading(false);
          if (nextUser) startSync(nextUser);
          else stopSync();
        });
        unsubscribe = () => subscription.unsubscribe();
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
        setPlanLoading(false);
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
      syncerTeardownRef.current?.();
    };
  }, []);

  const value = useMemo(
    () => ({ user, loading, plan, trialEndsAt, planLoading }),
    [user, loading, plan, trialEndsAt, planLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
