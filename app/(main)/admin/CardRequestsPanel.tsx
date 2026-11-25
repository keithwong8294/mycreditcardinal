"use client";

import { useState, useTransition } from "react";
import { setCardRequestStatus, type CardRequest, type CardRequestStatus } from "@/lib/cardRequests";

const FILTERS: { id: CardRequestStatus | "all"; label: string }[] = [
  { id: "new", label: "New" },
  { id: "added", label: "Added" },
  { id: "dismissed", label: "Dismissed" },
  { id: "all", label: "All" },
];

const BTN = "text-[13px] px-3 py-1.5 rounded-lg border disabled:opacity-60";

export function CardRequestsPanel({ initial }: { initial: CardRequest[] }) {
  const [requests, setRequests] = useState(initial);
  const [filter, setFilter] = useState<CardRequestStatus | "all">("new");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const shown = filter === "all" ? requests : requests.filter((r) => r.status === filter);

  function update(id: string, status: CardRequestStatus) {
    setError("");
    startTransition(async () => {
      const res = await setCardRequestStatus(id, status);
      if (!res.ok) return setError(res.error);
      setRequests((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)));
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const n = f.id === "all" ? requests.length : requests.filter((r) => r.status === f.id).length;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={`text-[13px] px-3 py-1.5 rounded-full border transition-colors ${
                filter === f.id ? "bg-ink text-paper border-ink" : "bg-white text-ink border-medium hover:border-strong"
              }`}
            >
              {f.label} ({n})
            </button>
          );
        })}
      </div>

      {error && <p className="text-red text-[13px]">{error}</p>}

      {requests.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-tertiary">
          No requests yet. If people have sent some, run supabase/migrations/005_card_requests.sql and check
          that SUPABASE_SERVICE_ROLE_KEY is set.
        </p>
      ) : shown.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-tertiary">Nothing here.</p>
      ) : (
        <ul className="space-y-3">
          {shown.map((r) => (
            <li key={r.id} className="bg-white border border-subtle rounded-xl p-4 space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <span className="text-[15px] font-semibold text-ink">{r.card_name}</span>
                  <span className="text-[13px] text-secondary">
                    {" "}· {r.issuer}
                    {r.annual_fee !== null ? ` · $${r.annual_fee} fee` : ""}
                  </span>
                </div>
                <span className="text-[12px] text-tertiary">
                  {new Date(r.created_at).toLocaleString()}
                  {r.sandbox ? " · sandbox" : ""} · {r.status}
                </span>
              </div>
              {r.earn_rates && <p className="text-[13px] text-ink">Earn: {r.earn_rates}</p>}
              {r.notes && <p className="text-[13px] text-ink">Notes: {r.notes}</p>}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
                {r.link && (
                  <a href={r.link} target="_blank" rel="noopener noreferrer nofollow" className="text-cardinal hover:underline break-all">
                    {r.link}
                  </a>
                )}
                {r.email && (
                  <a href={`mailto:${r.email}`} className="text-secondary hover:text-ink">
                    {r.email}
                  </a>
                )}
              </div>
              <div className="flex gap-2 pt-1">
                {r.status !== "added" && (
                  <button disabled={pending} onClick={() => update(r.id, "added")} className={`${BTN} border-medium hover:border-ink`}>
                    Mark added
                  </button>
                )}
                {r.status !== "dismissed" && (
                  <button disabled={pending} onClick={() => update(r.id, "dismissed")} className={`${BTN} border-subtle text-secondary hover:border-medium`}>
                    Dismiss
                  </button>
                )}
                {r.status !== "new" && (
                  <button disabled={pending} onClick={() => update(r.id, "new")} className={`${BTN} border-subtle text-secondary hover:border-medium`}>
                    Reopen
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
