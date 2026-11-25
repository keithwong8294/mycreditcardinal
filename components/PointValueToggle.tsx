"use client";

import { useEffect, useState } from "react";

export type PointMode = "floor" | "mcc";

const EVENT = "mcc:point-mode";

function setPointMode(m: PointMode) {
  document.documentElement.setAttribute("data-points", m);
  window.dispatchEvent(new Event(EVENT));
}

/**
 * Landing-page switch between cash-out (1¢ a point) and MCC point values.
 * Both sets of numbers are rendered on the server; this only flips
 * `data-points` on <html>, and CSS shows the matching `.pv-*` blocks.
 */
export function PointValueToggle({ className }: { className?: string }) {
  const [mode, setMode] = useState<PointMode>("floor");

  useEffect(() => {
    const sync = () => setMode(document.documentElement.dataset.points === "mcc" ? "mcc" : "floor");
    sync();
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);

  return (
    <div role="group" aria-label="Point values" className={`inline-flex rounded-md border border-[#1c1917]/15 bg-white text-[12px] overflow-hidden ${className ?? ""}`}>
      {(
        [
          ["floor", "Cash-out"],
          ["mcc", "MCC values"],
        ] as const
      ).map(([m, label], i) => (
        <button
          key={m}
          type="button"
          aria-pressed={mode === m}
          onClick={() => setPointMode(m)}
          className={`px-2.5 py-1 font-medium transition-colors ${i > 0 ? "border-l border-[#1c1917]/15" : ""} ${
            mode === m ? "bg-[#1c1917] text-[#f6f3ee]" : "text-[#57534e] hover:bg-[#f6f3ee]"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
