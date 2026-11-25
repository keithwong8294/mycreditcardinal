"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { signOut } from "@/lib/supabase/actions";
import { useStore, nextPlayerName } from "@/lib/store";
import { CardinalMark } from "@/lib/brand";
import { useHydrated } from "@/lib/useHydrated";

const primaryNav = [
  { label: "Browse cards", href: "/browse" },
  { label: "Wallet", href: "/wallet" },
  { label: "Simulator", href: "/simulate" },
  { label: "Find a better card", href: "/optimize" },
  { label: "Wallet sandbox", href: "/sandbox" },
];

const secondaryNav = [
  { label: "Monthly report", href: "/reports" },
  { label: "Settings", href: "/settings" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [addingPerson, setAddingPerson] = useState(false);
  const [newPersonName, setNewPersonName] = useState("");
  const { user } = useAuth();

  const people = useStore((s) => s.people);
  const activePersonId = useStore((s) => s.activePersonId);
  const setActivePerson = useStore((s) => s.setActivePerson);
  const addPerson = useStore((s) => s.addPerson);
  const hydrated = useHydrated();
  const sandboxOn = useStore((s) => s.sandbox.active) && hydrated;
  const enterSandbox = useStore((s) => s.enterSandbox);
  const exitSandbox = useStore((s) => s.exitSandbox);

  function commitAddPerson() {
    const trimmed = newPersonName.trim();
    addPerson(trimmed || nextPlayerName(people));
    setNewPersonName("");
    setAddingPerson(false);
  }

  const displayName =
    user?.user_metadata?.full_name ??
    user?.user_metadata?.name ??
    user?.email?.split("@")[0] ??
    "Account";

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#fbfaf7] border-r border-subtle px-4 py-6 gap-7 overflow-y-auto">
      <Link href="/browse" className="flex items-center gap-2.5 px-2 text-ink">
        <CardinalMark size={30} />
        <span className="text-[16px] font-semibold tracking-tight">MyCreditCardinal</span>
      </Link>

      <nav aria-label="Main" className="flex flex-col gap-0.5">
        {primaryNav.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              onClick={() => setMobileOpen(false)}
              className={`block px-3 py-2.5 rounded-lg text-[15px] transition-colors duration-150 ${
                isActive
                  ? "bg-ink text-paper font-medium"
                  : "text-[#44403c] hover:bg-hover"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <button
        role="switch"
        aria-checked={sandboxOn}
        onClick={() => (sandboxOn ? exitSandbox(false) : enterSandbox())}
        className="-mt-3 flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-subtle bg-white text-left hover:border-medium transition-colors"
      >
        <span>
          <span className="block text-[14px] font-medium text-ink">Sandbox mode</span>
          <span className="block text-[12px] text-tertiary">Try wallets without changing yours</span>
        </span>
        <span
          aria-hidden
          className={`relative shrink-0 w-9 h-5 rounded-full transition-colors ${sandboxOn ? "bg-cardinal" : "bg-medium"}`}
        >
          <span
            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${sandboxOn ? "translate-x-[18px]" : "translate-x-0.5"}`}
          />
        </span>
      </button>

      <nav aria-label="More" className="flex flex-col gap-0.5 border-t border-subtle pt-4 -mt-3">
        {secondaryNav.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              onClick={() => setMobileOpen(false)}
              className={`block px-3 py-2 rounded-lg text-[14px] transition-colors duration-150 ${
                isActive ? "text-ink font-medium bg-hover" : "text-secondary hover:text-ink"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div>
        <div className="px-3 mb-2 text-[12px] text-tertiary">Whose wallet</div>
        <div className="flex flex-wrap gap-1.5 px-2">
          {people.map((person) => {
            const active = activePersonId === person.id;
            return (
              <button
                key={person.id}
                onClick={() => setActivePerson(person.id)}
                aria-pressed={active}
                className={`px-3 py-1.5 rounded-full text-[13px] border transition-colors duration-150 ${
                  active
                    ? "bg-ink text-paper border-ink"
                    : "bg-white text-ink border-medium hover:border-strong"
                }`}
              >
                {person.name}
              </button>
            );
          })}
          {addingPerson ? (
            <form
              onSubmit={(e) => { e.preventDefault(); commitAddPerson(); }}
              className="flex items-center gap-1 w-full mt-1"
            >
              <input
                autoFocus
                value={newPersonName}
                onChange={(e) => setNewPersonName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") { setAddingPerson(false); setNewPersonName(""); }
                }}
                onFocus={(e) => e.target.select()}
                placeholder="Name"
                aria-label="New person's name"
                className="flex-1 min-w-0 px-3 py-1.5 bg-white border border-medium rounded-lg text-[13px] text-ink placeholder:text-tertiary focus:outline-none focus:border-strong"
              />
              <button type="submit" className="px-2 py-1.5 text-[13px] font-medium text-cardinal hover:text-cardinal-dark">
                Add
              </button>
            </form>
          ) : (
            <button
              onClick={() => { setNewPersonName(nextPlayerName(people)); setAddingPerson(true); }}
              className="px-3 py-1.5 rounded-full text-[13px] border border-dashed border-medium text-secondary hover:text-ink transition-colors"
            >
              + Person
            </button>
          )}
        </div>
      </div>

      <div className="mt-auto rounded-[10px] bg-field p-3.5 text-[13px] leading-relaxed text-[#44403c]">
        {user ? (
          <>
            <div className="truncate font-medium text-ink">{displayName}</div>
            <form action={signOut}>
              <button type="submit" className="mt-1.5 font-medium text-cardinal hover:text-cardinal-dark">
                Sign out
              </button>
            </form>
          </>
        ) : (
          <>
            Guest mode. Your wallet is saved in this browser only.
            <Link href="/login" className="block mt-1.5 font-medium text-cardinal hover:text-cardinal-dark">
              Sign in to sync
            </Link>
          </>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <header
        className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 flex items-center px-2 gap-1 border-b border-subtle bg-[#fbfaf7]"
      >
        <button
          onClick={() => setMobileOpen(true)}
          className="w-11 h-11 flex items-center justify-center rounded-lg text-ink hover:bg-hover transition-colors"
          aria-label="Open menu"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M3 6h14M3 10h14M3 14h14" />
          </svg>
        </button>
        <span className="flex items-center gap-2 text-ink font-semibold text-[16px]">
          <CardinalMark size={26} />
          MyCreditCardinal
        </span>
      </header>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-ink/40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — fixed desktop, slide-in mobile */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[248px] transition-transform duration-200 ease-in-out
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
