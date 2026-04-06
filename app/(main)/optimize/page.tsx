"use client";

import { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import { CARDS } from "@/lib/cards";
import { CURRENCIES, CURRENCY_MAP } from "@/lib/currencies";
import { CATEGORIES } from "@/lib/categories";
import { getRecommendations, routeAnnual, calculateFees, calculateSubValue } from "@/lib/engine";
import type { OptimizerPreferences } from "@/lib/engine";
import type { Recommendation } from "@/types";
import { cardGradient, isLightBackground } from "@/lib/utils";
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDollar(n: number): string {
  return `$${Math.round(Math.abs(n)).toLocaleString()}`;
}

function fmtPoints(n: number): string {
  return Math.round(n).toLocaleString();
}

// All distinct issuers in the card database
const ALL_ISSUERS = Array.from(new Set(CARDS.map((c) => c.issuer))).sort();

const FEE_OPTIONS = [
  { label: "Any fee", value: "any" },
  { label: "No fee ($0)", value: "0" },
  { label: "Under $100", value: "100" },
  { label: "Under $250", value: "250" },
  { label: "Under $500", value: "500" },
  { label: "Any amount", value: "any" },
];

const SCORE_OPTIONS = [
  { label: "Any credit score", value: "any" },
  { label: "Excellent (750+)", value: "750" },
  { label: "Good (700+)", value: "700" },
  { label: "Fair (670+)", value: "670" },
];

// ─── Mini card face ────────────────────────────────────────────────────────────

function MiniCardFace({ colorJson, name, issuer }: { colorJson: string[]; name: string; issuer: string }) {
  const gradient = cardGradient(colorJson);
  const lightBg = isLightBackground(colorJson);
  return (
    <div
      className="w-14 h-9 rounded-md flex-shrink-0 flex flex-col justify-end p-1.5 overflow-hidden"
      style={{ background: gradient }}
    >
      <div className={`text-[7px] font-medium leading-none truncate ${lightBg ? "text-black/60" : "text-white/60"}`}>
        {issuer}
      </div>
      <div className={`text-[8px] font-semibold leading-tight truncate ${lightBg ? "text-black/90" : "text-white/90"}`}>
        {name}
      </div>
    </div>
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
  const { getActiveWalletCards, spend, overrides, valuationTier, subEarned } = useStore();
  const walletCards = getActiveWalletCards();
  const tier = valuationTier;
  const subEarnedSet = new Set(subEarned);

  const quarterConfigs: Partial<Record<1 | 2 | 3 | 4, typeof walletCards[number]["config"][]>> = {};

  const currentAnnual = routeAnnual(walletCards, spend, overrides, quarterConfigs, tier);
  const currentFees = calculateFees(walletCards);
  const currentSubValue = calculateSubValue(walletCards, subEarnedSet, tier);

  // Build a synthetic wallet card for the candidate
  const syntheticConfig = {
    rotQ: [
      rec.card.rot_opts?.[0] ?? null,
      rec.card.rot_opts?.[0] ?? null,
      rec.card.rot_opts?.[0] ?? null,
      rec.card.rot_opts?.[0] ?? null,
    ] as [string | null, string | null, string | null, string | null],
    custom: rec.card.custom_opts?.slice(0, rec.card.custom_max ?? 0) ?? [],
  };
  const syntheticWc = { id: "__whatif__", card: rec.card, config: syntheticConfig };
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
          <MiniCardFace colorJson={rec.card.color_json} name={rec.card.name} issuer={rec.card.issuer} />
          <div>
            <div className="text-[13px] font-medium text-primary">{rec.card.name}</div>
            <div className="text-[11px] text-secondary">
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
                <div className="text-[10px] font-semibold text-tertiary uppercase tracking-wider">{col.label}</div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[12px]">
                    <span className="text-secondary">Annual earn</span>
                    <span className="text-primary font-medium">{fmtDollar(col.earn)}</span>
                  </div>
                  <div className="flex justify-between text-[12px]">
                    <span className="text-secondary">Net fees</span>
                    <span className="text-red font-medium">−{fmtDollar(col.fees)}</span>
                  </div>
                  <div className="flex justify-between text-[12px]">
                    <span className="text-secondary">SUBs earned</span>
                    <span className="text-primary font-medium">{fmtDollar(col.subs)}</span>
                  </div>
                  <div className="flex justify-between text-[12px] pt-1.5 border-t border-subtle">
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
            <div className="text-[10px] font-semibold text-tertiary uppercase tracking-wider mb-2">
              Earn rate improvements
            </div>
            <div className="space-y-1">
              {rec.improvements.map((imp) => {
                const cat = CATEGORIES.find((c) => c.id === imp.categoryId);
                return (
                  <div key={imp.categoryId} className="flex items-center justify-between text-[12px]">
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

// ─── Recommendation card ───────────────────────────────────────────────────────

function RecommendationCard({
  rec,
  onAddToWallet,
  inWallet,
}: {
  rec: Recommendation;
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
          <MiniCardFace colorJson={rec.card.color_json} name={rec.card.name} issuer={rec.card.issuer} />
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium text-primary truncate">{rec.card.name}</div>
            <div className="text-[11px] text-secondary">
              {rec.card.issuer} · {rec.card.fee === 0 ? "No annual fee" : `$${rec.card.fee}/yr`}
            </div>
          </div>
          {/* Net value */}
          <div className="text-right flex-shrink-0">
            <div className={`text-[22px] font-semibold leading-none ${rec.netValue >= 0 ? "text-green" : "text-red"}`}>
              {rec.netValue >= 0 ? "+" : "−"}{fmtDollar(rec.netValue)}
            </div>
            <div className="text-[10px] text-tertiary mt-0.5">net / year</div>
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
                  className="inline-flex items-center px-2 py-0.5 rounded-full bg-green/10 text-green text-[11px] font-medium"
                >
                  {cat?.label ?? imp.categoryId}: {imp.currentRate}x→{imp.candidateRate}x
                </span>
              );
            })}
            {rec.improvements.length > 4 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-surface text-secondary border border-subtle text-[11px]">
                +{rec.improvements.length - 4} more
              </span>
            )}
          </div>
        )}

        {/* Value breakdown */}
        <div className="flex items-center gap-4 text-[11px] text-secondary">
          {rec.earnGain > 0 && (
            <span>
              <span className="font-medium text-primary">+{fmtDollar(rec.earnGain)}</span> earn/yr
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

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1 border-t border-subtle">
          <button
            onClick={onAddToWallet}
            className={`flex-1 text-[12px] font-medium px-3 py-1.5 rounded-md transition-colors duration-150 ${
              inWallet
                ? "bg-green/10 text-green hover:bg-green/20"
                : "bg-green hover:bg-green/90 text-white"
            }`}
          >
            {inWallet ? "In wallet ✓" : "Add to wallet"}
          </button>
          <button
            onClick={() => setWhatIfOpen(true)}
            className="text-[12px] font-medium px-3 py-1.5 rounded-md border border-subtle text-secondary hover:text-primary hover:border-medium transition-colors duration-150"
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
  const { getActiveWalletCards, spend, valuationTier, toggleCard, customCards } = useStore();
  const walletCards = getActiveWalletCards();

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
  }), [maxFeeStr, minScoreStr, issuerFilter, currencyFilter]);

  const allCards = useMemo(() => [...CARDS, ...customCards], [customCards]);

  const recommendations = useMemo(
    () => getRecommendations(walletCards, spend, preferences, allCards, valuationTier),
    [walletCards, spend, preferences, allCards, valuationTier]
  );

  const walletCardIds = useMemo(
    () => new Set(walletCards.map((wc) => wc.card.id)),
    [walletCards]
  );

  const { isPro } = useProCheck();

  return (
    <div className="p-6 space-y-5">
      {/* Page header */}
      <div>
        <h1 className="text-[14px] font-semibold text-secondary uppercase tracking-wider">Optimizer</h1>
        <p className="text-[12px] text-tertiary mt-0.5">
          Cards ranked by net annual value added to your wallet
        </p>
      </div>

      {/* Preference filters */}
      <div className="bg-white border border-subtle rounded-lg p-4">
        <div className="text-[10px] font-semibold text-tertiary uppercase tracking-wider mb-3">Filters</div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <div>
            <div className="text-[11px] font-medium text-secondary mb-1">Max annual fee</div>
            <Select value={maxFeeStr} onValueChange={(v) => v && setMaxFeeStr(v)}>
              <SelectTrigger className="h-8 text-[12px]">
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
            <div className="text-[11px] font-medium text-secondary mb-1">Credit score</div>
            <Select value={minScoreStr} onValueChange={(v) => v && setMinScoreStr(v)}>
              <SelectTrigger className="h-8 text-[12px]">
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
            <div className="text-[11px] font-medium text-secondary mb-1">Preferred issuer</div>
            <Select value={issuerFilter} onValueChange={(v) => v && setIssuerFilter(v)}>
              <SelectTrigger className="h-8 text-[12px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any issuer</SelectItem>
                {ALL_ISSUERS.map((iss) => (
                  <SelectItem key={iss} value={iss}>{iss}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="text-[11px] font-medium text-secondary mb-1">Preferred currency</div>
            <Select value={currencyFilter} onValueChange={(v) => v && setCurrencyFilter(v)}>
              <SelectTrigger className="h-8 text-[12px]">
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

      {/* No wallet state */}
      {walletCards.length === 0 && (
        <div className="bg-white border border-subtle rounded-lg p-8 text-center">
          <div className="text-[13px] text-secondary">Add cards to your wallet to see recommendations.</div>
          <div className="text-[11px] text-tertiary mt-1">The optimizer compares candidates against your current earn rates.</div>
        </div>
      )}

      {/* No results */}
      {walletCards.length > 0 && recommendations.length === 0 && (
        <div className="bg-white border border-subtle rounded-lg p-8 text-center">
          <div className="text-[13px] text-secondary">No recommendations match your current filters.</div>
          <div className="text-[11px] text-tertiary mt-1">Try relaxing the fee or credit score filters.</div>
        </div>
      )}

      {/* Recommendation grid */}
      {recommendations.length > 0 && (
        <div className="space-y-3">
          <div className="text-[10px] font-semibold text-tertiary uppercase tracking-wider">
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
                        onAddToWallet={() => {}}
                        inWallet={walletCardIds.has(rec.card.id)}
                      />
                    </div>
                    {/* Upgrade overlay */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 rounded-lg">
                      <div className="text-[13px] font-semibold text-primary">Upgrade to Pro</div>
                      <div className="text-[11px] text-secondary mt-0.5 text-center px-4">
                        See {recommendations.length - 2} more recommendation{recommendations.length - 2 !== 1 ? "s" : ""}
                      </div>
                      <button className="mt-3 px-4 py-1.5 bg-green hover:bg-green/90 text-white text-[12px] font-medium rounded-md transition-colors duration-150">
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
                  onAddToWallet={() => toggleCard(rec.card.id)}
                  inWallet={walletCardIds.has(rec.card.id)}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
