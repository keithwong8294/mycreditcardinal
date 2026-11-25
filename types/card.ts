/** How often a bonus cap resets. */
export type CapPeriod = "month" | "quarter" | "year";

export interface Card {
  id: string;
  name: string;
  issuer: string;
  network: string;
  currency: string;
  /**
   * Currency this card's rewards can be moved into when the wallet also has a
   * card earning it (Savor cash back → Venture miles). Valued as that currency then.
   */
  pools_into?: string;
  /**
   * Points are only worth cash back unless the wallet also has a card that
   * earns this currency without the flag (Freedom Unlimited → needs a Sapphire).
   */
  cash_alone?: boolean;
  fee: number;

  /** Per-category earn rates. Key = category ID, value = multiplier (e.g. 3 = 3x) */
  earn_json: Record<string, number>;

  /**
   * Bonus spend caps in dollars per `cap_period`. Key = category ID, or
   * "custom" for a combined cap on the user's chosen categories.
   */
  caps_json: Record<string, number>;

  /** Period the caps_json caps reset on (issuer terms). Default "month". */
  cap_period?: CapPeriod;

  /** All of caps_json is one combined cap (e.g. $6,000/yr across three categories). */
  cap_shared?: boolean;

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

  /**
   * Announced quarterly category schedule per year.
   * Keys are year strings ("2026"); values are quarter maps ("Q1"-"Q4") with
   * arrays of category IDs that earn the bonus that quarter.
   * When a card is added to a wallet, rotQ is auto-populated from the current year.
   * @example { "2026": { "Q1": ["groceries"], "Q2": ["dining", "streaming"], ... } }
   */
  rotation_schedule?: Record<string, Record<string, string[]>>;

  /** True if this card lets users pick bonus categories */
  custom_select: boolean;

  /** Max number of custom categories the user can select */
  custom_max: number | null;

  /** Earn rate for custom-selected categories */
  custom_rate: number | null;

  /** Available options for custom category selection */
  custom_opts: string[] | null;

  /**
   * True for small-business cards (Chase Ink, Amex Blue Business, etc.).
   * These need a business or side income to apply, so the optimizer hides
   * them unless the user says they're open to one.
   */
  business?: boolean;

  /** Foreign transaction fee in percent (0 = none). */
  ftf?: number;

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
