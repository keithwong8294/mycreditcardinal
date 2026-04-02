"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { label: "Browse Cards", href: "/browse" },
  { label: "My Wallet", href: "/wallet" },
  { label: "Simulator", href: "/simulate" },
  { label: "Optimize", href: "/optimize" },
];

export default function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-subtle flex overflow-x-auto">
      {tabs.map((tab) => {
        const isActive = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-4 py-2.5 text-[13px] font-medium whitespace-nowrap transition-colors duration-150 ${
              isActive
                ? "text-primary border-b-2 border-green"
                : "text-secondary hover:text-primary"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
