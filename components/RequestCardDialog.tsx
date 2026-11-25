"use client";

import { useState, useTransition } from "react";
import { submitCardRequest } from "@/lib/cardRequests";
import { useStore } from "@/lib/store";
import { capture } from "@/lib/analytics";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const FIELD =
  "w-full px-3 py-2 min-h-10 bg-white border border-medium rounded-lg text-[15px] text-ink placeholder:text-tertiary focus:outline-none focus:border-ink";
const LABEL = "block text-[13px] font-medium text-secondary mb-1";

export function RequestCardDialog({
  open,
  onOpenChange,
  initialName = "",
  onUseCustomCard,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName?: string;
  /** Offered after sending, so people can model the card right away. */
  onUseCustomCard?: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        {/* The dialog unmounts its content when closed, so each open starts fresh. */}
        <RequestCardForm initialName={initialName} onClose={() => onOpenChange(false)} onUseCustomCard={onUseCustomCard} />
      </DialogContent>
    </Dialog>
  );
}

function RequestCardForm({
  initialName,
  onClose,
  onUseCustomCard,
}: {
  initialName: string;
  onClose: () => void;
  onUseCustomCard?: () => void;
}) {
  const sandbox = useStore((s) => s.sandbox.active);
  const [form, setForm] = useState({
    cardName: initialName,
    issuer: "",
    annualFee: "",
    earnRates: "",
    link: "",
    notes: "",
    email: "",
    website: "",
  });
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.cardName.trim().length < 2) return setError("Enter the card's name.");
    if (!form.issuer.trim()) return setError("Enter the bank or issuer.");
    setError("");
    startTransition(async () => {
      try {
        const res = await submitCardRequest({ ...form, sandbox });
        if (!res.ok) return setError(res.error);
        setSent(true);
        capture("card_requested", { card_name: form.cardName.trim(), issuer: form.issuer.trim(), sandbox });
      } catch {
        setError("Couldn't send that. Check your connection and try again.");
      }
    });
  }

  return sent ? (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle>Request sent</DialogTitle>
        <DialogDescription>
          Thanks! We&apos;ll check the details for {form.cardName.trim()} and add it to the catalog.
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-wrap justify-end gap-2">
        {onUseCustomCard && (
          <button
            type="button"
            onClick={onUseCustomCard}
            className="px-4 py-2 min-h-10 text-[14px] text-ink bg-white border border-medium rounded-lg hover:border-ink transition-colors"
          >
            Add it as a custom card for now
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 min-h-10 text-[14px] font-medium bg-ink hover:bg-ink/85 text-paper rounded-lg transition-colors"
        >
          Done
        </button>
      </div>
    </div>
    ) : (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <DialogHeader>
        <DialogTitle>Request a card</DialogTitle>
        <DialogDescription>
          Tell us which card is missing. Only the name and issuer are required.
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label htmlFor="rq-name" className={LABEL}>Card name</label>
          <input id="rq-name" value={form.cardName} onChange={set("cardName")} placeholder="e.g. Sapphire Reserve" className={FIELD} autoFocus required />
        </div>
        <div>
          <label htmlFor="rq-issuer" className={LABEL}>Issuer</label>
          <input id="rq-issuer" value={form.issuer} onChange={set("issuer")} placeholder="e.g. Chase" className={FIELD} required />
        </div>
        <div>
          <label htmlFor="rq-fee" className={LABEL}>Annual fee ($)</label>
          <input id="rq-fee" inputMode="decimal" value={form.annualFee} onChange={set("annualFee")} placeholder="Optional" className={FIELD} />
        </div>
        <div className="col-span-2">
          <label htmlFor="rq-earn" className={LABEL}>Earn rates</label>
          <textarea id="rq-earn" rows={2} value={form.earnRates} onChange={set("earnRates")} placeholder="Optional, e.g. 3x dining, 2x travel, 1x everything else" className={`${FIELD} resize-y`} />
        </div>
        <div className="col-span-2">
          <label htmlFor="rq-link" className={LABEL}>Link to the card</label>
          <input id="rq-link" type="url" inputMode="url" value={form.link} onChange={set("link")} placeholder="Optional, issuer page" className={FIELD} />
        </div>
        <div className="col-span-2">
          <label htmlFor="rq-notes" className={LABEL}>Anything else</label>
          <textarea id="rq-notes" rows={2} value={form.notes} onChange={set("notes")} placeholder="Optional: welcome offer, credits, perks" className={`${FIELD} resize-y`} />
        </div>
        <div className="col-span-2">
          <label htmlFor="rq-email" className={LABEL}>Email me when it&apos;s added</label>
          <input id="rq-email" type="email" inputMode="email" value={form.email} onChange={set("email")} placeholder="Optional" className={FIELD} />
        </div>
        {/* Honeypot: hidden from people, tempting to bots. */}
        <div aria-hidden="true" className="absolute -left-[9999px] w-px h-px overflow-hidden">
          <label htmlFor="rq-website">Website</label>
          <input id="rq-website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} />
        </div>
      </div>

      {error && <p role="alert" className="text-red text-[13px]">{error}</p>}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 min-h-10 text-[14px] text-secondary border border-subtle rounded-lg hover:bg-hover transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 min-h-10 text-[14px] font-medium bg-cardinal hover:bg-cardinal-dark text-white rounded-lg transition-colors disabled:opacity-60"
        >
          {pending ? "Sending…" : "Send request"}
        </button>
      </div>
    </form>
  );
}
