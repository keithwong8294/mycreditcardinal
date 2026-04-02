import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const TRIAL_DAYS = 30;

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const fingerprint = searchParams.get("fp") ?? null;

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=no_user`);
  }

  // ── First-login setup ─────────────────────────────────────────────────────
  // Check if this user already has a record in public.users.
  const { data: existingUser } = await supabase
    .from("users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!existingUser) {
    // Determine plan based on fingerprint trial-cycling check
    let plan: "trial" | "free" = "trial";
    let trialEndsAt: string | null = new Date(
      Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

    if (fingerprint) {
      const { data: fpMatch } = await supabase
        .from("users")
        .select("id")
        .eq("device_fingerprint", fingerprint)
        .not("trial_ends_at", "is", null)
        .maybeSingle();

      if (fpMatch) {
        // Device already used a trial — start on free tier
        plan = "free";
        trialEndsAt = null;
      }
    }

    const displayName =
      user.user_metadata?.full_name ??
      user.user_metadata?.name ??
      user.email?.split("@")[0] ??
      "You";

    // Create user record
    await supabase.from("users").insert({
      id: user.id,
      email: user.email,
      name: displayName,
      plan,
      trial_ends_at: trialEndsAt,
      device_fingerprint: fingerprint,
    });

    // Create default household + first member
    const { data: household } = await supabase
      .from("households")
      .insert({ user_id: user.id, name: `${displayName}'s Wallet` })
      .select("id")
      .single();

    if (household) {
      await supabase.from("household_members").insert({
        household_id: household.id,
        name: displayName,
        sort_order: 0,
      });
    }
  }

  return NextResponse.redirect(`${origin}/browse`);
}
