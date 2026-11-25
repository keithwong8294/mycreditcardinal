/**
 * Wallet sandbox: preset wallets, a yearly value score, "what if I added
 * this card?" and shareable wallet links. Pure functions (no store access),
 * so the landing page can use them at build time.
 */
import type { Card, CardConfig, WalletCard } from "@/types";
import { CARDS, CARD_MAP } from "./cards";
import { CATEGORIES } from "./categories";
import { candidateConfig, pooledCurrencies, routeAnnual, type CreditUsage, type Valuation } from "./engine";
import { CURRENCY_MAP } from "./currencies";

// ─── Presets ──────────────────────────────────────────────────────────────────

export interface WalletPreset {
  id: string;
  name: string;
  blurb: string;
  cardIds: string[];
  /** Other cards that would score the same in this wallet (shown as "or"). */
  alternatives?: string[];
}

export const WALLET_PRESETS: WalletPreset[] = [
  {
    id: "one-card",
    name: "One card, 2% everywhere",
    blurb: "The simplest wallet there is. The baseline every other setup has to beat.",
    cardIds: ["wf_active_cash"],
    alternatives: ["citi_double_cash", "synchrony_premier", "fidelity_rewards", "bread_cashback"],
  },
  {
    id: "no-fee-starter",
    name: "No-fee starter",
    blurb: "$0 in fees. Savor's 3% on food turns into miles with VentureOne, plus Freedom Flex's rotating 5%.",
    cardIds: ["c1_savorone", "c1_ventureone", "cff"],
  },
  {
    id: "chase-trifecta",
    name: "Chase trifecta",
    blurb: "Sapphire Preferred plus both Freedoms. The Sapphire turns the Freedoms' cash back into travel points.",
    cardIds: ["csp", "cfu", "cff"],
  },
  {
    id: "amex-foodie",
    name: "Amex foodie",
    blurb: "Gold's 4x on restaurants and groceries, Blue Cash Preferred's 6% on streaming and 3% on gas and transit.",
    cardIds: ["amex_gold", "amex_bcp"],
  },
  {
    id: "citi-trifecta",
    name: "Citi trifecta",
    blurb: "Strata Premier, Custom Cash and Double Cash, all feeding ThankYou points.",
    cardIds: ["citi_strata_premier", "citi_custom_cash", "citi_double_cash"],
  },
  {
    id: "venture-duo",
    name: "Capital One duo",
    blurb: "Venture X's 2x miles everywhere, Savor's 3% on dining and groceries moved over as miles. Its travel credit and anniversary miles cover the fee.",
    cardIds: ["c1_venturex", "c1_savorone"],
  },
  {
    id: "chase-premium",
    name: "Chase premium",
    blurb: "Sapphire Reserve instead of Preferred: more on travel, a $795 fee that its credits have to cover.",
    cardIds: ["csr", "cfu", "cff"],
  },
  {
    id: "renter",
    name: "Renter’s wallet",
    blurb: "Bilt Obsidian earns points on rent with no fee, plus 3x on dining or groceries.",
    cardIds: ["bilt_obsidian"],
  },
];

/** "Citi Double Cash, Synchrony Premier World Mastercard, …" for a preset's alternatives. */
export function alternativeNames(preset: WalletPreset): string[] {
  return (preset.alternatives ?? [])
    .map((id) => CARD_MAP[id])
    .filter(Boolean)
    .map((c) => `${c.issuer} ${c.name}`);
}

export const PRESET_MAP: Record<string, WalletPreset> = Object.fromEntries(
  WALLET_PRESETS.map((p) => [p.id, p])
);

/** Builds wallet cards for a list of card ids, set up for this spending. */
export function buildWallet(
  entries: { cardId: string; config?: CardConfig }[],
  spend: Record<string, number>,
  lookup: (id: string) => Card | undefined = (id) => CARD_MAP[id]
): WalletCard[] {
  const out: WalletCard[] = [];
  for (const { cardId, config } of entries) {
    const card = lookup(cardId);
    if (!card || out.some((w) => w.card.id === cardId)) continue;
    out.push({ id: `sb_${cardId}`, card, config: config ?? candidateConfig(card, spend) });
  }
  return out;
}

// ─── Yearly value score ───────────────────────────────────────────────────────

const CREDIT_SHARE: Record<CreditUsage, number> = { none: 0, some: 0.5, all: 1 };

export interface WalletScore {
  /** Rewards earned in a year at this spending. */
  rewards: number;
  /** Annual fees. */
  fees: number;
  /** Statement credits counted (share you'd use, capped at each card's fee). */
  credits: number;
  /** Sign-up bonuses this spending reaches in time (first year only). */
  subs: number;
  /** rewards + credits − fees: what the wallet is worth each year after the first. */
  net: number;
  /** net + sign-up bonuses: the first year. */
  firstYear: number;
  /** Yearly spend. */
  spend: number;
  /** Net value per $100 spent, the "effective return" in percent. */
  returnPct: number;
}

export function scoreWallet(
  walletCards: WalletCard[],
  spend: Record<string, number>,
  tier: Valuation = "composite",
  creditUsage: CreditUsage = "some"
): WalletScore {
  const rewards = walletCards.length ? routeAnnual(walletCards, spend, {}, {}, tier).totalDollarValue : 0;
  let fees = 0;
  let credits = 0;
  for (const { card } of walletCards) {
    fees += card.fee;
    const c = card.perks_json.reduce((s, p) => s + (p.annual_credit ?? 0), 0) * CREDIT_SHARE[creditUsage];
    credits += Math.min(c, card.fee);
  }
  const monthly = Object.values(spend).reduce((s, v) => s + (v > 0 ? v : 0), 0);
  const yearSpend = monthly * 12;
  const subs = subValue(walletCards, monthly, tier);
  const net = rewards + credits - fees;
  return {
    rewards,
    fees,
    credits,
    subs,
    net,
    firstYear: net + subs,
    spend: yearSpend,
    returnPct: yearSpend ? (net / yearSpend) * 100 : 0,
  };
}

/**
 * Sign-up bonuses worth counting in year 1. A card's bonus counts when this
 * monthly spending, all put on that card, meets its requirement in time, and
 * the requirements of all counted bonuses fit in a year of spending (cards
 * opened one after another). Biggest bonuses first; valued like the card's
 * rewards (pooled currency, same point values).
 */
export function subValue(walletCards: WalletCard[], monthlySpend: number, tier: Valuation = "composite"): number {
  const pooled = pooledCurrencies(walletCards);
  const offers = walletCards
    .filter((wc) => wc.card.sub_json)
    .map((wc) => {
      const sub = wc.card.sub_json!;
      const currency = pooled.get(wc.id) ?? wc.card.currency;
      const cpp = typeof tier === "function" ? tier(currency) : (CURRENCY_MAP[currency]?.[tier] ?? 100);
      return { sub, value: (sub.points * cpp) / 10000 };
    })
    .sort((a, b) => b.value - a.value);
  let total = 0;
  let committed = 0;
  for (const { sub, value } of offers) {
    if (monthlySpend * sub.timeframe_months < sub.spend_requirement) continue;
    if (committed + sub.spend_requirement > monthlySpend * 12) continue;
    committed += sub.spend_requirement;
    total += value;
  }
  return total;
}

/** Per-category yearly value (primary + overflow), for side-by-side tables. */
export function valueByCategory(
  walletCards: WalletCard[],
  spend: Record<string, number>,
  tier: Valuation = "composite"
): Record<string, { value: number; cardName: string | null }> {
  const out: Record<string, { value: number; cardName: string | null }> = {};
  for (const c of CATEGORIES) out[c.id] = { value: 0, cardName: null };
  if (!walletCards.length) return out;
  const result = routeAnnual(walletCards, spend, {}, {}, tier);
  const topSpend: Record<string, number> = {};
  for (const row of result.rows) {
    const o = (out[row.categoryId] ??= { value: 0, cardName: null });
    o.value += row.dollarValue + row.overflow.reduce((s, ov) => s + ov.dollarValue, 0);
    // Name the card that carries the most spend in the category over the year.
    const key = `${row.categoryId}|${row.walletCard.card.name}`;
    topSpend[key] = (topSpend[key] ?? 0) + row.spend;
  }
  for (const c of CATEGORIES) {
    let best = -1;
    for (const [key, s] of Object.entries(topSpend)) {
      const [cat, name] = key.split("|");
      if (cat === c.id && s > best) {
        best = s;
        out[c.id].cardName = name;
      }
    }
  }
  return out;
}

// ─── What if I added this card? ───────────────────────────────────────────────

export interface WhatIf {
  card: Card;
  /** Change in yearly net value from adding the card. */
  delta: number;
  after: WalletScore;
}

export function whatIfAdd(
  walletCards: WalletCard[],
  spend: Record<string, number>,
  card: Card,
  tier: Valuation = "composite",
  creditUsage: CreditUsage = "some",
  before: WalletScore = scoreWallet(walletCards, spend, tier, creditUsage)
): WhatIf {
  const after = scoreWallet(
    [...walletCards, { id: `whatif_${card.id}`, card, config: candidateConfig(card, spend) }],
    spend,
    tier,
    creditUsage
  );
  return { card, delta: after.net - before.net, after };
}

/** Cards not in the wallet, ranked by how much each would add on its own. */
export function bestAdditions(
  walletCards: WalletCard[],
  spend: Record<string, number>,
  tier: Valuation = "composite",
  creditUsage: CreditUsage = "some",
  limit = 5,
  cards: Card[] = CARDS
): WhatIf[] {
  const held = new Set(walletCards.map((w) => w.card.id));
  const before = scoreWallet(walletCards, spend, tier, creditUsage);
  return cards
    .filter((c) => c.status === "active" && !held.has(c.id) && !c.business)
    .map((c) => whatIfAdd(walletCards, spend, c, tier, creditUsage, before))
    .filter((w) => w.delta > 1)
    .sort((a, b) => b.delta - a.delta || a.card.fee - b.card.fee)
    .slice(0, limit);
}

// ─── Share links ──────────────────────────────────────────────────────────────

/**
 * Encodes a wallet as "cardId.cardId~pick+pick": card ids joined by ".", with
 * custom-select picks after "~". Rotating picks follow the issuer calendar on
 * the other end, and spending is never shared.
 */
export function encodeWallet(walletCards: WalletCard[]): string {
  return walletCards
    .filter((w) => CARD_MAP[w.card.id]) // custom cards only exist locally
    .map((w) => (w.config.custom.length ? `${w.card.id}~${w.config.custom.join("+")}` : w.card.id))
    .join(".");
}

export function decodeWallet(code: string | null | undefined): { cardId: string; config?: CardConfig }[] {
  if (!code) return [];
  const out: { cardId: string; config?: CardConfig }[] = [];
  for (const part of code.split(".").slice(0, 20)) {
    const [cardId, picks] = part.split("~");
    const card = CARD_MAP[cardId];
    if (!card || out.some((e) => e.cardId === cardId)) continue;
    const custom = (picks ?? "")
      .split("+")
      .filter((p) => card.custom_opts?.includes(p))
      .slice(0, card.custom_max ?? 0);
    out.push(custom.length ? { cardId, config: { rotQ: [null, null, null, null], custom } } : { cardId });
  }
  return out;
}

/** Path (with query) that opens a wallet in the sandbox. */
export function sharePath(walletCards: WalletCard[]): string {
  return `/sandbox?w=${encodeURIComponent(encodeWallet(walletCards))}`;
}
