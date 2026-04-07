const CACHE_NAME = "mcc-v1";
const OFFLINE_URL = "/offline";

// ── Install: pre-cache the offline shell ──────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL))
  );
  self.skipWaiting();
});

// ── Activate: clean up stale caches ──────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Cache-first: Next.js static chunks (content-hashed → safe to cache forever)
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      })
    );
    return;
  }

  // Skip: API routes and auth callbacks — never serve stale data
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/")
  ) {
    return;
  }

  // Skip: cross-origin requests (Supabase, Stripe, etc.)
  if (url.origin !== self.location.origin) {
    return;
  }

  // Network-first + offline fallback: page navigations
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches
          .match(OFFLINE_URL)
          .then((r) => r ?? new Response("Offline", { status: 503 }))
      )
    );
    return;
  }

  // Stale-while-revalidate: public static assets (icons, fonts, images)
  if (
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/pwa/") ||
    /\.(woff2?|png|svg|ico|webp|jpg|jpeg)$/.test(url.pathname)
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        const networkFetch = fetch(request)
          .then((res) => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached ?? networkFetch;
      })
    );
  }
});
