import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { FP_COOKIE } from "@/lib/supabase/constants";

const TRIAL_DAYS = 30;

function fail(origin: string, code: string, detail?: string | null) {
  const url = new URL("/login", origin);
  url.searchParams.set("error", code);
  if (detail) url.searchParams.set("detail", detail.slice(0, 200));
  const res = NextResponse.redirect(url);
  res.cookies.delete({ name: FP_COOKIE, path: "/auth" });
  return res;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  // Google / Supabase report OAuth problems (e.g. redirect_uri_mismatch,
  // access_denied) via query params instead of a code.
  const providerError = searchParams.get("error");
  if (providerError) {
    return fail(
      origin,
      providerError === "access_denied" ? "access_denied" : "auth_failed",
      searchParams.get("error_description")
    );
  }

  const code = searchParams.get("code");
  if (!code) return fail(origin, "missing_code");

  // Fingerprint comes from a short-lived cookie (legacy: ?fp= query param).
  const fingerprint =
    request.cookies.get(FP_COOKIE)?.value ?? searchParams.get("fp") ?? null;

  const supabase = await createClient();
  const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) return fail(origin, "auth_failed", exchangeError.message);

  const user = data.user ?? data.session?.user;
  if (!user) return fail(origin, "no_user");

  try {
    await ensureUserRecords(supabase, user, fingerprint);
  } catch (err) {
    // Account setup problems must never block sign-in: the app works off the
    // local store and syncs once the rows exist.
    console.error("[auth/callback] first-login setup failed", err);
  }

  const res = NextResponse.redirect(new URL("/browse", origin));
  res.cookies.delete({ name: FP_COOKIE, path: "/auth" });
  return res;
}

/**
 * Create public.users + default household on first login.
 *
 * Uses the service-role client when available, because RLS has no INSERT
 * policy on public.users (so the previous user-scoped insert silently failed
 * and left new Google users without a household). Migration 004 also adds an
 * auth trigger that does the same thing as a safety net.
 */
async function ensureUserRecords(
  userClient: SupabaseClient,
  user: User,
  fingerprint: string | null
) {
  const admin = createAdminClient();
  const db = admin ?? userClient;

  const { data: existing } = await db
    .from("users")
    .select("id, device_fingerprint")
    .eq("id", user.id)
    .maybeSingle();

  // Trial-cycling check: only possible with the service role, since RLS hides
  // other users' rows from the signed-in user.
  let reusedDevice = false;
  if (fingerprint && admin) {
    const { data: fpMatch } = await admin
      .from("users")
      .select("id")
      .eq("device_fingerprint", fingerprint)
      .neq("id", user.id)
      .not("trial_ends_at", "is", null)
      .limit(1);
    reusedDevice = (fpMatch?.length ?? 0) > 0;
  }

  if (existing) {
    // Row may have been created by the DB trigger; attach fingerprint/plan.
    if (admin && fingerprint && !existing.device_fingerprint) {
      await admin
        .from("users")
        .update({
          device_fingerprint: fingerprint,
          ...(reusedDevice ? { plan: "free", trial_ends_at: null } : {}),
        })
        .eq("id", user.id);
    }
    return;
  }

  const displayName =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email?.split("@")[0] ??
    "You";

  const { error: userErr } = await db.from("users").insert({
    id: user.id,
    email: user.email,
    name: displayName,
    plan: reusedDevice ? "free" : "trial",
    trial_ends_at: reusedDevice
      ? null
      : new Date(Date.now() + TRIAL_DAYS * 86_400_000).toISOString(),
    device_fingerprint: fingerprint,
  });
  if (userErr) throw userErr;

  const { data: household, error: hhErr } = await db
    .from("households")
    .insert({ user_id: user.id, name: `${displayName}'s Wallet` })
    .select("id")
    .single();
  if (hhErr) throw hhErr;

  await db.from("household_members").insert({
    household_id: household.id,
    name: displayName,
    sort_order: 0,
  });
}
