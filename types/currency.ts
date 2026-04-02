export interface Currency {
  id: string;
  name: string;
  /** Floor value in cents (e.g. 100 = 1.00¢) */
  floor: number;
  /** MCC Composite value in cents */
  composite: number;
  /** Ceiling value in cents */
  ceiling: number;
}

export type ValuationTier = "floor" | "composite" | "ceiling";
