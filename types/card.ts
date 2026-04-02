export interface Card {
  id: string;
  name: string;
  issuer: string;
  network: string;
  currency: string;
  fee: number;

  /** Per-category earn rates. Key = category ID, value = multiplier (e.g. 3 = 3x) */
  earn_json: Record<string, number>;

  /** Per-category spend caps in dollars. Key = category ID, value = cap amount */
  caps_json: Record<string, number>;

  /** Current sign-up bonus */
  sub_json: SubBonus | null;

  /** Highest-ever sign-up bonus */
  sub_hi_json: SubBonus | null;

  /** Overall card score (internal ranking) */
  score: number;

  perks_json: Perk[];

  /** CSS gradient stops for card face display */
  color_json: string[];

  /** True if this card has rotating quarterly categories */
  rotating: boolean;

  /** Quarterly rotating bonus cap in dollars (applies to bonus portion only) */
  rot_cap: number | null;

  /** Available options for the rotating category slot */
  rot_opts: string[] | null;

  /** True if this card lets users pick bonus categories */
  custom_select: boolean;

  /** Max number of custom categories the user can select */
  custom_max: number | null;

  /** Earn rate for custom-selected categories */
  custom_rate: number | null;

  /** Available options for custom category selection */
  custom_opts: string[] | null;

  /** Required FICO score range */
  fico_min: number | null;

  status: "active" | "discontinued";
}

export interface SubBonus {
  points: number;
  spend_requirement: number;
  timeframe_months: number;
  year?: number;
}

export interface Perk {
  label: string;
  value: string;
  annual_credit?: number;
}
