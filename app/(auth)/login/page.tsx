"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithGoogle, signInWithEmail } from "@/lib/supabase/actions";

const ERROR_MESSAGES: Record<string, string> = {
  auth_failed: "Authentication failed. Please try again.",
  missing_code: "Invalid login link. Please try again.",
  no_user: "Could not retrieve your account. Please try again.",
};

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [googlePending, setGooglePending] = useState(false);

  // Capture fingerprint once on mount
  const fingerprintRef = useRef<string | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const FingerprintJS = (await import("@fingerprintjs/fingerprintjs")).default;
        const fp = await FingerprintJS.load();
        const result = await fp.get();
        fingerprintRef.current = result.visitorId;
      } catch {
        // Non-fatal — fingerprint is best-effort
      }
    })();
  }, []);

  async function handleGoogle() {
    setGooglePending(true);
    try {
      await signInWithGoogle(fingerprintRef.current ?? undefined);
    } catch {
      setGooglePending(false);
    }
  }

  function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailError("");
    if (!email.trim() || !email.includes("@")) {
      setEmailError("Enter a valid email address.");
      return;
    }
    startTransition(async () => {
      try {
        await signInWithEmail(email.trim(), fingerprintRef.current ?? undefined);
        setSent(true);
      } catch (err: unknown) {
        setEmailError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm">
        {/* Card */}
        <div className="bg-white border border-subtle rounded-lg p-8 space-y-6">
          {/* Logo */}
          <div>
            <h1 className="text-[20px] font-semibold text-primary leading-tight">
              MyCreditCardinal
            </h1>
            <p className="text-secondary text-[13px] mt-0.5">
              Stop leaving rewards on the table.
            </p>
          </div>

          {/* Auth error from callback */}
          {errorParam && ERROR_MESSAGES[errorParam] && (
            <p className="text-red text-[12px]">{ERROR_MESSAGES[errorParam]}</p>
          )}

          {sent ? (
            <div className="space-y-2">
              <p className="text-primary text-[13px] font-medium">Check your inbox</p>
              <p className="text-secondary text-[12px]">
                We sent a magic link to <span className="text-primary">{email}</span>.
                Click it to sign in.
              </p>
              <button
                onClick={() => setSent(false)}
                className="text-[12px] text-blue hover:underline"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <>
              {/* Google OAuth */}
              <button
                onClick={handleGoogle}
                disabled={googlePending}
                className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 border border-subtle rounded-lg text-[13px] font-medium text-primary hover:bg-hover transition-colors duration-150 disabled:opacity-50"
              >
                {/* Google "G" SVG */}
                <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
                  <path
                    d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
                    fill="#4285F4"
                  />
                  <path
                    d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"
                    fill="#34A853"
                  />
                  <path
                    d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z"
                    fill="#EA4335"
                  />
                </svg>
                {googlePending ? "Redirecting…" : "Continue with Google"}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-subtle" />
                <span className="text-tertiary text-[11px]">or</span>
                <div className="flex-1 h-px bg-subtle" />
              </div>

              {/* Email magic link */}
              <form onSubmit={handleEmail} className="space-y-3">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-[11px] font-medium text-secondary mb-1"
                  >
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3 py-2 bg-field border border-subtle rounded-md text-[13px] text-primary placeholder:text-tertiary focus:outline-none focus:border-medium transition-colors"
                  />
                  {emailError && (
                    <p className="text-red text-[11px] mt-1">{emailError}</p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full py-2.5 bg-green hover:bg-green/90 text-white text-[13px] font-medium rounded-lg transition-colors duration-150 disabled:opacity-50"
                >
                  {isPending ? "Sending…" : "Send magic link"}
                </button>
              </form>
            </>
          )}

          {/* Continue as guest */}
          <button
            onClick={() => router.push("/browse")}
            className="w-full py-2.5 border border-subtle rounded-lg text-[13px] font-medium text-secondary hover:bg-hover hover:text-primary transition-colors duration-150"
          >
            Continue without signing in
          </button>

          {/* Fine print */}
          <p className="text-tertiary text-[11px] text-center">
            Free 30-day trial · No credit card required
            <br />
            Guest data stays on this device only and won&apos;t sync across devices.
          </p>
          <p className="text-tertiary text-[10px] text-center">
            By signing in you agree to our{" "}
            <a href="/terms" className="underline hover:text-secondary transition-colors">Terms</a>
            {" "}and{" "}
            <a href="/privacy" className="underline hover:text-secondary transition-colors">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  );
}
