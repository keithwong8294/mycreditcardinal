import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { createClient } from "@/lib/supabase/server";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { OfflineBanner } from "@/components/OfflineBanner";
import { InstallPrompt } from "@/components/InstallPrompt";

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "MyCreditCardinal",
  description: "Stop leaving rewards on the table.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Cardinal",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f1219",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="en" className={outfit.variable}>
      <body className="min-h-screen antialiased font-sans">
        <AuthProvider initialUser={user}>
          {children}
          <ServiceWorkerRegistration />
          <OfflineBanner />
          <InstallPrompt />
        </AuthProvider>
      </body>
    </html>
  );
}
