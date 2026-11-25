import type { Currency } from "@/types";

/**
 * All values in cents (100 = 1.00¢, 200 = 2.00¢).
 *
 * composite (the "MCC value") is the median of the published valuations in
 * `sources`, checked November 2026 (VALUATIONS_CHECKED). Bank points use each
 * source's best-card figure (e.g. NerdWallet's Sapphire Reserve / Strata value).
 */
export const VALUATIONS_CHECKED = "November 2026";

export const VALUATION_SOURCES = [
  { id: "tpg", name: "The Points Guy", url: "https://thepointsguy.com/loyalty-programs/monthly-valuations/" },
  { id: "nerdwallet", name: "NerdWallet", url: "https://www.nerdwallet.com/travel/learn/airline-miles-and-hotel-points-valuations" },
  { id: "upgradedpoints", name: "Upgraded Points", url: "https://upgradedpoints.com/travel/points-and-miles-valuations/" },
  { id: "omaat", name: "One Mile at a Time", url: "https://onemileatatime.com/guides/value-miles-points/" },
] as const;

export const CURRENCIES: Currency[] = [
  {
    id: "chase_ur",
    name: "Chase Ultimate Rewards",
    floor: 100,
    composite: 170,
    sources: { nerdwallet: 160, upgradedpoints: 200, omaat: 170 },
    ceiling: 400,
  },
  {
    id: "amex_mr",
    name: "Amex Membership Rewards",
    floor: 100,
    composite: 170,
    sources: { nerdwallet: 130, upgradedpoints: 220, omaat: 170 },
    ceiling: 400,
  },
  {
    id: "cap1",
    name: "Capital One Miles",
    floor: 100,
    composite: 170,
    sources: { nerdwallet: 130, upgradedpoints: 180, omaat: 170 },
    ceiling: 300,
  },
  {
    id: "citi_typ",
    name: "Citi ThankYou Points",
    floor: 100,
    composite: 170,
    sources: { nerdwallet: 190, upgradedpoints: 160, omaat: 170 },
    ceiling: 350,
  },
  {
    id: "bilt",
    name: "Bilt Rewards",
    floor: 100,
    composite: 190,
    sources: { tpg: 220, nerdwallet: 180, upgradedpoints: 200, omaat: 170 },
    ceiling: 350,
  },
  {
    id: "wf",
    name: "Wells Fargo Rewards",
    floor: 100,
    composite: 145,
    sources: { nerdwallet: 140, upgradedpoints: 150 },
    ceiling: 250,
  },
  {
    id: "cash",
    name: "Cash Back",
    floor: 100,
    composite: 100,
    ceiling: 100,
  },
  {
    id: "discover",
    name: "Discover Cashback",
    floor: 100,
    composite: 100,
    ceiling: 100,
  },
  {
    id: "hyatt",
    name: "World of Hyatt Points",
    floor: 130,
    composite: 157.5,
    sources: { tpg: 165, nerdwallet: 160, upgradedpoints: 155, omaat: 140 },
    ceiling: 250,
  },
  {
    id: "united",
    name: "United MileagePlus Miles",
    floor: 100,
    composite: 120,
    sources: { tpg: 120, nerdwallet: 120, omaat: 130 },
    ceiling: 200,
  },
  {
    id: "delta",
    name: "Delta SkyMiles",
    floor: 100,
    composite: 110,
    sources: { tpg: 120, nerdwallet: 100, omaat: 110 },
    ceiling: 150,
  },
  {
    id: "marriott",
    name: "Marriott Bonvoy Points",
    floor: 60,
    composite: 71.5,
    sources: { tpg: 75, nerdwallet: 70, upgradedpoints: 73, omaat: 70 },
    ceiling: 100,
  },
  {
    id: "hilton",
    name: "Hilton Honors Points",
    floor: 40,
    composite: 40.5,
    sources: { tpg: 40, nerdwallet: 40, upgradedpoints: 41, omaat: 50 },
    ceiling: 70,
  },
];

export const CURRENCY_MAP = Object.fromEntries(
  CURRENCIES.map((c) => [c.id, c])
) as Record<string, Currency>;
