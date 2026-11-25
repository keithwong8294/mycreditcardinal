export interface Currency {
  id: string;
  name: string;
  /** Floor value in cents (e.g. 100 = 1.00¢) */
  floor: number;
  /** MCC value in cents: the median of `sources` when it has any */
  composite: number;
  /** Published valuations behind `composite`, in cents (see VALUATION_SOURCES) */
  sources?: Partial<Record<"tpg" | "nerdwallet" | "upgradedpoints" | "omaat", number>>;
  /** Ceiling value in cents */
  ceiling: number;
}

export type ValuationTier = "floor" | "composite" | "ceiling";
