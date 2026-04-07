"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    // Do not register the service worker in development — it aggressively
    // caches files and prevents hot-reload changes from appearing.
    if (process.env.NODE_ENV !== "production") {
      // Unregister any leftover SW from a previous production build.
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.getRegistrations().then((regs) =>
          regs.forEach((r) => r.unregister())
        );
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
      }
      return;
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch((err) => console.error("[SW] Registration failed:", err));
    }
  }, []);

  return null;
}
