export interface SpendProfile {
  id: string;
  name: string;
  /** Key = category ID, value = monthly spend in dollars */
  spend: Record<string, number>;
  isDefault: boolean;
}
