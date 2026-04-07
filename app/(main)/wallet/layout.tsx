import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Wallet – MyCreditCardinal",
  description:
    "Manage the cards in your wallet. Add, remove, and track your credit card lineup to get the most accurate recommendations.",
};

export default function WalletLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
