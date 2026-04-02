export interface SpendCategory {
  id: string;
  label: string;
  /** Default monthly spend in dollars */
  defaultAmount: number;
  /** Slider maximum in dollars */
  sliderMax: number;
}
