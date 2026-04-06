"use client";

import { useState } from "react";

const FAQS = [
  {
    q: "Is MyCreditCardinal free to use?",
    a: "Yes — the Free tier is permanently free. You get the full card browser, spend simulator, annual summary, and the top 2 optimizer recommendations at no cost. Pro unlocks unlimited cards, household wallets, the full optimizer, and a monthly Wallet Health Report for $7.99/month.",
  },
  {
    q: "How does the routing engine decide which card to use?",
    a: "The engine ranks every card in your wallet by raw earn rate for each spending category — higher multipliers win. It handles rotating quarterly cards (like Freedom Flex), custom-select cards (like Citi Custom Cash), and per-category caps with automatic overflow routing. Valuations are shown for context but never change which card is recommended.",
  },
  {
    q: "What is the MCC Composite valuation?",
    a: "MCC Composite is our proprietary point valuation — a trimmed mean of six published sources (TPG, Upgraded Points, NerdWallet, Bankrate, OMAAT, and Freddie Awards). You can also view rewards at Floor (cash-out value) or Ceiling (best-case redemption) to see your full range.",
  },
  {
    q: "Is my data safe?",
    a: "You never connect a bank account or enter card numbers. MyCreditCardinal only stores which cards you own and your monthly spending estimates. All data is encrypted at rest, protected by row-level security in our database, and never sold or shared with third parties.",
  },
  {
    q: "Can I use it for my whole household?",
    a: "Yes. Pro subscribers can add unlimited household members, each with their own wallet and spending profile. The simulator shows individual views side-by-side or stacked, with combined household totals in the annual summary.",
  },
  {
    q: "How do I cancel my Pro subscription?",
    a: "Go to Settings → Billing → Manage subscription. You can cancel anytime — your Pro features remain active through the end of your billing period, then you drop to the Free tier with no data loss.",
  },
];

export default function FAQAccordion() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="space-y-2">
      {FAQS.map((item, i) => (
        <div
          key={i}
          className="border border-white/8 rounded-lg overflow-hidden"
        >
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex items-center justify-between px-5 py-4 text-left gap-4 hover:bg-white/4 transition-colors duration-150"
          >
            <span className="text-[14px] font-medium text-white">{item.q}</span>
            <span
              className={`text-white/40 text-[18px] leading-none shrink-0 transition-transform duration-200 ${
                open === i ? "rotate-45" : ""
              }`}
            >
              +
            </span>
          </button>
          {open === i && (
            <div className="px-5 pb-4">
              <p className="text-[13px] text-white/55 leading-relaxed">{item.a}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
