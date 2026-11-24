import type { Metadata, Viewport } from "next";
import { Outfit, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { PostHogProvider } from "@/components/PostHogProvider";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { OfflineBanner } from "@/components/OfflineBanner";
import { InstallPrompt } from "@/components/InstallPrompt";

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-sans",
});

const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains-mono",
  // Only used for a few numbers; load it when needed instead of competing
  // with the main fonts on first paint.
  preload: false,
});

export const metadata: Metadata = {
  title: "MyCreditCardinal",
  description: "Stop leaving rewards on the table.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Cardinal",
  },
};

export const viewport: Viewport = {
  themeColor: "#f6f3ee",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${outfit.variable} ${serif.variable} ${mono.variable}`}>
      <body className="min-h-screen antialiased font-sans">
        <AuthProvider>
          <PostHogProvider>
            {children}
            <ServiceWorkerRegistration />
            <OfflineBanner />
            <InstallPrompt />
          </PostHogProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
