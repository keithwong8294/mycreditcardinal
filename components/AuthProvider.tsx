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
import { createClient } from "@/lib/supabase/client";
import { hydrateFromSupabase, createSyncer } from "@/lib/sync";

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
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<PlanName | null>(null);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [planLoading, setPlanLoading] = useState(true);

  const syncedUserIdRef = useRef<string | null>(null);
  const syncerTeardownRef = useRef<(() => void) | null>(null);

  useEffect(() => {
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

    return () => {
      subscription.unsubscribe();
      syncerTeardownRef.current?.();
    };
  }, []);

  const value = useMemo(
    () => ({ user, loading, plan, trialEndsAt, planLoading }),
    [user, loading, plan, trialEndsAt, planLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
