/**
 * Average US household spending, mapped onto the simulator's categories.
 *
 * Source: BLS Consumer Expenditure Survey 2025 (released Oct 29, 2026,
 * USDL-26-1619, Table 1, all consumer units). The Census Bureau collects the
 * survey for BLS. Average consumer unit is about 2.5 people.
 *
 * Household sizes: BLS publishes spending by consumer-unit size only in its
 * detailed tables. Each category's 1/2/3/4-person amount is the 2025 average
 * scaled by that size's ratio to "all consumer units" in the latest BLS
 * size-of-consumer-unit table (Table 1400).
 *
 * Splits where the survey has no matching line (marked "est."):
 *  - travel vs transit: "public and other transportation" (airfare, ships,
 *    intercity trips vs local transit, taxis, rideshare) split 75 / 25.
 *  - streaming: audio/visual equipment and services, 38% of entertainment.
 *  - rent / mortgage: rented dwellings plus mortgage interest (about half of
 *    owned-dwelling costs), averaged over renters and owners.
 *  - online shopping: apparel and services (goods people commonly buy online).
 */

export const BENCHMARK_SOURCE = {
  name: "BLS Consumer Expenditure Survey",
  year: 2025,
  url: "https://www.bls.gov/news.release/cesan.nr0.htm",
};

export type HouseholdSize = "avg" | 1 | 2 | 3 | 4;

export const HOUSEHOLD_SIZES: { value: HouseholdSize; label: string }[] = [
  { value: "avg", label: "US average (2.5)" },
  { value: 1, label: "1 person" },
  { value: 2, label: "2 people" },
  { value: 3, label: "3 people" },
  { value: 4, label: "4 people" },
];

// 2025 annual dollars, all consumer units (BLS Table 1, with splits above).
const ANNUAL_2025: Record<string, number> = {
  groceries: 6491, // food at home
  dining: 4142, // food away from home
  gas: 2503, // gasoline and other fuels
  travel: 1199 * 0.75, // est.: public and other transportation, long-distance share
  transit: 1199 * 0.25, // est.: public and other transportation, local share
  hotels: 1366, // other lodging
  streaming: 4084 * 0.38, // est.: entertainment, audio/visual share
  entertainment: 4084 * 0.62, // entertainment minus audio/visual
  online: 2010, // est.: apparel and services
  rent: 6272 + 9988 * 0.51, // est.: rented dwellings + mortgage interest
  drugstore: 672 + 986, // drugs + personal care products and services
  // Utilities, household operations, housekeeping, furnishings, other vehicle
  // expenses, medical services and supplies, alcohol, reading, miscellaneous.
  other: 4931 + 2034 + 844 + 2355 + 4765 + 1260 + 228 + 630 + 114 + 1335,
};

// Ratio of each household size to all consumer units, BLS Table 1400
// (size of consumer unit): [1 person, 2, 3, 4].
const SIZE_RATIO: Record<string, [number, number, number, number]> = {
  groceries: [0.526, 0.985, 1.157, 1.408],
  dining: [0.585, 1.064, 1.16, 1.354],
  gas: [0.526, 1.014, 1.227, 1.393],
  travel: [0.605, 1.182, 1.058, 1.41],
  transit: [0.605, 1.182, 1.058, 1.41],
  hotels: [0.483, 1.453, 1.176, 1.026],
  streaming: [0.673, 1.074, 1.123, 1.301],
  entertainment: [0.501, 1.138, 1.05, 1.459],
  online: [0.579, 0.947, 1.204, 1.43],
  rent: [0.841, 0.853, 1.189, 1.267],
  drugstore: [0.639, 1.202, 1.048, 1.171],
  other: [0.607, 1.06, 1.168, 1.337],
};

/** Monthly household spend per category for a household size, rounded to $5. */
export function averageMonthlySpend(size: HouseholdSize): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, annual] of Object.entries(ANNUAL_2025)) {
    const ratio = size === "avg" ? 1 : SIZE_RATIO[id][size - 1];
    out[id] = Math.round((annual * ratio) / 12 / 5) * 5;
  }
  return out;
}
