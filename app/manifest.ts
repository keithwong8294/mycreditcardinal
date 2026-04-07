import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MyCreditCardinal",
    short_name: "Cardinal",
    description: "Stop leaving rewards on the table.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0f1219",
    theme_color: "#0f1219",
    categories: ["finance", "utilities"],
    icons: [
      {
        src: "/pwa/icon-192",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/pwa/icon-512",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/pwa/icon-512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
