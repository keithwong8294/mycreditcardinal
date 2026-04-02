"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { hydrateFromSupabase, createSyncer } from "@/lib/sync";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({
  initialUser,
  children,
}: {
  initialUser: User | null;
  children: ReactNode;
}) {
  const [user, setUser] = useState<User | null>(initialUser);
  const [loading, setLoading] = useState(!initialUser);
  const syncerTeardownRef = useRef<(() => void) | null>(null);

  // Hydrate on first render if we already have a user from the server
  useEffect(() => {
    if (initialUser) {
      hydrateFromSupabase(initialUser.id).catch(console.error);
      syncerTeardownRef.current = createSyncer(initialUser.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const supabase = createClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      setLoading(false);

      if (event === "SIGNED_IN" && nextUser) {
        // Tear down any previous syncer, then hydrate + start fresh one
        syncerTeardownRef.current?.();
        hydrateFromSupabase(nextUser.id).then(() => {
          syncerTeardownRef.current = createSyncer(nextUser.id);
        }).catch(console.error);
      }

      if (event === "SIGNED_OUT") {
        syncerTeardownRef.current?.();
        syncerTeardownRef.current = null;
      }
    });

    return () => {
      subscription.unsubscribe();
      syncerTeardownRef.current?.();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
