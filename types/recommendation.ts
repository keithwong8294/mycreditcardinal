import type { Card } from "./card";

export interface CategoryImprovement {
  categoryId: string;
  currentRate: number;
  candidateRate: number;
  annualGain: number;
}

export interface Recommendation {
  card: Card;
  /** Annual dollar value gained from improved earn rates (caps respected) */
  earnGain: number;
  /** Statement credits counted at the user's expected usage */
  creditValue: number;
  /** Dollar value of the sign-up bonus (0 when the user's spend can't reach it) */
  subValue: number;
  /** Whether the user's monthly spend reaches the bonus minimum in time */
  subReachable: boolean;
  /** Every-year value: earnGain + creditValue − annual fee */
  ongoingValue: number;
  /** ongoingValue + full sign-up bonus */
  firstYearValue: number;
  /** Per-category improvements this card provides, largest first */
  improvements: CategoryImprovement[];
  /** Ranking score: ongoingValue + sign-up bonus × the user's bonus weight */
  netValue: number;
}
