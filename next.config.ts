import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // In development, tell the browser never to cache pages so changes
          // always appear immediately without a hard refresh.
          ...(isDev
            ? [
                {
                  key: "Cache-Control",
                  value: "no-store, no-cache, must-revalidate",
                },
              ]
            : []),
        ],
      },
      {
        // Card art rarely changes. Without this, Vercel serves public files
        // with max-age=0, so phones re-check every image on every visit.
        source: "/cards/:file*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=604800, stale-while-revalidate=2592000",
          },
        ],
      },
      {
        // Service worker must never be cached so users always get the latest
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
