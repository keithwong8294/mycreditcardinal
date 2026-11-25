import Link from "next/link";
import { CARDS, CARD_MAP } from "@/lib/cards";
import { CATEGORIES } from "@/lib/categories";
import { routeMonth, type Valuation } from "@/lib/engine";
import { CURRENCY_MAP } from "@/lib/currencies";
import type { WalletCard } from "@/types";
import { CardinalMark } from "@/lib/brand";
import { WALLET_PRESETS, alternativeNames, buildWallet, scoreWallet } from "@/lib/sandbox";
import { CardArt } from "@/components/CardArt";
import { CardCycle } from "@/components/CardCycle";
import { PointValueToggle, type PointMode } from "@/components/PointValueToggle";

const serif = { className: "font-serif" };
const mono = { className: "font-mono" };

export const metadata = {
  title: "MyCreditCardinal — Use the right card, every time",
  description:
    "Tell it which cards you carry and roughly what you spend. It tells you which card to use for each purchase and what a better wallet would earn.",
};

// ─── Worked example (computed at build time from the real engine) ─────────────

const EXAMPLE_WALLET: WalletCard[] = [
  { id: "ex_gold", card: CARD_MAP.amex_gold, config: { rotQ: [null, null, null, null], custom: [] } },
  { id: "ex_cfu", card: CARD_MAP.cfu, config: { rotQ: [null, null, null, null], custom: [] } },
  { id: "ex_cc", card: CARD_MAP.citi_custom_cash, config: { rotQ: [null, null, null, null], custom: ["gas"] } },
];

const EXAMPLE_SPEND: Record<string, number> = {
  dining: 420, groceries: 610, gas: 160, travel: 250, hotels: 0, streaming: 45,
  online: 310, entertainment: 0, transit: 90, rent: 0, drugstore: 35, other: 680,
};

// Everything is shown at cash-out value (about 1¢ a point) unless the
// visitor switches to MCC values. Cash-out also routes at cash-out, so a
// card is picked for what most people actually get from it.
const MODES: PointMode[] = ["floor", "mcc"];
const VALUATIONS: Record<PointMode, Valuation> = {
  floor: (currencyId) => CURRENCY_MAP[currencyId]?.floor ?? 100,
  mcc: "composite",
};

const exampleSpendTotal = Object.values(EXAMPLE_SPEND).reduce((a, b) => a + b, 0);
const flatCardMonthly = exampleSpendTotal * 0.015;
const examples = MODES.map((mode) => {
  const result = routeMonth(EXAMPLE_WALLET, EXAMPLE_SPEND, {}, 1, VALUATIONS[mode]);
  return {
    mode,
    result,
    rows: result.rows.filter((r) => r.spend > 0),
    uplift: Math.round((result.totalDollarValue - flatCardMonthly) * 12),
  };
});

// Preset wallets scored at the same sample spending: year 1 = sign-up
// bonuses + rewards + statement credits (capped at each card's fee) − fees;
// later years drop the bonuses. Best first by later years, at cash-out.
const presetScores = WALLET_PRESETS.slice(0, 6)
  .map((p) => {
    const wallet = buildWallet(p.cardIds.map((cardId) => ({ cardId })), EXAMPLE_SPEND);
    const scores = Object.fromEntries(
      MODES.map((m) => [m, scoreWallet(wallet, EXAMPLE_SPEND, VALUATIONS[m], "all")])
    ) as Record<PointMode, ReturnType<typeof scoreWallet>>;
    return { preset: p, scores };
  })
  .sort((a, b) => b.scores.floor.net - a.scores.floor.net);
const bestPresetId = Object.fromEntries(
  MODES.map((m) => [m, presetScores.reduce((a, b) => (b.scores[m].net > a.scores[m].net ? b : a)).preset.id])
) as Record<PointMode, string>;

const SANDBOX_FEATURES = [
  ["Load a preset", "Chase trifecta, Amex foodie, a no-fee starter and more, set up for your spending."],
  ["See the yearly score", "Rewards plus credits minus fees, so a $795 card has to earn its keep."],
  ["Compare side by side", "Your real wallet next to the sandbox, category by category."],
  ["Ask “what if?”", "Every card ranked by what it would add to the wallet you’re testing."],
  ["Share a wallet", "Send a link. Friends see the same cards at their own spending."],
] as const;

const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]));
const ISSUERS = Array.from(new Set(CARDS.map((c) => c.issuer)));

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const dollars = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

// ─── Content ──────────────────────────────────────────────────────────────────

const STEPS = [
  {
    title: "Add the cards you already have",
    body: "Pick from the card list or add your own. Set which rotating categories you activated and which category you chose on cards like Custom Cash or Cash+.",
  },
  {
    title: "Rough in your monthly spending",
    body: "Twelve categories, slider or typed number. Ballpark is fine. You can override individual months if December looks nothing like March.",
  },
  {
    title: "Read the routing table",
    body: "Each category gets the card that earns the most, with overflow to the next card once a cap is hit. Point values come in three tiers so you can see the floor and the optimistic case.",
  },
  {
    title: "See what you’re missing",
    body: "The optimizer checks every card you don’t have against your spending and ranks them by what they would actually add after the annual fee.",
  },
];

const FAQS = [
  {
    q: "Do you get paid when I apply for a card?",
    a: "No. There are no affiliate links anywhere, so no card is ranked higher because it pays more. Apply on the issuer’s own site when you’re ready.",
  },
  {
    q: "What is sandbox mode?",
    a: "A scratch copy of your wallet. Turn it on, load a preset or add and drop any cards, and compare the result with your real wallet. Exit and your real wallet comes back exactly as it was, or keep the sandbox version if you like it better.",
  },
  {
    q: "Do I have to make an account?",
    a: "No. Hit “Continue without signing in” and everything is saved in your browser. Sign in later if you want your wallet on more than one device.",
  },
  {
    q: "Do you connect to my bank?",
    a: "Never. The app only knows which card products you hold and the spending estimates you type in. No card numbers, no logins, no transaction data.",
  },
  {
    q: "How does it pick a card?",
    a: "Highest earn rate wins for each category. Rotating categories, custom-select cards and spending caps are handled, with overflow to your next-best card. Point valuations are shown for context but don’t change the ranking.",
  },
  {
    q: "Where do the point values come from?",
    a: "Each currency has three values: a floor (cash-out), an MCC value (the median of published valuations from TPG, NerdWallet, Upgraded Points and One Mile at a Time) and a ceiling (strong transfer redemptions). Switch between them anywhere in the app.",
  },
  {
    q: "How current is the card data?",
    a: "The card list was last reviewed in November 2026. Sign-up offers change often, so treat bonuses as a guide and check the issuer’s page before you apply.",
  },
  {
    q: "What does Pro add?",
    a: "Unlimited cards and household members, the full optimizer list, and a monthly wallet report by email. New accounts get 30 days of Pro free, no card required.",
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

// Fully static: signed-in visitors are redirected to /browse by proxy.ts,
// so the landing page never hits Supabase.
export default function Home() {
  return (
    <div className="min-h-screen bg-[#f6f3ee] text-[#1c1917] selection:bg-[#b3261e]/15">
      {/* ── Nav ── */}
      <header className="border-b border-[#1c1917]/10">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <CardinalMark size={30} />
            <span className="text-[16px] font-semibold tracking-tight">MyCreditCardinal</span>
          </Link>
          <nav className="flex items-center gap-1 sm:gap-6 text-[14px]">
            <a href="#sandbox" className="hidden sm:inline text-[#57534e] hover:text-[#1c1917]">Sandbox</a>
            <a href="#how" className="hidden sm:inline text-[#57534e] hover:text-[#1c1917]">How it works</a>
            <a href="#pricing" className="hidden sm:inline text-[#57534e] hover:text-[#1c1917]">Pricing</a>
            <Link href="/login" className="text-[#57534e] hover:text-[#1c1917] px-2">Sign in</Link>
          </nav>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 pt-14 sm:pt-20 pb-20 grid lg:grid-cols-[1.05fr_1fr] gap-14 lg:gap-16 items-start">
        <div>
          <h1 className={`${serif.className} text-[52px] sm:text-[72px] leading-[0.98] tracking-[-0.01em]`}>
            Use the right card.
            <br />
            <span className="italic text-[#b3261e]">Every time.</span>
          </h1>
          <p className="mt-7 text-[18px] leading-[1.6] text-[#44403c] max-w-[34rem]">
            Tell it which cards you carry and roughly what you spend. It tells you which card
            to reach for at the grocery store, the gas pump and everywhere else, and what
            you’d earn with a better lineup.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row sm:items-center gap-4">
            <Link
              href="/browse"
              className="inline-flex flex-col justify-center px-8 py-5 rounded-lg bg-[#1c1917] hover:bg-[#b3261e] text-[#f6f3ee] transition-colors duration-200"
            >
              <span className="text-[19px] font-semibold leading-tight">Continue without signing in →</span>
              <span className="text-[13px] text-[#f6f3ee]/65 mt-1">Free, nothing to set up. Your data stays in your browser.</span>
            </Link>
            <Link
              href="/login"
              className="text-[15px] text-[#44403c] underline decoration-[#1c1917]/25 underline-offset-4 hover:decoration-[#1c1917]"
            >
              or sign in to sync
            </Link>
          </div>

          <p className="mt-5 text-[14px] text-[#57534e]">
            Free to use. <span className="font-semibold text-[#1c1917]">No affiliate links</span>: nothing here pays us when you apply.
          </p>

          <dl className="mt-12 grid grid-cols-3 max-w-md border-t border-[#1c1917]/10 pt-6">
            <div>
              <dt className="text-[12px] text-[#78716c]">Cards</dt>
              <dd className={`${mono.className} text-[22px] mt-1`}>{CARDS.length}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-[#78716c]">Issuers</dt>
              <dd className={`${mono.className} text-[22px] mt-1`}>{ISSUERS.length}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-[#78716c]">Categories</dt>
              <dd className={`${mono.className} text-[22px] mt-1`}>{CATEGORIES.length}</dd>
            </div>
          </dl>
        </div>

        {/* Worked example: a real routing table rendered like a receipt */}
        <figure className="lg:mt-3">
          <div className="bg-white rounded-md border border-[#1c1917]/10 shadow-[0_1px_0_rgba(28,25,23,0.04),0_12px_32px_-12px_rgba(28,25,23,0.18)] sm:rotate-[0.6deg] overflow-hidden">
            <div className="px-6 pt-5 pb-4 border-b border-dashed border-[#1c1917]/20 flex items-baseline justify-between">
              <div>
                <div className="text-[13px] font-semibold">One month, routed</div>
                <div className="text-[12px] text-[#78716c] mt-0.5">
                  {EXAMPLE_WALLET.map((w) => w.card.name).join(" · ")}
                </div>
              </div>
              <div className={`${mono.className} text-[11px] text-[#a8a29e]`}>Q1</div>
            </div>

            {examples.map(({ mode, result, rows, uplift }) => (
              <div key={mode} className={`pv-${mode}`}>
              <table className={`${mono.className} w-full text-[11.5px] sm:text-[12.5px]`}>
                <thead>
                  <tr className="text-[#a8a29e] text-[11px]">
                    <th className="text-left font-normal pl-4 sm:px-6 pt-3 pb-1">category</th>
                    <th className="text-left font-normal pt-3 pb-1">card</th>
                    <th className="text-right font-normal pt-3 pb-1">rate</th>
                    <th className="text-right font-normal pr-4 sm:px-6 pt-3 pb-1">value</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.categoryId} className="align-baseline">
                      <td className="pl-4 sm:px-6 pr-2 py-[5px] text-[#44403c] sm:whitespace-nowrap">
                        {CATEGORY_LABEL[r.categoryId]?.split(" /")[0]}
                      </td>
                      <td className="py-[5px] pr-2 text-[#1c1917] sm:whitespace-nowrap">{r.walletCard.card.name}</td>
                      <td className="py-[5px] pl-2 text-right">{r.earnRate}x</td>
                      <td className="pr-4 sm:px-6 py-[5px] text-right">{money(r.dollarValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className={`${mono.className} mx-6 mt-3 py-3 border-t border-dashed border-[#1c1917]/20 flex justify-between text-[13px]`}>
                <span>{money(exampleSpendTotal)} spent</span>
                <span className="font-medium">{money(result.totalDollarValue)} earned</span>
              </div>
              <div className="px-6 pb-5 text-[13px] text-[#44403c]">
                That’s about <span className="font-semibold text-[#b3261e]">${uplift.toLocaleString()} more a year</span> than
                putting it all on a 1.5% card, before annual fees.
              </div>
              </div>
            ))}
          </div>
          <figcaption className="mt-4 text-[12px] text-[#78716c] max-w-sm">
            Computed by the same engine the app uses.{" "}
            <span className="pv-floor">Points counted at cash-out value, about 1¢ each.</span>
            <span className="pv-mcc">Points counted at MCC values, the typical value of transferring them for travel.</span>{" "}
            <Link href="/point-values" className="underline underline-offset-2 hover:text-[#1c1917]">
              How point values work
            </Link>
            <PointValueToggle className="mt-2 flex w-fit" />
          </figcaption>
        </figure>
      </section>

      {/* ── Sandbox ── */}
      <section id="sandbox" className="border-t border-[#1c1917]/10 bg-[#fbfaf7]">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-20 grid lg:grid-cols-[1fr_1.35fr] gap-12">
          <div>
            <div className={`${mono.className} text-[12px] text-[#b3261e] tracking-wide`}>SANDBOX MODE</div>
            <h2 className={`${serif.className} mt-3 text-[44px] sm:text-[52px] leading-[1]`}>
              Try any wallet
              <br />
              <span className="italic text-[#b3261e]">before you apply.</span>
            </h2>
            <p className="mt-6 text-[16px] leading-[1.65] text-[#44403c] max-w-md">
              Flip on sandbox mode and play. Your real wallet is saved, and everything you try is scored
              against your own spending. Free, no strings, built for how you actually spend.
            </p>
            <ul className="mt-8 space-y-4">
              {SANDBOX_FEATURES.map(([t, b]) => (
                <li key={t} className="grid grid-cols-[1.25rem_1fr] gap-2">
                  <span className="text-[#b3261e] pt-0.5" aria-hidden>✦</span>
                  <div>
                    <div className="text-[15px] font-semibold">{t}</div>
                    <div className="text-[14px] text-[#57534e] leading-[1.55]">{b}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="flex items-baseline justify-between gap-3 mb-3">
              <span className="text-[13px] font-semibold">Preset wallets, scored</span>
              <PointValueToggle />
            </div>
            <p className="-mt-1 mb-3 text-[12px] text-[#78716c]">
              Sign-up bonuses, rewards and statement credits minus annual fees, at the sample spending above
              (${exampleSpendTotal.toLocaleString()}/mo),{" "}
              <span className="pv-floor">with points at cash-out value (about 1¢).</span>
              <span className="pv-mcc">with points at MCC values, which assume you transfer them for travel.</span>{" "}
              <Link href="/point-values" className="underline underline-offset-2 hover:text-[#1c1917]">
                How point values work
              </Link>
            </p>
            <ul className="grid sm:grid-cols-2 gap-2.5">
              {presetScores.map(({ preset, scores }) => (
                <li key={preset.id}>
                  <Link
                    href={`/sandbox?preset=${preset.id}`}
                    className="group block h-full bg-white rounded-md border border-[#1c1917]/10 p-4 hover:border-[#1c1917]/40 transition-colors"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[15px] font-semibold">{preset.name}</span>
                    </div>
                    {MODES.map((m) => (
                      <div key={m} className={`pv-${m}`}>
                        <div className={`${mono.className} mt-1.5 grid grid-cols-2 gap-2`}>
                          <div>
                            <div className="text-[11px] text-[#78716c] font-sans">Year 1</div>
                            <div className="text-[17px]">{dollars(scores[m].firstYear)}</div>
                          </div>
                          <div>
                            <div className="text-[11px] text-[#78716c] font-sans">Each year after</div>
                            <div className={`text-[17px] ${preset.id === bestPresetId[m] ? "text-[#b3261e] font-semibold" : ""}`}>
                              {dollars(scores[m].net)}
                            </div>
                          </div>
                        </div>
                        <div className="mt-1 text-[12px] text-[#78716c] tabular-nums">
                          {dollars(scores[m].rewards)} earned
                          {scores[m].credits > 0 && <> + {dollars(scores[m].credits)} credits</>}
                          {scores[m].fees > 0 && <> − {dollars(scores[m].fees)} fees</>}
                          {scores[m].subs > 0 && <>, plus a {dollars(scores[m].subs)} sign-up bonus in year 1</>}
                        </div>
                      </div>
                    ))}
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      {preset.cardIds.map((id, i) =>
                        i === 0 && preset.alternatives ? (
                          <CardCycle
                            key={id}
                            cards={[id, ...preset.alternatives].map((a) => CARD_MAP[a])}
                            className="w-11 h-[28px] rounded-[3px]"
                          />
                        ) : (
                          <CardArt key={id} card={CARD_MAP[id]} className="w-11 h-[28px] rounded-[3px]" />
                        )
                      )}
                    </div>
                    <p className="hidden sm:block mt-2.5 text-[13px] leading-[1.5] text-[#57534e]">{preset.blurb}</p>
                    {preset.alternatives && (
                      <p className="mt-1.5 text-[12px] leading-[1.45] text-[#78716c]">
                        Any of these: {[CARD_MAP[preset.cardIds[0]]].map((c) => `${c.issuer} ${c.name}`).concat(alternativeNames(preset)).join(" · ")}
                      </p>
                    )}
                    <span className="mt-2 inline-block text-[13px] font-medium text-[#b3261e] group-hover:underline underline-offset-4">
                      Try this wallet →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href="/sandbox"
              className="mt-5 flex flex-col items-start px-7 py-4 rounded-lg bg-[#1c1917] hover:bg-[#b3261e] text-[#f6f3ee] transition-colors duration-200"
            >
              <span className="text-[17px] font-semibold">Open the sandbox →</span>
              <span className="text-[13px] text-[#f6f3ee]/65 mt-0.5">No account needed. Your real wallet stays untouched.</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className="border-t border-[#1c1917]/10">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-20 grid lg:grid-cols-[1fr_2fr] gap-10">
          <h2 className={`${serif.className} text-[40px] leading-[1.05]`}>
            Four steps,
            <br />
            about five minutes.
          </h2>
          <ol className="divide-y divide-[#1c1917]/10 border-y border-[#1c1917]/10">
            {STEPS.map((s, i) => (
              <li key={s.title} className="py-6 grid grid-cols-[2.5rem_1fr] gap-2">
                <span className={`${mono.className} text-[13px] text-[#b3261e] pt-1`}>{i + 1}.</span>
                <div>
                  <h3 className="text-[17px] font-semibold">{s.title}</h3>
                  <p className="mt-1.5 text-[15px] leading-[1.65] text-[#57534e] max-w-[42rem]">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Card coverage ── */}
      <section className="bg-[#1c1917] text-[#f6f3ee]">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-16">
          <p className="text-[14px] text-[#f6f3ee]/60 max-w-xl">
            Currently tracking {CARDS.length} cards, from no-fee flat-rate cards to premium
            travel cards, plus the hotel and airline co-brands people actually carry.
          </p>
          <ul className="mt-8 flex flex-wrap gap-x-3 gap-y-2.5 text-[14px]">
            {CARDS.map((c) => (
              <li key={c.id} className="text-[#f6f3ee]/85">
                {!c.name.startsWith(c.issuer) && <span className="text-[#f6f3ee]/40">{c.issuer} </span>}
                {c.name}
                <span className="text-[#f6f3ee]/20 ml-3" aria-hidden>/</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-20 grid lg:grid-cols-[1fr_2fr] gap-10">
          <div>
            <h2 className={`${serif.className} text-[40px] leading-[1.05]`}>Pricing</h2>
            <p className="mt-4 text-[15px] text-[#57534e] max-w-xs">
              The free plan is enough for most single-person wallets. New accounts get 30 days
              of Pro, no card required.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 border border-[#1c1917]/15 rounded-md overflow-hidden bg-white">
            <div className="p-7">
              <div className="text-[14px] font-semibold">Free</div>
              <div className={`${mono.className} text-[32px] mt-2`}>$0</div>
              <ul className="mt-6 space-y-2.5 text-[14px] text-[#44403c]">
                <li>Full card list</li>
                <li>Up to 5 cards, 1 person</li>
                <li>Spend simulator, all 12 categories</li>
                <li>Annual summary at 3 valuation tiers</li>
                <li>Top 2 optimizer picks</li>
              </ul>
            </div>
            <div className="p-7 border-t sm:border-t-0 sm:border-l border-[#1c1917]/15 bg-[#fbfaf7]">
              <div className="text-[14px] font-semibold">Pro</div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className={`${mono.className} text-[32px]`}>$7.99</span>
                <span className="text-[13px] text-[#78716c]">/mo, or $59.99/yr</span>
              </div>
              <ul className="mt-6 space-y-2.5 text-[14px] text-[#44403c]">
                <li>Unlimited cards and household members</li>
                <li>All 8 optimizer picks and what-if mode</li>
                <li>Monthly wallet report by email</li>
                <li>Sign-up bonus and rotation reminders</li>
                <li>Annual fee renewal alerts</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="border-t border-[#1c1917]/10">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-20 grid lg:grid-cols-[1fr_2fr] gap-10">
          <h2 className={`${serif.className} text-[40px] leading-[1.05]`}>Questions</h2>
          <div className="divide-y divide-[#1c1917]/10 border-y border-[#1c1917]/10">
            {FAQS.map((f) => (
              <details key={f.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-[16px] font-medium [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span className="text-[#a8a29e] text-[20px] leading-none transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-[15px] leading-[1.65] text-[#57534e] max-w-[42rem]">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Closing CTA ── */}
      <section className="border-t border-[#1c1917]/10">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-20 flex flex-col md:flex-row md:items-end md:justify-between gap-8">
          <h2 className={`${serif.className} text-[44px] sm:text-[56px] leading-[1] max-w-2xl`}>
            Find out what your wallet is <span className="italic text-[#b3261e]">really</span> earning.
          </h2>
          <Link
            href="/browse"
            className="shrink-0 inline-flex items-center px-8 py-5 rounded-lg bg-[#1c1917] hover:bg-[#b3261e] text-[#f6f3ee] text-[18px] font-semibold transition-colors duration-200"
          >
            Continue without signing in →
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-[#1c1917]/10">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-[13px] text-[#78716c]">
          <span>© {new Date().getFullYear()} MyCreditCardinal. Not affiliated with any card issuer.</span>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-[#1c1917]">Privacy</Link>
            <Link href="/terms" className="hover:text-[#1c1917]">Terms</Link>
            <Link href="/login" className="hover:text-[#1c1917]">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
