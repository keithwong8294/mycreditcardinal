import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Browse Cards – MyCreditCardinal",
  description:
    "Explore 50+ credit cards side by side. Filter by annual fee, rewards type, and category bonuses to find your perfect match.",
};

export default function BrowseLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
