"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "./server";
import { FP_COOKIE } from "./constants";

/**
 * Resolve the public origin of the current request. Prefers an explicit
 * NEXT_PUBLIC_SITE_URL, then the forwarded host (Vercel / proxies), then Host.
 * Never silently falls back to localhost in production.
 */
async function getOrigin(): Promise<string> {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");
  if (explicit) return explicit;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) {
    const proto =
      h.get("x-forwarded-proto") ??
      (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
    return `${proto}://${host}`;
  }
  return "http://localhost:3000";
}

/**
 * Store the fingerprint in a short-lived cookie instead of the redirect URL.
 * Supabase only honours redirect URLs that exactly match its allow-list, and a
 * dynamic `?fp=...` query string made it fall back to the Site URL, which
 * broke Google sign-in.
 */
async function rememberFingerprint(fingerprint?: string) {
  if (!fingerprint) return;
  const store = await cookies();
  store.set(FP_COOKIE, fingerprint, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/auth",
    maxAge: 60 * 15,
  });
}

export async function signInWithGoogle(fingerprint?: string): Promise<{ error: string } | void> {
  const supabase = await createClient();
  await rememberFingerprint(fingerprint);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await getOrigin()}/auth/callback` },
  });

  if (error) return { error: error.message };
  if (data.url) redirect(data.url);
  return { error: "Google sign-in is not available right now." };
}

export async function signInWithEmail(email: string, fingerprint?: string) {
  const supabase = await createClient();
  await rememberFingerprint(fingerprint);

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${await getOrigin()}/auth/callback` },
  });

  if (error) throw new Error(error.message);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
