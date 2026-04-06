"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { signOut } from "@/lib/supabase/actions";
import { useStore } from "@/lib/store";

const SIDEBAR_BG = "#0f1219";

const navItems = [
  { label: "Browse Cards", href: "/browse", icon: "▤" },
  { label: "My Wallet", href: "/wallet", icon: "◧" },
  { label: "Simulator", href: "/simulate", icon: "≋" },
  { label: "Optimize", href: "/optimize", icon: "◈" },
  { label: "Reports", href: "/reports", icon: "◎" },
  { label: "Settings", href: "/settings", icon: "⚙" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();

  const people = useStore((s) => s.people);
  const activePersonId = useStore((s) => s.activePersonId);
  const setActivePerson = useStore((s) => s.setActivePerson);
  const addPerson = useStore((s) => s.addPerson);

  function handleAddPerson() {
    const name = prompt("Enter a name:");
    if (!name?.trim()) return;
    addPerson(name.trim());
  }

  const displayName =
    user?.user_metadata?.full_name ??
    user?.user_metadata?.name ??
    user?.email?.split("@")[0] ??
    "Account";

  const sidebarContent = (
    <div className="flex flex-col h-full" style={{ background: SIDEBAR_BG }}>
      {/* Logo */}
      <div className="px-4 py-5 border-b border-white/5">
        <div className="text-white font-semibold text-[17px] leading-tight">
          MyCreditCardinal
        </div>
        <div className="text-white/35 text-[11px] mt-0.5">
          Stop leaving rewards on the table.
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors duration-150 ${
                isActive
                  ? "bg-[#059669] text-white"
                  : "text-white/50 hover:text-white hover:bg-white/5"
              }`}
            >
              <span className="text-[14px] w-4 text-center">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* People section */}
      <div className="px-3 py-4 border-t border-white/5">
        <div className="text-white/30 text-[10px] uppercase tracking-wider mb-2 px-1">
          People
        </div>
        <div className="space-y-0.5">
          {people.map((person) => (
            <button
              key={person.id}
              onClick={() => setActivePerson(person.id)}
              className={`w-full text-left px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors duration-150 ${
                activePersonId === person.id
                  ? "bg-[#059669]/15 text-[#34d399]"
                  : "text-white/45 hover:text-white hover:bg-white/5"
              }`}
            >
              {person.name}
            </button>
          ))}
          <button
            onClick={handleAddPerson}
            className="w-full text-left px-3 py-1.5 rounded-lg text-[12px] text-white/30 hover:text-white/60 transition-colors duration-150"
          >
            + Add person
          </button>
        </div>
      </div>

      {/* User / sign out */}
      {user && (
        <div className="px-3 py-3 border-t border-white/5">
          <div className="px-3 py-1.5 text-[12px] text-white/40 truncate mb-1">
            {displayName}
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="w-full text-left px-3 py-1.5 rounded-lg text-[12px] text-white/30 hover:text-white/60 transition-colors duration-150"
            >
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <header
        className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 flex items-center px-4 gap-3 border-b border-white/5"
        style={{ background: SIDEBAR_BG }}
      >
        <button
          onClick={() => setMobileOpen(true)}
          className="text-white/60 hover:text-white text-[18px] leading-none transition-colors"
          aria-label="Open menu"
        >
          ☰
        </button>
        <span className="text-white font-semibold text-[16px]">
          MyCreditCardinal
        </span>
      </header>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — fixed desktop, slide-in mobile */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[220px] transition-transform duration-200 ease-in-out
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
