import type { Currency } from "@/types";

/** All values in cents (100 = 1.00¢, 200 = 2.00¢) */
export const CURRENCIES: Currency[] = [
  {
    id: "chase_ur",
    name: "Chase Ultimate Rewards",
    floor: 100,
    composite: 200,
    ceiling: 400,
  },
  {
    id: "amex_mr",
    name: "Amex Membership Rewards",
    floor: 100,
    composite: 195,
    ceiling: 400,
  },
  {
    id: "cap1",
    name: "Capital One Miles",
    floor: 100,
    composite: 170,
    ceiling: 300,
  },
  {
    id: "citi_typ",
    name: "Citi ThankYou Points",
    floor: 100,
    composite: 175,
    ceiling: 350,
  },
  {
    id: "bilt",
    name: "Bilt Rewards",
    floor: 100,
    composite: 210,
    ceiling: 350,
  },
  {
    id: "wf",
    name: "Wells Fargo Rewards",
    floor: 100,
    composite: 155,
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
];

export const CURRENCY_MAP = Object.fromEntries(
  CURRENCIES.map((c) => [c.id, c])
) as Record<string, Currency>;
