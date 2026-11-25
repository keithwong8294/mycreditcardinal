"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { planningContextOf, useStore } from "@/lib/store";
import { CARD_MAP } from "@/lib/cards";
import { CATEGORIES } from "@/lib/categories";
import { candidateConfig } from "@/lib/engine";
import {
  WALLET_PRESETS,
  PRESET_MAP,
  alternativeNames,
  bestAdditions,
  buildWallet,
  decodeWallet,
  scoreWallet,
  sharePath,
  valueByCategory,
  type WalletScore,
} from "@/lib/sandbox";
import { CardArt } from "@/components/CardArt";
import { CardCycle } from "@/components/CardCycle";
import { PageHeader, PAGE, PAGE_INNER } from "@/components/PageHeader";
import { useHydrated } from "@/lib/useHydrated";
import type { WalletCard } from "@/types";

const usd = (n: number) =>
  `${n < 0 ? "−" : ""}$${Math.abs(Math.round(n)).toLocaleString()}`;
const signed = (n: number) => `${n >= 0 ? "+" : "−"}$${Math.abs(Math.round(n)).toLocaleString()}`;

export default function SandboxPage() {
  const hydrated = useHydrated();
  const state = useStore();
  const { sandbox, valuationTier: tier, enterSandbox, exitSandbox, loadSandboxWallet, toggleCard } = state;
  const creditUsage = state.optimizerAnswers.creditUsage;
  const active = hydrated && sandbox.active;

  // Links from the landing page (?preset=) and shared wallets (?w=) open straight in the sandbox.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const preset = PRESET_MAP[params.get("preset") ?? ""];
    const shared = decodeWallet(params.get("w"));
    if (preset) loadSandboxWallet(preset.cardIds.map((cardId) => ({ cardId })));
    else if (shared.length) loadSandboxWallet(shared);
    if (preset || shared.length) window.history.replaceState(null, "", "/sandbox");
  }, [loadSandboxWallet]);

  const { people, activePersonId, spend: allSpend, spendMode } = state;
  const sandboxCtx = useMemo(
    () => planningContextOf({ ...state, people, activePersonId, spend: allSpend, spendMode }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the wallet fields matter
    [people, activePersonId, allSpend, spendMode]
  );
  const realCtx = useMemo(
    () => (sandbox.active && sandbox.real ? planningContextOf(sandbox.real) : sandboxCtx),
    [sandbox.active, sandbox.real, sandboxCtx]
  );
  const { walletCards, spend } = sandboxCtx;

  const realScore = useMemo(
    () => scoreWallet(realCtx.walletCards, realCtx.spend, tier, creditUsage),
    [realCtx.walletCards, realCtx.spend, tier, creditUsage]
  );
  const sbScore = useMemo(
    () => (active ? scoreWallet(walletCards, spend, tier, creditUsage) : realScore),
    [active, walletCards, spend, tier, creditUsage, realScore]
  );
  const presetScores = useMemo(
    () =>
      WALLET_PRESETS.map((p) => ({
        preset: p,
        score: scoreWallet(buildWallet(p.cardIds.map((cardId) => ({ cardId })), spend), spend, tier, creditUsage),
      })),
    [spend, tier, creditUsage]
  );
  const additions = useMemo(
    () => (active ? bestAdditions(walletCards, spend, tier, creditUsage, 5) : []),
    [active, walletCards, spend, tier, creditUsage]
  );

  return (
    <div className={PAGE}>
      <div className={PAGE_INNER}>
        <PageHeader
          title="Wallet sandbox"
          subtitle="Try any wallet before you apply. Free, no strings, built for your spending."
        />

        {!active ? (
          <section className="bg-white border border-subtle rounded-lg p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="flex-1">
              <h2 className="text-[18px] font-semibold text-ink">Play with wallets you don’t have yet</h2>
              <p className="mt-1.5 text-[14px] leading-relaxed text-secondary max-w-xl">
                Sandbox mode makes a scratch copy of your wallet. Add and drop cards anywhere in the app, load a
                preset, and see what each setup is worth a year at your spending. Your real wallet is saved and
                comes back when you exit. No affiliate links, ever: nothing here pays us when you apply.
              </p>
            </div>
            <button
              onClick={enterSandbox}
              className="shrink-0 px-6 py-4 rounded-lg bg-ink hover:bg-cardinal text-paper text-[16px] font-semibold transition-colors"
            >
              Turn on sandbox mode
            </button>
          </section>
        ) : (
          <>
            {/* Scoreboard */}
            <section className="grid sm:grid-cols-2 gap-3">
              <ScoreCard label="Your real wallet" score={realScore} cards={realCtx.walletCards} />
              <ScoreCard
                label="Sandbox wallet"
                score={sbScore}
                cards={walletCards}
                highlight
                showFirstYear
                delta={sbScore.net - realScore.net}
              />
            </section>

            {/* Sandbox cards */}
            <section className="bg-white border border-subtle rounded-lg p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="text-[18px] font-semibold text-ink">Cards in the sandbox</h2>
                <Link href="/browse" className="text-[14px] font-medium text-cardinal hover:text-cardinal-dark">
                  Add from all cards
                </Link>
              </div>
              {walletCards.length === 0 ? (
                <p className="text-[14px] text-tertiary py-4">Empty wallet. Load a preset below or add cards.</p>
              ) : (
                <ul className="divide-y divide-subtle">
                  {walletCards.map((wc) => (
                    <li key={wc.id} className="flex items-center gap-3 py-2.5">
                      <CardArt card={wc.card} className="w-12 h-[30px] rounded shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[14px] font-medium text-ink truncate">{wc.card.name}</div>
                        <div className="text-[12px] text-tertiary">
                          {wc.card.fee ? `$${wc.card.fee}/yr` : "No annual fee"}
                        </div>
                      </div>
                      <button
                        onClick={() => toggleCard(wc.card.id)}
                        className="text-[13px] text-tertiary hover:text-red px-2 py-1.5"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <ShareRow walletCards={walletCards} />
            </section>

            {/* What if I added… */}
            {additions.length > 0 && (
              <section>
                <h2 className="text-[18px] font-semibold text-ink mb-1">What if I added…</h2>
                <p className="text-[13px] text-tertiary mb-3">
                  The cards that would add the most to this sandbox wallet, after fees.
                </p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {additions.map((a) => (
                    <button
                      key={a.card.id}
                      onClick={() => toggleCard(a.card.id, candidateConfig(a.card, spend))}
                      className="flex items-center gap-3 text-left bg-white border border-subtle rounded-lg p-3 hover:border-strong transition-colors"
                    >
                      <CardArt card={a.card} className="w-12 h-[30px] rounded shrink-0" />
                      <span className="flex-1 min-w-0">
                        <span className="block text-[14px] font-medium text-ink truncate">{a.card.name}</span>
                        <span className="block text-[12px] text-tertiary">
                          {a.card.fee ? `$${a.card.fee}/yr fee` : "No annual fee"}
                        </span>
                      </span>
                      <span className="text-[14px] font-semibold text-green shrink-0">{signed(a.delta)}/yr</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Side by side */}
            <CategoryCompare real={realCtx} sandbox={sandboxCtx} tier={tier} />

            <section className="flex flex-wrap items-center gap-3 border-t border-subtle pt-5">
              <button
                onClick={() => exitSandbox(true)}
                className="px-4 py-2.5 rounded-lg bg-ink hover:bg-ink/85 text-paper text-[14px] font-semibold"
              >
                Make this my real wallet
              </button>
              <button
                onClick={() => exitSandbox(false)}
                className="px-4 py-2.5 rounded-lg border border-medium bg-white text-ink text-[14px] font-medium hover:border-strong"
              >
                Exit and discard
              </button>
              <span className="text-[13px] text-tertiary">
                Values use your spending from the{" "}
                <Link href="/simulate" className="underline underline-offset-2 hover:text-ink">
                  Simulator
                </Link>
                .
              </span>
            </section>
          </>
        )}

        {/* Presets */}
        <section>
          <h2 className="text-[18px] font-semibold text-ink mb-1">Preset wallets</h2>
          <p className="text-[13px] text-tertiary mb-3">
            Yearly value at your spending, after fees. Tap one to load it into the sandbox.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {presetScores.map(({ preset, score }) => (
              <button
                key={preset.id}
                onClick={() => loadSandboxWallet(preset.cardIds.map((cardId) => ({ cardId })))}
                className="text-left bg-white border border-subtle rounded-lg p-4 hover:border-strong transition-colors"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[15px] font-semibold text-ink">{preset.name}</span>
                  <span className="text-[15px] font-semibold text-green font-mono">{usd(score.net)}/yr</span>
                </div>
                {score.subs > 0 && (
                  <div className="text-[12px] text-tertiary">
                    Year 1 with sign-up bonuses: <span className="font-mono text-secondary">{usd(score.firstYear)}</span>
                  </div>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {preset.cardIds.map((id, i) =>
                    i === 0 && preset.alternatives ? (
                      <CardCycle
                        key={id}
                        cards={[id, ...preset.alternatives].map((a) => CARD_MAP[a])}
                        className="w-10 h-[25px] rounded"
                      />
                    ) : (
                      <CardArt key={id} card={CARD_MAP[id]} className="w-10 h-[25px] rounded" />
                    )
                  )}
                </div>
                <p className="mt-2 text-[13px] leading-snug text-secondary">{preset.blurb}</p>
                {preset.alternatives && (
                  <p className="mt-1.5 text-[12px] leading-snug text-tertiary">
                    Any of these: {[CARD_MAP[preset.cardIds[0]]].map((c) => `${c.issuer} ${c.name}`).concat(alternativeNames(preset)).join(" · ")}
                  </p>
                )}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

// ─── Pieces ───────────────────────────────────────────────────────────────────

function ScoreCard({
  label,
  score,
  cards,
  highlight,
  delta,
  showFirstYear,
}: {
  label: string;
  score: WalletScore;
  cards: WalletCard[];
  highlight?: boolean;
  delta?: number;
  /** Show the year-1 value with sign-up bonuses (cards you'd open, not ones you hold). */
  showFirstYear?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 sm:p-5 ${highlight ? "bg-ink text-paper border-ink" : "bg-white border-subtle"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[13px] font-medium ${highlight ? "text-paper/70" : "text-tertiary"}`}>{label}</span>
        {delta != null && Math.round(delta) !== 0 && (
          <span
            className={`text-[12px] font-semibold px-2 py-0.5 rounded-full ${
              delta > 0 ? "bg-[#2f9e62] text-white" : "bg-cardinal text-white"
            }`}
          >
            {signed(delta)}/yr
          </span>
        )}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-display text-[44px] leading-none">{usd(score.net)}</span>
        <span className={`text-[13px] ${highlight ? "text-paper/60" : "text-tertiary"}`}>each year</span>
      </div>
      {showFirstYear && score.subs > 0 && (
        <div className={`mt-1 text-[13px] ${highlight ? "text-paper/70" : "text-secondary"}`}>
          Year 1 with {usd(score.subs)} in sign-up bonuses: <span className="font-mono">{usd(score.firstYear)}</span>
        </div>
      )}
      <div className={`mt-3 grid grid-cols-3 gap-2 text-[12px] ${highlight ? "text-paper/70" : "text-secondary"}`}>
        <div>
          Rewards
          <div className={`font-mono text-[14px] ${highlight ? "text-paper" : "text-ink"}`}>{usd(score.rewards)}</div>
        </div>
        <div>
          Fees − credits
          <div className={`font-mono text-[14px] ${highlight ? "text-paper" : "text-ink"}`}>
            {usd(score.fees - score.credits)}
          </div>
        </div>
        <div>
          Return
          <div className={`font-mono text-[14px] ${highlight ? "text-paper" : "text-ink"}`}>
            {score.returnPct.toFixed(2)}%
          </div>
        </div>
      </div>
      <div className={`mt-3 text-[12px] truncate ${highlight ? "text-paper/55" : "text-tertiary"}`}>
        {cards.length ? cards.map((w) => w.card.name).join(" · ") : "No cards"}
      </div>
    </div>
  );
}

function ShareRow({ walletCards }: { walletCards: WalletCard[] }) {
  const [copied, setCopied] = useState(false);
  if (!walletCards.length) return null;

  async function share() {
    const url = `${window.location.origin}${sharePath(walletCards)}`;
    try {
      if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
        await navigator.share({ title: "My wallet on MyCreditCardinal", url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* share sheet dismissed */
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-subtle flex items-center justify-between gap-3">
      <span className="text-[13px] text-tertiary">
        Share this wallet. Friends see it at their own spending.
      </span>
      <button
        onClick={share}
        className="shrink-0 px-3 py-2 rounded-md border border-medium text-[13px] font-medium text-ink hover:border-strong"
      >
        {copied ? "Link copied" : "Share link"}
      </button>
    </div>
  );
}

function CategoryCompare({
  real,
  sandbox,
  tier,
}: {
  real: { walletCards: WalletCard[]; spend: Record<string, number> };
  sandbox: { walletCards: WalletCard[]; spend: Record<string, number> };
  tier: "floor" | "composite" | "ceiling";
}) {
  const a = useMemo(() => valueByCategory(real.walletCards, real.spend, tier), [real, tier]);
  const b = useMemo(() => valueByCategory(sandbox.walletCards, sandbox.spend, tier), [sandbox, tier]);
  const rows = CATEGORIES.filter((c) => (sandbox.spend[c.id] ?? 0) > 0 || (real.spend[c.id] ?? 0) > 0);
  if (!rows.length) return null;

  return (
    <section>
      <h2 className="text-[18px] font-semibold text-ink mb-3">Side by side, per year</h2>
      <div className="bg-white border border-subtle rounded-lg overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-[12px] text-tertiary border-b border-subtle">
              <th className="text-left font-normal px-3 sm:px-4 py-2">Category</th>
              <th className="text-left font-normal px-2 py-2">Your wallet</th>
              <th className="text-left font-normal px-2 sm:px-4 py-2">Sandbox</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-subtle">
            {rows.map((c) => {
              const ra = a[c.id];
              const rb = b[c.id];
              const diff = rb.value - ra.value;
              return (
                <tr key={c.id} className="align-top">
                  <td className="px-3 sm:px-4 py-2 text-secondary">{c.label.split(" /")[0]}</td>
                  <td className="px-2 py-2">
                    <div className="font-mono text-ink">{usd(ra.value)}</div>
                    <div className="text-[11px] text-tertiary truncate max-w-[9rem] sm:max-w-none">{ra.cardName ?? "—"}</div>
                  </td>
                  <td className="px-2 sm:px-4 py-2">
                    <div className="font-mono text-ink">
                      {usd(rb.value)}
                      {Math.round(diff) !== 0 && (
                        <span className={`ml-1.5 text-[11px] ${diff > 0 ? "text-green" : "text-red"}`}>{signed(diff)}</span>
                      )}
                    </div>
                    <div className="text-[11px] text-tertiary truncate max-w-[9rem] sm:max-w-none">{rb.cardName ?? "—"}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
