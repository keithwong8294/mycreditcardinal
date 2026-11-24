import type { Card } from "@/types";
import { CATEGORIES } from "@/lib/categories";

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
