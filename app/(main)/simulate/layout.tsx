import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Spend Simulator – MyCreditCardinal",
  description:
    "Enter your household spending and see which card earns the most in every category. Supports multi-person households with combined totals.",
};

export default function SimulateLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
