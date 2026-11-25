import type { Card } from "@/types";
import { CATEGORIES } from "@/lib/categories";
import { CURRENCY_MAP } from "@/lib/currencies";

const CAT_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c.label])
);

const CASH_CURRENCIES = new Set(["cash", "discover"]);
const COBRAND_CURRENCIES = new Set(["hyatt", "united", "delta", "marriott", "hilton"]);

export type CardKind = "cash" | "travel" | "cobrand";

/** Rough family a card belongs to, for the Browse filters. */
export function cardKind(card: Card): CardKind {
  if (CASH_CURRENCIES.has(card.currency)) return "cash";
  if (COBRAND_CURRENCIES.has(card.currency)) return "cobrand";
  return "travel";
}

function unit(card: Card): string {
  return CASH_CURRENCIES.has(card.currency) ? "%" : "x";
}

/** "3x" for points cards, "3%" for cash-back cards. */
export function rateLabel(card: Card, rate: number): string {
  return `${rate}${unit(card)}`;
}

export interface EarnLine {
  rate: string;
  label: string;
}

/**
 * The few earn rates worth showing on a card tile, best first, ending with the
 * base rate. Categories that share a rate are joined ("Dining & groceries").
 */
export function earnLines(card: Card, max = 3): EarnLine[] {
  const base = card.earn_json.other ?? 1;
  const lines: EarnLine[] = [];

  if (card.rotating) lines.push({ rate: rateLabel(card, 5), label: "Rotating quarterly categories" });
  if (card.custom_select && card.custom_rate != null) {
    lines.push({
      rate: rateLabel(card, card.custom_rate),
      label: card.custom_max === 1 ? "Your top category" : `${card.custom_max} categories you pick`,
    });
  }

  const byRate = new Map<number, string[]>();
  for (const cat of CATEGORIES) {
    if (cat.id === "other") continue;
    const r = card.earn_json[cat.id] ?? base;
    if (r <= base) continue;
    byRate.set(r, [...(byRate.get(r) ?? []), CAT_LABEL[cat.id]]);
  }
  const tiers = [...byRate.entries()].sort((a, b) => b[0] - a[0]);
  for (const [r, labels] of tiers) {
    if (lines.length >= max - 1) break;
    const text =
      labels.length <= 2
        ? labels.join(" & ")
        : `${labels.slice(0, 2).join(", ")} +${labels.length - 2} more`;
    lines.push({ rate: rateLabel(card, r), label: text.charAt(0) + text.slice(1).toLowerCase() });
  }

  lines.push({
    rate: rateLabel(card, base),
    label: lines.length === 0 ? "Everything" : "Everything else",
  });
  return lines;
}

export function feeLabel(fee: number): string {
  return fee === 0 ? "No annual fee" : `$${fee}/yr`;
}

// ─── Browse sorting ───────────────────────────────────────────────────────────

/** Cents per point at the app's typical ("composite") valuation; 1¢ if unknown. */
function centsPerPoint(card: Card): number {
  return (CURRENCY_MAP[card.currency]?.composite ?? 100) / 100;
}

/** Welcome bonus in dollars at typical point values (0 when there is none). */
export function welcomeBonusValue(card: Card): number {
  const sub = card.sub_json;
  return sub ? (sub.points * centsPerPoint(card)) / 100 : 0;
}

/**
 * Best everyday rate in a category: the listed rate, or a pick-your-category
 * rate when the category is eligible. Rotating 5% is left out because it only
 * applies some quarters.
 */
export function categoryRate(card: Card, categoryId: string): number {
  const base = card.earn_json.other ?? 1;
  let rate = card.earn_json[categoryId] ?? base;
  if (card.custom_select && card.custom_rate != null && card.custom_opts?.includes(categoryId)) {
    rate = Math.max(rate, card.custom_rate);
  }
  return rate;
}

/** Cents back per dollar in a category, so points and cash cards compare fairly. */
export function categoryValue(card: Card, categoryId: string): number {
  return categoryRate(card, categoryId) * centsPerPoint(card);
}

export type BrowseSort =
  | "featured"
  | "fee-asc"
  | "fee-desc"
  | "bonus"
  | "name"
  | "issuer"
  | "newest"
  | `cat:${string}`;

/**
 * Sorts cards for the Browse page. `catalogIndex` gives each card's position in
 * the catalog (later = added more recently); custom cards count as newest.
 */
export function sortCards(cards: Card[], sort: BrowseSort, catalogIndex: Map<string, number>): Card[] {
  const idx = (c: Card) => catalogIndex.get(c.id) ?? Number.MAX_SAFE_INTEGER;
  const byName = (a: Card, b: Card) => a.name.localeCompare(b.name);
  const out = [...cards];
  if (sort.startsWith("cat:")) {
    const cat = sort.slice(4);
    return out.sort((a, b) => categoryValue(b, cat) - categoryValue(a, cat) || a.fee - b.fee || byName(a, b));
  }
  switch (sort) {
    case "fee-asc": return out.sort((a, b) => a.fee - b.fee || byName(a, b));
    case "fee-desc": return out.sort((a, b) => b.fee - a.fee || byName(a, b));
    case "bonus": return out.sort((a, b) => welcomeBonusValue(b) - welcomeBonusValue(a) || byName(a, b));
    case "name": return out.sort(byName);
    case "issuer": return out.sort((a, b) => a.issuer.localeCompare(b.issuer) || byName(a, b));
    case "newest": return out.sort((a, b) => idx(b) - idx(a));
    default: return out;
  }
}
