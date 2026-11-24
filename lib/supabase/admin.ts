import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client (bypasses RLS). Server-only.
 * Returns null when SUPABASE_SERVICE_ROLE_KEY isn't configured so callers
 * can degrade gracefully instead of crashing.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
