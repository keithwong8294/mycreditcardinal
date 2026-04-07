import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Card Optimizer – MyCreditCardinal",
  description:
    "Get personalized credit card recommendations based on your real spending. Our optimizer ranks every card by the net value you'd actually earn.",
};

export default function OptimizeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
