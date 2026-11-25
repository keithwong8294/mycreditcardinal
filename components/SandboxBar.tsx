"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore } from "@/lib/store";
import { useHydrated } from "@/lib/useHydrated";

/** Strip shown on every app page while sandbox mode is on. */
export function SandboxBar() {
  const active = useStore((s) => s.sandbox.active);
  const exitSandbox = useStore((s) => s.exitSandbox);
  const pathname = usePathname();
  const hydrated = useHydrated();
  if (!active || !hydrated) return null;

  return (
    <div className="sticky top-14 md:top-0 z-30 bg-ink text-paper px-4 sm:px-8 py-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px]">
      <span className="flex items-center gap-2 font-medium">
        <span className="w-2 h-2 rounded-full bg-[#f0b429]" aria-hidden />
        Sandbox mode
      </span>
      <span className="text-paper/65 hidden sm:inline">Play freely. Your real wallet is saved and untouched.</span>
      <span className="ml-auto flex items-center gap-1">
        {pathname !== "/sandbox" && (
          <Link href="/sandbox" className="px-2.5 py-1.5 rounded-md hover:bg-white/10 font-medium">
            Compare
          </Link>
        )}
        <button onClick={() => exitSandbox(false)} className="px-2.5 py-1.5 rounded-md bg-paper text-ink font-semibold hover:bg-white">
          Exit sandbox
        </button>
      </span>
    </div>
  );
}
