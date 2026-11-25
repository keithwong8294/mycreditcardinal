import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Wallet Sandbox – MyCreditCardinal",
  description:
    "Try any wallet before you apply. Load a preset or build your own, see what it's worth a year at your spending, and compare it with the cards you have.",
};

export default function SandboxLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
