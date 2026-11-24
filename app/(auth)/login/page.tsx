"use client";

import { Suspense, useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithGoogle, signInWithEmail } from "@/lib/supabase/actions";
import { CardinalMark } from "@/lib/brand";

const ERROR_MESSAGES: Record<string, string> = {
  auth_failed: "Sign-in failed. Please try again.",
  access_denied: "Google sign-in was cancelled.",
  google_failed: "Couldn't start Google sign-in.",
  missing_code: "Invalid login link. Please try again.",
  no_user: "Could not retrieve your account. Please try again.",
};

export default function LoginPage() {
  // useSearchParams needs a Suspense boundary so the page can prerender.
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");
  const errorDetail = searchParams.get("detail");
  const [googleError, setGoogleError] = useState("");

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
    setGoogleError("");
    try {
      // On success the server action redirects to Google, so this only
      // returns when something went wrong.
      const result = await signInWithGoogle(fingerprintRef.current ?? undefined);
      if (result?.error) {
        setGoogleError(result.error);
        setGooglePending(false);
      }
    } catch (err) {
      // Next's redirect() surfaces as a thrown NEXT_REDIRECT; let it navigate.
      if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) return;
      setGoogleError(ERROR_MESSAGES.google_failed);
      setGooglePending(false);
    }
  }

  function continueAsGuest() {
    router.push("/browse");
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
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white border border-subtle rounded-lg p-8 space-y-6">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <CardinalMark size={44} title="MyCreditCardinal" />
            <div>
              <h1 className="text-[20px] font-semibold text-primary leading-tight">
                MyCreditCardinal
              </h1>
              <p className="text-secondary text-[13px] mt-0.5">
                Use the right card, every time.
              </p>
            </div>
          </div>

          {/* Continue as guest — the primary demo path */}
          <button
            onClick={continueAsGuest}
            autoFocus
            className="group w-full flex flex-col items-center justify-center gap-1 px-6 py-5 rounded-xl bg-green hover:bg-green/90 active:scale-[0.99] text-white shadow-lg shadow-green/20 transition-all duration-150 focus:outline-none focus-visible:ring-4 focus-visible:ring-green/30"
          >
            <span className="text-[18px] font-semibold leading-tight">
              Continue without signing in →
            </span>
            <span className="text-[12px] text-white/80">
              Jump straight in · no account needed
            </span>
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-subtle" />
            <span className="text-tertiary text-[11px]">or sign in to sync across devices</span>
            <div className="flex-1 h-px bg-subtle" />
          </div>

          {/* Auth error from callback */}
          {errorParam && (
            <div className="text-red text-[12px] space-y-0.5">
              <p>{ERROR_MESSAGES[errorParam] ?? ERROR_MESSAGES.auth_failed}</p>
              {errorDetail && <p className="text-tertiary text-[11px]">{errorDetail}</p>}
            </div>
          )}
          {googleError && <p className="text-red text-[12px]">{googleError}</p>}

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
                  className="w-full py-2.5 border border-subtle text-primary hover:bg-hover text-[13px] font-medium rounded-lg transition-colors duration-150 disabled:opacity-50"
                >
                  {isPending ? "Sending…" : "Send magic link"}
                </button>
              </form>
            </>
          )}

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
