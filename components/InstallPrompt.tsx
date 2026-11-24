"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};
const DISMISS_KEY = "mcc-install-dismissed";

export function InstallPrompt() {
  const isIOS = useSyncExternalStore(
    noopSubscribe,
    () => /iPad|iPhone|iPod/.test(navigator.userAgent),
    () => false
  );
  const isStandalone = useSyncExternalStore(
    noopSubscribe,
    () => window.matchMedia("(display-mode: standalone)").matches,
    () => false
  );
  const storedDismissed = useSyncExternalStore(
    noopSubscribe,
    () => {
      try { return localStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
    },
    () => true
  );
  const [dismissedNow, setDismissedNow] = useState(false);
  const dismissed = storedDismissed || dismissedNow;
  function setDismissed(v: boolean) {
    setDismissedNow(v);
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch {}
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // Chrome / Edge on Android: capture the install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Don't show if already installed or dismissed
  if (isStandalone || dismissed) return null;
  // Don't show if no prompt is available (non-iOS, non-Android-Chrome)
  if (!isIOS && !deferredPrompt) return null;

  return (
    <div className="fixed bottom-4 inset-x-4 sm:left-auto sm:right-4 sm:w-80 z-50 bg-white border border-medium rounded-xl p-4 shadow-xl">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="text-[14px] font-semibold text-ink">
          Add to home screen
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="w-8 h-8 -mt-1.5 -mr-1.5 flex items-center justify-center rounded-md text-secondary hover:text-ink hover:bg-hover transition-colors text-[20px] leading-none shrink-0"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
      <p className="text-[13px] text-secondary leading-relaxed mb-3">
        {isIOS
          ? 'Tap the share button ⎋ then "Add to Home Screen" ➕ to install.'
          : "Install MyCreditCardinal for quick access and offline support."}
      </p>
      {deferredPrompt && !isIOS && (
        <button
          onClick={async () => {
            deferredPrompt.prompt();
            setDeferredPrompt(null);
          }}
          className="w-full py-2.5 bg-ink hover:bg-ink/85 text-paper text-[13px] font-medium rounded-lg transition-colors duration-150"
        >
          Install app
        </button>
      )}
    </div>
  );
}
