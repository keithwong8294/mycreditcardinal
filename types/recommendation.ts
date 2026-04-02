import type { Card } from "./card";

export interface CategoryImprovement {
  categoryId: string;
  currentRate: number;
  candidateRate: number;
  annualGain: number;
}

export interface Recommendation {
  card: Card;
  /** Annual dollar value gained from improved earn rates */
  earnGain: number;
  /** Dollar value of the sign-up bonus at current valuation */
  subValue: number;
  /** Per-category improvements this card provides */
  improvements: CategoryImprovement[];
  /** earnGain + subValue - annualFee */
  netValue: number;
}
