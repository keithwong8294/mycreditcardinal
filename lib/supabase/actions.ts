"use server";

import { redirect } from "next/navigation";
import { createClient } from "./server";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function signInWithGoogle(fingerprint?: string) {
  const supabase = await createClient();

  // Pass fingerprint as a query param in the callback URL so the
  // callback route can use it for trial-cycling detection.
  const callbackUrl = fingerprint
    ? `${SITE_URL}/auth/callback?fp=${encodeURIComponent(fingerprint)}`
    : `${SITE_URL}/auth/callback`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callbackUrl,
      queryParams: { access_type: "offline", prompt: "consent" },
    },
  });

  if (error) throw new Error(error.message);
  if (data.url) redirect(data.url);
}

export async function signInWithEmail(email: string, fingerprint?: string) {
  const supabase = await createClient();

  const callbackUrl = fingerprint
    ? `${SITE_URL}/auth/callback?fp=${encodeURIComponent(fingerprint)}`
    : `${SITE_URL}/auth/callback`;

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: callbackUrl },
  });

  if (error) throw new Error(error.message);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
