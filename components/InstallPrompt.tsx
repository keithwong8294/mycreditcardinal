"use client";

import { useEffect, useState } from "react";

export function InstallPrompt() {
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent));
    setIsStandalone(window.matchMedia("(display-mode: standalone)").matches);

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
    <div className="fixed bottom-4 inset-x-4 sm:left-auto sm:right-4 sm:w-80 z-50 bg-[#0f1219] border border-white/10 rounded-xl p-4 shadow-2xl">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="text-[13px] font-semibold text-white">
          Add to home screen
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-white/30 hover:text-white/60 transition-colors text-[18px] leading-none shrink-0 mt-px"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
      <p className="text-[12px] text-white/45 leading-relaxed mb-3">
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
          className="w-full py-2 bg-[#059669] hover:bg-[#059669]/90 text-white text-[12px] font-medium rounded-lg transition-colors duration-150"
        >
          Install app
        </button>
      )}
    </div>
  );
}
