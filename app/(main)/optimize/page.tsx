"use client";

import { PageHeader } from "@/components/PageHeader";
import { useState, useMemo, useEffect } from "react";
import { CARDS } from "@/lib/cards";
import { useStore } from "@/lib/store";
import { CURRENCIES, CURRENCY_MAP } from "@/lib/currencies";
import { CATEGORIES } from "@/lib/categories";
import {
  getRecommendationSummary,
  routeAnnual,
  calculateFees,
  calculateSubValue,
  candidateConfig,
  rankingValuation,
} from "@/lib/engine";
import type { OptimizerPreferences, CardGoal, CreditUsage, Redemption, Ecosystem } from "@/lib/engine";
import type { Recommendation } from "@/types";
import type { Card } from "@/types";
import { isLightBackground } from "@/lib/utils";
import { CardArt } from "@/components/CardArt";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useProCheck } from "@/lib/useProCheck";
import { trackOptimizerViewed, trackOptimizerCardAdded } from "@/lib/analytics";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDollar(n: number): string {
  return `$${Math.round(Math.abs(n)).toLocaleString()}`;
}

function fmtPoints(n: number): string {
  return Math.round(n).toLocaleString();
}

const FEE_OPTIONS = [
  { label: "Any fee", value: "any" },
  { label: "No fee ($0)", value: "0" },
  { label: "Under $100", value: "100" },
  { label: "Under $250", value: "250" },
  { label: "Under $500", value: "500" },
  { label: "Any amount", value: "any" },
];

const GOAL_OPTIONS: { value: CardGoal; label: string; hint: string }[] = [
  { value: "everyday", label: "Earn more on everyday spending", hint: "Ranks by value every year; welcome bonuses are spread over a few years." },
  { value: "bonuses", label: "Collect sign-up bonuses", hint: "Welcome bonuses count in full, as long as your spend can hit the minimum." },
  { value: "cashback", label: "Simple cash back", hint: "Points are valued at what they cash out for, not transfer value." },
  { value: "travel", label: "Travel rewards", hint: "Only transferable points and airline or hotel cards." },
  { value: "credit", label: "Build my credit", hint: "No-fee cards with easier approval; bonuses are ignored." },
];

const REDEMPTION_OPTIONS: { value: Redemption; label: string }[] = [
  { value: "flexible", label: "Not sure yet" },
  { value: "flights", label: "Flights" },
  { value: "hotels", label: "Hotels" },
  { value: "cash", label: "Cash or statement credit" },
];

const ECOSYSTEM_OPTIONS: { value: Ecosystem; label: string }[] = [
  { value: "open", label: "Open to a new bank" },
  { value: "stay", label: "Stick with my current programs" },
];

const CREDIT_USAGE_OPTIONS: { value: CreditUsage; label: string }[] = [
  { value: "none", label: "Rarely" },
  { value: "some", label: "About half" },
  { value: "all", label: "All of them" },
];

function ChoiceChips<T extends string | boolean>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={`text-[13px] px-3 py-1.5 rounded-full border transition-colors duration-150 ${
              active
                ? "bg-ink text-paper border-ink"
                : "bg-white text-secondary border-subtle hover:border-medium hover:text-primary"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Question({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[13px] font-medium text-primary mb-1.5">{label}</div>
      {children}
    </div>
  );
}

const SCORE_OPTIONS = [
  { label: "Any credit score", value: "any" },
  { label: "Excellent (750+)", value: "750" },
  { label: "Good (700+)", value: "700" },
  { label: "Fair (670+)", value: "670" },
];

// ─── Mini card face ────────────────────────────────────────────────────────────

function MiniCardFace({ card }: { card: Card }) {
  const lightBg = isLightBackground(card.color_json);
  return (
    <CardArt card={card} className="w-16 h-10 rounded-md shadow-[0_1px_2px_rgba(0,0,0,0.12)]">
      <div className="absolute inset-0 flex flex-col justify-end p-1.5">
        <div className={`text-[7px] font-medium leading-none truncate ${lightBg ? "text-black/60" : "text-white/60"}`}>
          {card.issuer}
        </div>
        <div className={`text-[8px] font-semibold leading-tight truncate ${lightBg ? "text-black/90" : "text-white/90"}`}>
          {card.name}
        </div>
      </div>
    </CardArt>
  );
}

// ─── What-if modal ─────────────────────────────────────────────────────────────

function WhatIfModal({
  rec,
  open,
  onClose,
}: {
  rec: Recommendation;
  open: boolean;
  onClose: () => void;
}) {
  const { getActiveWalletCards, getActivePersonSpend, overrides, valuationTier, subEarned, optimizerAnswers } = useStore();
  const spend = getActivePersonSpend();
  const walletCards = getActiveWalletCards();
  const tier = rankingValuation(optimizerAnswers, walletCards, valuationTier);
  const subEarnedSet = new Set(subEarned);

  const quarterConfigs: Partial<Record<1 | 2 | 3 | 4, typeof walletCards[number]["config"][]>> = {};

  const currentAnnual = routeAnnual(walletCards, spend, overrides, quarterConfigs, tier);
  const currentFees = calculateFees(walletCards);
  const currentSubValue = calculateSubValue(walletCards, subEarnedSet, tier);

  // Build a synthetic wallet card for the candidate
  const syntheticWc = { id: "__whatif__", card: rec.card, config: candidateConfig(rec.card, spend) };
  const withCard = [...walletCards, syntheticWc];

  const withAnnual = routeAnnual(withCard, spend, overrides, quarterConfigs, tier);
  const withFees = calculateFees(withCard);
  const withSubValue = calculateSubValue(withCard, subEarnedSet, tier);

  const currency = CURRENCY_MAP[rec.card.currency];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[14px] font-semibold text-primary">
            What-if: Adding {rec.card.name}
          </DialogTitle>
        </DialogHeader>

        {/* Card identity */}
        <div className="flex items-center gap-3 pb-3 border-b border-subtle">
          <MiniCardFace card={rec.card} />
          <div>
            <div className="text-[14px] font-medium text-primary">{rec.card.name}</div>
            <div className="text-[12px] text-secondary">
              {rec.card.issuer} · {currency?.name ?? rec.card.currency} · {rec.card.fee === 0 ? "No annual fee" : `$${rec.card.fee}/yr`}
            </div>
          </div>
        </div>

        {/* Before / after comparison */}
        <div className="grid grid-cols-2 gap-3">
          {[
            {
              label: "Current wallet",
              earn: currentAnnual.totalDollarValue,
              fees: currentFees.netFees,
              subs: currentSubValue,
            },
            {
              label: `+ ${rec.card.name}`,
              earn: withAnnual.totalDollarValue,
              fees: withFees.netFees,
              subs: withSubValue,
            },
          ].map((col) => {
            const net = col.earn + col.subs - col.fees;
            return (
              <div key={col.label} className="bg-surface rounded-lg p-3 space-y-2">
                <div className="text-[13px] font-medium text-tertiary">{col.label}</div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[13px]">
                    <span className="text-secondary">Annual earn</span>
                    <span className="text-primary font-medium">{fmtDollar(col.earn)}</span>
                  </div>
                  <div className="flex justify-between text-[13px]">
                    <span className="text-secondary">Net fees</span>
                    <span className="text-red font-medium">−{fmtDollar(col.fees)}</span>
                  </div>
                  <div className="flex justify-between text-[13px]">
                    <span className="text-secondary">SUBs earned</span>
                    <span className="text-primary font-medium">{fmtDollar(col.subs)}</span>
                  </div>
                  <div className="flex justify-between text-[13px] pt-1.5 border-t border-subtle">
                    <span className="text-secondary font-medium">Net value</span>
                    <span className={`font-semibold ${net >= 0 ? "text-green" : "text-red"}`}>
                      {net >= 0 ? "" : "−"}{fmtDollar(net)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Category improvements */}
        {rec.improvements.length > 0 && (
          <div>
            <div className="text-[13px] font-medium text-tertiary mb-2">
              Earn rate improvements
            </div>
            <div className="space-y-1">
              {rec.improvements.map((imp) => {
                const cat = CATEGORIES.find((c) => c.id === imp.categoryId);
                return (
                  <div key={imp.categoryId} className="flex items-center justify-between text-[13px]">
                    <span className="text-secondary">{cat?.label ?? imp.categoryId}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-tertiary">{imp.currentRate}x → {imp.candidateRate}x</span>
                      <span className="text-green font-medium">+{fmtDollar(imp.annualGain)}/yr</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Explanation generator ────────────────────────────────────────────────────

function generateExplanation(rec: Recommendation, spend: Record<string, number>): string {
  const parts: string[] = [];

  const topImp = rec.improvements[0];
  if (topImp) {
    const catLabel = CATEGORIES.find((c) => c.id === topImp.categoryId)?.label ?? topImp.categoryId;
    const monthly = spend[topImp.categoryId] ?? 0;
    parts.push(
      `Earns ${topImp.candidateRate}x on ${catLabel} vs your current best of ${topImp.currentRate}x` +
        (monthly > 0
          ? `, about ${fmtDollar(topImp.annualGain)} more a year at $${monthly.toLocaleString()}/month.`
          : ".")
    );
  } else {
    parts.push("Doesn't raise your earn rates on its own.");
  }

  if (rec.creditValue > 0) {
    parts.push(`Includes ${fmtDollar(rec.creditValue)} of statement credits you said you'd use.`);
  }

  parts.push(
    rec.ongoingValue >= 0
      ? `After the fee it adds about ${fmtDollar(rec.ongoingValue)} every year.`
      : `Without the bonus it costs about ${fmtDollar(rec.ongoingValue)} a year more than it earns, so it's mainly a bonus play.`
  );

  const sub = rec.card.sub_json;
  if (sub && rec.subValue > 0) {
    parts.push(
      `The ${sub.points.toLocaleString()}-point bonus (~${fmtDollar(rec.subValue)}) needs $${sub.spend_requirement.toLocaleString()} spent in ${sub.timeframe_months} months.`
    );
  } else if (sub && !rec.subReachable) {
    parts.push(
      `Your spend won't reach the $${sub.spend_requirement.toLocaleString()} bonus minimum in ${sub.timeframe_months} months, so the bonus isn't counted.`
    );
  }

  return parts.join(" ");
}

// ─── Recommendation card ───────────────────────────────────────────────────────

function RecommendationCard({
  rec,
  spend,
  onAddToWallet,
  inWallet,
}: {
  rec: Recommendation;
  spend: Record<string, number>;
  onAddToWallet: () => void;
  inWallet: boolean;
}) {
  const [whatIfOpen, setWhatIfOpen] = useState(false);
  const currency = CURRENCY_MAP[rec.card.currency];

  return (
    <>
      <div className="bg-white border border-subtle rounded-lg p-4 flex flex-col gap-3">
        {/* Header row */}
        <div className="flex items-start gap-3">
          <MiniCardFace card={rec.card} />
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-medium text-primary truncate">{rec.card.name}</div>
            <div className="text-[12px] text-secondary">
              {rec.card.issuer} · {rec.card.fee === 0 ? "No annual fee" : `$${rec.card.fee}/yr`}
              {rec.card.business && (
                <span className="ml-1.5 inline-flex items-center px-1.5 py-px rounded bg-surface border border-subtle text-[11px] text-secondary">
                  Business
                </span>
              )}
            </div>
          </div>
          {/* Ongoing value, with first year underneath */}
          <div className="text-right flex-shrink-0">
            <div className={`text-[22px] font-semibold leading-none ${rec.ongoingValue >= 0 ? "text-green" : "text-red"}`}>
              {rec.ongoingValue >= 0 ? "+" : "−"}{fmtDollar(rec.ongoingValue)}
            </div>
            <div className="text-[11px] text-tertiary mt-0.5">per year</div>
            {rec.subValue > 0 && (
              <div className="text-[12px] text-secondary mt-1">
                <span className="font-medium text-primary">
                  {rec.firstYearValue >= 0 ? "+" : "−"}{fmtDollar(rec.firstYearValue)}
                </span>{" "}
                first year
              </div>
            )}
          </div>
        </div>

        {/* Category improvement pills */}
        {rec.improvements.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {rec.improvements.slice(0, 4).map((imp) => {
              const cat = CATEGORIES.find((c) => c.id === imp.categoryId);
              return (
                <span
                  key={imp.categoryId}
                  className="inline-flex items-center px-2 py-0.5 rounded-full bg-green/10 text-green text-[12px] font-medium"
                >
                  {cat?.label ?? imp.categoryId}: {imp.currentRate}x→{imp.candidateRate}x
                </span>
              );
            })}
            {rec.improvements.length > 4 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-surface text-secondary border border-subtle text-[12px]">
                +{rec.improvements.length - 4} more
              </span>
            )}
          </div>
        )}

        {/* Value breakdown */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-secondary">
          {rec.earnGain > 0 && (
            <span>
              <span className="font-medium text-primary">+{fmtDollar(rec.earnGain)}</span> earn/yr
            </span>
          )}
          {rec.creditValue > 0 && (
            <span>
              <span className="font-medium text-primary">+{fmtDollar(rec.creditValue)}</span> credits
            </span>
          )}
          {rec.subValue > 0 && (
            <span>
              <span className="font-medium text-primary">+{fmtDollar(rec.subValue)}</span> SUB
              {rec.card.sub_json && (
                <span className="text-tertiary ml-1">
                  ({fmtPoints(rec.card.sub_json.points)} {currency?.name ?? rec.card.currency})
                </span>
              )}
            </span>
          )}
          {rec.card.fee > 0 && (
            <span>
              <span className="font-medium text-red">−{fmtDollar(rec.card.fee)}</span> fee
            </span>
          )}
        </div>

        {/* Plain-English explanation */}
        <p className="text-[13px] text-secondary leading-relaxed border-t border-subtle pt-2">
          {generateExplanation(rec, spend)}
        </p>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onAddToWallet}
            className={`flex-1 text-[13px] font-medium px-3 py-1.5 rounded-md transition-colors duration-150 ${
              inWallet
                ? "bg-green/10 text-green hover:bg-green/20"
                : "bg-ink hover:bg-ink/85 text-paper"
            }`}
          >
            {inWallet ? "In wallet ✓" : "Add to wallet"}
          </button>
          <button
            onClick={() => setWhatIfOpen(true)}
            className="text-[13px] font-medium px-3 py-1.5 rounded-md border border-subtle text-secondary hover:text-primary hover:border-medium transition-colors duration-150"
          >
            What-if
          </button>
        </div>
      </div>

      <WhatIfModal rec={rec} open={whatIfOpen} onClose={() => setWhatIfOpen(false)} />
    </>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function OptimizePage() {
  const {
    getActiveWalletCards,
    getActivePersonSpend,
    valuationTier,
    toggleCard,
    customCards,
    optimizerAnswers,
    setOptimizerAnswers,
  } = useStore();
  const spend = getActivePersonSpend();
  const walletCards = getActiveWalletCards();

  // Track page view once on mount
  useEffect(() => { trackOptimizerViewed(); }, []);

  // The card list is already in the client bundle (the store imports it),
  // so read it directly instead of lazy-loading it behind a skeleton.
  const baseCards = CARDS;

  const allIssuers = useMemo(
    () => Array.from(new Set(baseCards.map((c) => c.issuer))).sort(),
    [baseCards]
  );

  // Preference filter state
  const [maxFeeStr, setMaxFeeStr] = useState<string>("any");
  const [minScoreStr, setMinScoreStr] = useState<string>("any");
  const [issuerFilter, setIssuerFilter] = useState<string>("any");
  const [currencyFilter, setCurrencyFilter] = useState<string>("any");

  const preferences: OptimizerPreferences = useMemo(() => ({
    maxFee: maxFeeStr === "any" ? null : Number(maxFeeStr),
    minCreditScore: minScoreStr === "any" ? null : Number(minScoreStr),
    preferredIssuers: issuerFilter === "any" ? [] : [issuerFilter],
    preferredCurrencies: currencyFilter === "any" ? [] : [currencyFilter],
    ...optimizerAnswers,
  }), [maxFeeStr, minScoreStr, issuerFilter, currencyFilter, optimizerAnswers]);

  const allCards = useMemo(() => [...baseCards, ...customCards], [baseCards, customCards]);

  const { recommendations, hiddenBusinessCount, hidden524Count } = useMemo(
    () => getRecommendationSummary(walletCards, spend, preferences, allCards, valuationTier),
    [walletCards, spend, preferences, allCards, valuationTier]
  );
  const goalHint = GOAL_OPTIONS.find((g) => g.value === optimizerAnswers.goal)?.hint;

  const walletCardIds = useMemo(
    () => new Set(walletCards.map((wc) => wc.card.id)),
    [walletCards]
  );

  const { isPro } = useProCheck();

  return (
    <div className="px-4 sm:px-8 lg:px-10 pt-6 sm:pt-8 pb-14 mx-auto max-w-[1180px] space-y-6">
      <PageHeader
        title="Find a better card"
        subtitle="Answer a few questions. Cards are ranked by what they add to the wallet you already have."
      />

      {/* Questionnaire */}
      <div className="bg-white border border-subtle rounded-lg p-4 space-y-4">
        <h2 className="text-[18px] font-semibold text-ink">About your next card</h2>

        <Question label="What's your goal with your next card?">
          <ChoiceChips
            options={GOAL_OPTIONS}
            value={optimizerAnswers.goal}
            onChange={(goal) => setOptimizerAnswers({ goal })}
          />
          {goalHint && <div className="text-[12px] text-tertiary mt-1.5">{goalHint}</div>}
        </Question>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Question label="How do you want to use your points?">
            <ChoiceChips
              options={REDEMPTION_OPTIONS}
              value={optimizerAnswers.redemption}
              onChange={(redemption) => setOptimizerAnswers({ redemption })}
            />
          </Question>
          <Question label="New bank, or stay with the programs you have?">
            <ChoiceChips
              options={ECOSYSTEM_OPTIONS}
              value={optimizerAnswers.ecosystem}
              onChange={(ecosystem) => setOptimizerAnswers({ ecosystem })}
            />
          </Question>
          <Question label="Do you have a business or side income?">
            <ChoiceChips
              options={[
                { value: false, label: "No" },
                { value: true, label: "Yes, show business cards" },
              ]}
              value={optimizerAnswers.openToBusinessCards}
              onChange={(openToBusinessCards) => setOptimizerAnswers({ openToBusinessCards })}
            />
          </Question>
          <Question label="Personal cards opened in the last 24 months?">
            <ChoiceChips
              options={[
                { value: false, label: "0 to 4" },
                { value: true, label: "5 or more" },
              ]}
              value={optimizerAnswers.over524}
              onChange={(over524) => setOptimizerAnswers({ over524 })}
            />
          </Question>
          <Question label="How many statement credits would you actually use?">
            <ChoiceChips
              options={CREDIT_USAGE_OPTIONS}
              value={optimizerAnswers.creditUsage}
              onChange={(creditUsage) => setOptimizerAnswers({ creditUsage })}
            />
          </Question>
        </div>
      </div>

      {/* Preference filters */}
      <div className="bg-white border border-subtle rounded-lg p-4">
        <div className="text-[13px] font-medium text-tertiary mb-3">Filters</div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <div>
            <div className="text-[12px] font-medium text-secondary mb-1">Max annual fee</div>
            <Select value={maxFeeStr} onValueChange={(v) => v && setMaxFeeStr(v)}>
              <SelectTrigger className="h-8 text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any fee</SelectItem>
                <SelectItem value="0">No fee</SelectItem>
                <SelectItem value="100">Under $100</SelectItem>
                <SelectItem value="250">Under $250</SelectItem>
                <SelectItem value="500">Under $500</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="text-[12px] font-medium text-secondary mb-1">Credit score</div>
            <Select value={minScoreStr} onValueChange={(v) => v && setMinScoreStr(v)}>
              <SelectTrigger className="h-8 text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCORE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="text-[12px] font-medium text-secondary mb-1">Preferred issuer</div>
            <Select value={issuerFilter} onValueChange={(v) => v && setIssuerFilter(v)}>
              <SelectTrigger className="h-8 text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any issuer</SelectItem>
                {allIssuers.map((iss) => (
                  <SelectItem key={iss} value={iss}>{iss}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="text-[12px] font-medium text-secondary mb-1">Preferred currency</div>
            <Select value={currencyFilter} onValueChange={(v) => v && setCurrencyFilter(v)}>
              <SelectTrigger className="h-8 text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any currency</SelectItem>
                {CURRENCIES.map((cur) => (
                  <SelectItem key={cur.id} value={cur.id}>{cur.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Loading skeleton */}
      {baseCards.length === 0 && (
        <div className="space-y-3 animate-pulse">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white border border-subtle rounded-lg p-4">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-14 h-9 rounded-md bg-hover shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/2 bg-hover rounded" />
                  <div className="h-3 w-1/3 bg-hover rounded" />
                </div>
                <div className="h-7 w-20 bg-hover rounded" />
              </div>
              <div className="h-px bg-hover mb-3" />
              <div className="h-3 w-3/4 bg-hover rounded" />
            </div>
          ))}
        </div>
      )}

      {/* No wallet state */}
      {baseCards.length > 0 && walletCards.length === 0 && recommendations.length === 0 && (
        <div className="bg-white border border-subtle rounded-lg p-8 text-center">
          <div className="text-[14px] text-secondary">Add cards to your wallet to see recommendations.</div>
          <div className="text-[12px] text-tertiary mt-1">The optimizer compares candidates against your current earn rates.</div>
        </div>
      )}

      {/* No results */}
      {baseCards.length > 0 && walletCards.length > 0 && recommendations.length === 0 && (
        <div className="bg-white border border-subtle rounded-lg p-8 text-center">
          <div className="text-[14px] text-secondary">No recommendations match your current filters.</div>
          <div className="text-[12px] text-tertiary mt-1">Try a different goal or relax the fee and credit score filters.</div>
        </div>
      )}

      {/* What the answers hid */}
      {walletCards.length > 0 && (hiddenBusinessCount > 0 || hidden524Count > 0) && (
        <div className="text-[12px] text-tertiary">
          {hiddenBusinessCount > 0 &&
            `${hiddenBusinessCount} business card${hiddenBusinessCount !== 1 ? "s" : ""} hidden since you don't have a business. `}
          {hidden524Count > 0 &&
            `${hidden524Count} Chase card${hidden524Count !== 1 ? "s" : ""} hidden since Chase usually declines applicants with 5+ new cards in 24 months.`}
        </div>
      )}

      {/* Recommendation grid */}
      {baseCards.length > 0 && recommendations.length > 0 && (
        <div className="space-y-3">
          <div className="text-[13px] font-medium text-tertiary">
            {recommendations.length} recommendation{recommendations.length !== 1 ? "s" : ""}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {recommendations.map((rec, idx) => {
              const locked = !isPro && idx >= 2;

              if (locked) {
                return (
                  <div key={rec.card.id} className="relative rounded-lg overflow-hidden">
                    {/* Blurred card underneath */}
                    <div className="select-none pointer-events-none opacity-40 blur-[3px]">
                      <RecommendationCard
                        rec={rec}
                        spend={spend}
                        onAddToWallet={() => {}}
                        inWallet={walletCardIds.has(rec.card.id)}
                      />
                    </div>
                    {/* Upgrade overlay */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 rounded-lg">
                      <div className="text-[14px] font-semibold text-primary">Upgrade to Pro</div>
                      <div className="text-[12px] text-secondary mt-0.5 text-center px-4">
                        See {recommendations.length - 2} more recommendation{recommendations.length - 2 !== 1 ? "s" : ""}
                      </div>
                      <button className="mt-3 px-4 py-1.5 bg-ink hover:bg-ink/85 text-paper text-[13px] font-medium rounded-md transition-colors duration-150">
                        Upgrade to Pro
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <RecommendationCard
                  key={rec.card.id}
                  rec={rec}
                  spend={spend}
                  onAddToWallet={() => {
                    toggleCard(rec.card.id);
                    trackOptimizerCardAdded(rec.card.id, rec.card.name, rec.netValue);
                  }}
                  inWallet={walletCardIds.has(rec.card.id)}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <p className="mt-8 px-4 pb-8 text-[12px] text-tertiary text-center max-w-2xl mx-auto">
        For informational purposes only. Not financial advice. Rewards values and earn rates are
        estimates and may not reflect your specific card version or current issuer terms. Always
        verify with your card issuer before making financial decisions.
      </p>
    </div>
  );
}
