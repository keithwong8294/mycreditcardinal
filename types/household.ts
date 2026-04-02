import type { WalletCard } from "./walletCard";

export interface HouseholdMember {
  id: string;
  name: string;
  sortOrder: number;
  cards: WalletCard[];
}

export interface Household {
  id: string;
  name: string;
  members: HouseholdMember[];
}
