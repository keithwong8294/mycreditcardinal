import type { WalletCard } from "./walletCard";

export interface OverflowRow {
  walletCard: WalletCard;
  earnRate: number;
  spend: number;
  points: number;
  dollarValue: number;
}

export interface RoutingRow {
  categoryId: string;
  /** The primary card assigned to this category */
  walletCard: WalletCard;
  earnRate: number;
  spend: number;
  points: number;
  dollarValue: number;
  /** True if this card's cap is reached for this category */
  capHit: boolean;
  /** Overflow rows when spend exceeds the primary card's cap */
  overflow: OverflowRow[];
  /** Manual override: wallet card ID, or null for auto-routing */
  override: string | null;
}

export interface CurrencyTotal {
  currencyId: string;
  points: number;
  dollarValue: number;
}

export interface RoutingResult {
  rows: RoutingRow[];
  /** Points and dollar value grouped by currency */
  currencyTotals: CurrencyTotal[];
  totalDollarValue: number;
}
