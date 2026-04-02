import type { Card } from "./card";

export interface CardConfig {
  /** Rotating category selections per quarter: [Q1, Q2, Q3, Q4]. null = unset */
  rotQ: [string | null, string | null, string | null, string | null];
  /** User-selected custom bonus categories */
  custom: string[];
}

export interface WalletCard {
  /** DB record ID (uuid) */
  id: string;
  /** Reference to the card definition */
  card: Card;
  /** User configuration for rotating/custom-select cards */
  config: CardConfig;
}
