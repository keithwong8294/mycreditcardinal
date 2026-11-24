import type { Card, Perk, SubBonus } from "@/types/card";

/**
 * MyCreditCardinal card database.
 *
 * Data reviewed November 2026. Rates reflect what a cardholder earns on a
 * normal purchase in each category; portal-only multipliers (Chase Travel,
 * Capital One Travel, Amex Travel, Citi Travel) are listed as perks rather
 * than counted in `travel` / `hotels`, so routing isn't overstated.
 * Co-branded hotel/airline cards apply their brand multiplier to the matching
 * category on the assumption that you book with that brand.
 *
 * earn_json:  multiplier per category (1 = 1x / 1%). Every category is filled
 *             in via `earn()`; unspecified categories use the base rate.
 * caps_json:  issuer bonus caps in dollars per capPeriod (month / quarter /
 *             year), as the issuer states them. "custom" = combined cap for
 *             custom-select categories; capShared = one cap across all keys.
 * rot_cap:    QUARTERLY dollar cap on the rotating bonus portion.
 * sub_json:   points/miles (cash-back cards: cents, so 20000 = $200).
 * color_json: card-face gradient stops.
 */

type Rates = Partial<Record<CategoryId, number>>;
type CategoryId =
  | "dining" | "groceries" | "gas" | "travel" | "hotels" | "streaming"
  | "online" | "entertainment" | "transit" | "rent" | "drugstore" | "other";

const ALL_CATEGORIES: CategoryId[] = [
  "dining", "groceries", "gas", "travel", "hotels", "streaming",
  "online", "entertainment", "transit", "rent", "drugstore", "other",
];

/** Fill all 12 categories with `base`, then apply overrides. */
function earn(base: number, overrides: Rates = {}): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of ALL_CATEGORIES) out[id] = overrides[id] ?? base;
  return out;
}

function sub(points: number, spend: number, months: number, year?: number): SubBonus {
  return year
    ? { points, spend_requirement: spend, timeframe_months: months, year }
    : { points, spend_requirement: spend, timeframe_months: months };
}

interface CardInput {
  id: string;
  name: string;
  issuer: string;
  network: string;
  currency: string;
  fee: number;
  earn_json: Record<string, number>;
  /** Issuer caps in dollars per `capPeriod` (default "month"). */
  caps_json?: Record<string, number>;
  capPeriod?: Card["cap_period"];
  /** caps_json is one combined cap across its categories. */
  capShared?: boolean;
  sub_json: SubBonus | null;
  sub_hi_json?: SubBonus | null;
  score: number;
  perks_json: Perk[];
  color_json: string[];
  fico_min: number | null;
  rotating?: { cap: number; opts: string[]; schedule?: Card["rotation_schedule"] };
  custom?: { max: number; rate: number; opts: string[] };
  business?: boolean;
  /** Foreign transaction fee, percent. */
  ftf: number;
  status?: Card["status"];
}

function card(c: CardInput): Card {
  return {
    id: c.id,
    name: c.name,
    issuer: c.issuer,
    network: c.network,
    currency: c.currency,
    fee: c.fee,
    earn_json: c.earn_json,
    caps_json: c.caps_json ?? {},
    ...(c.caps_json ? { cap_period: c.capPeriod ?? "month" } : {}),
    ...(c.capShared ? { cap_shared: true } : {}),
    sub_json: c.sub_json,
    sub_hi_json: c.sub_hi_json ?? c.sub_json,
    score: c.score,
    perks_json: c.perks_json,
    color_json: c.color_json,
    rotating: Boolean(c.rotating),
    rot_cap: c.rotating?.cap ?? null,
    rot_opts: c.rotating?.opts ?? null,
    ...(c.rotating?.schedule ? { rotation_schedule: c.rotating.schedule } : {}),
    custom_select: Boolean(c.custom),
    custom_max: c.custom?.max ?? null,
    custom_rate: c.custom?.rate ?? null,
    custom_opts: c.custom?.opts ?? null,
    ...(c.business ? { business: true } : {}),
    ftf: c.ftf,
    fico_min: c.fico_min,
    status: c.status ?? "active",
  };
}

const ROTATING_OPTS = [
  "dining", "groceries", "gas", "online", "entertainment",
  "transit", "drugstore", "streaming", "hotels", "travel",
];

export const CARDS: Card[] = [
  // ─── CHASE ────────────────────────────────────────────────────────────────

  card({
    id: "csr",
    name: "Sapphire Reserve",
    issuer: "Chase",
    network: "Visa",
    currency: "chase_ur",
    fee: 795,
    earn_json: earn(1, { dining: 3, travel: 4, hotels: 4 }),
    sub_json: sub(100000, 6000, 3),
    sub_hi_json: sub(150000, 6000, 3, 2026),
    score: 92,
    perks_json: [
      { label: "8x on Chase Travel", value: "4x flights & hotels booked direct" },
      { label: "Annual Travel Credit", value: "$300/yr", annual_credit: 300 },
      { label: "The Edit Hotel Credit", value: "$500/yr ($250 semiannual)", annual_credit: 500 },
      { label: "Sapphire Exclusive Tables Dining", value: "$300/yr ($150 semiannual)", annual_credit: 300 },
      { label: "StubHub / viagogo Credit", value: "$300/yr ($150 semiannual)", annual_credit: 300 },
      { label: "Apple TV+ & Apple Music", value: "$250/yr value", annual_credit: 250 },
      { label: "Priority Pass + Sapphire Lounges", value: "Unlimited" },
      { label: "Global Entry / TSA PreCheck", value: "$120 credit every 4 yrs" },
    ],
    color_json: ["#1a2744", "#2d4a8a"],
    ftf: 0,
    fico_min: 740,
  }),

  card({
    id: "csp",
    name: "Sapphire Preferred",
    issuer: "Chase",
    network: "Visa",
    currency: "chase_ur",
    fee: 95,
    earn_json: earn(1, { dining: 3, streaming: 3, gas: 3, travel: 2, hotels: 2 }),
    sub_json: sub(75000, 5000, 3),
    sub_hi_json: sub(100000, 5000, 3, 2026),
    score: 86,
    perks_json: [
      { label: "5x on Chase Travel", value: "3x online groceries & EV charging" },
      { label: "3x Vacation Rentals", value: "Airbnb, Vrbo & more booked direct" },
      { label: "Chase Travel Hotel Credit", value: "$100/yr", annual_credit: 100 },
      { label: "Global Entry / TSA PreCheck", value: "$120 credit every 4 yrs" },
      { label: "5x on Lyft", value: "Through Sept 2027" },
      { label: "DashPass", value: "Complimentary + $10/mo DoorDash promo" },
      { label: "Trip Cancellation Insurance", value: "Up to $10k" },
    ],
    color_json: ["#1c3a6e", "#4a7fd4"],
    ftf: 0,
    fico_min: 700,
  }),

  card({
    id: "cff",
    name: "Freedom Flex",
    issuer: "Chase",
    network: "Mastercard",
    currency: "chase_ur",
    fee: 0,
    earn_json: earn(1, { dining: 3, drugstore: 3 }),
    sub_json: sub(20000, 500, 3),
    sub_hi_json: sub(25000, 500, 3, 2026),
    score: 80,
    perks_json: [
      { label: "5x Rotating Quarterly Categories", value: "Up to $1,500/quarter (activate)" },
      { label: "5x on Chase Travel", value: "Points Boost on select hotels" },
      { label: "No Foreign Transaction Fee", value: "Since Sept 2026" },
    ],
    color_json: ["#0a2459", "#1a4fa8"],
    rotating: {
      cap: 1500,
      opts: ROTATING_OPTS,
      schedule: {
        "2026": {
          Q1: ["dining"],
          Q2: ["online", "travel"],
          Q3: ["gas", "transit", "entertainment"],
          Q4: ["groceries", "dining"],
        },
        "2027": {
          Q1: ["streaming", "groceries"],
        },
      },
    },
    ftf: 0,
    fico_min: 670,
  }),

  card({
    id: "cfu",
    name: "Freedom Unlimited",
    issuer: "Chase",
    network: "Visa",
    currency: "chase_ur",
    fee: 0,
    earn_json: earn(1.5, { dining: 3, drugstore: 3 }),
    sub_json: sub(20000, 500, 3),
    sub_hi_json: sub(30000, 500, 3, 2025),
    score: 78,
    perks_json: [
      { label: "1.5x on Everything", value: "No category restrictions" },
      { label: "5x on Chase Travel", value: "Pairs with Sapphire for transfers" },
      { label: "Purchase Protection", value: "Up to $500/claim" },
    ],
    color_json: ["#2c2c2c", "#5a5a5a"],
    ftf: 3,
    fico_min: 670,
  }),

  card({
    id: "amazon_prime",
    name: "Amazon Prime Visa",
    issuer: "Chase",
    network: "Visa",
    currency: "cash",
    fee: 0,
    earn_json: earn(1, { online: 5, dining: 2, gas: 2, transit: 2 }),
    sub_json: sub(15000, 0, 0),
    sub_hi_json: sub(25000, 0, 0, 2024),
    score: 72,
    perks_json: [
      { label: "5% Amazon & Whole Foods", value: "Requires Prime membership" },
      { label: "5% on Chase Travel", value: "2% restaurants, gas, local transit" },
      { label: "Instant Gift Card on Approval", value: "No spend requirement" },
      { label: "No Foreign Transaction Fee", value: "Visa Signature" },
    ],
    color_json: ["#1a1a1a", "#f90"],
    ftf: 0,
    fico_min: 670,
  }),

  card({
    id: "chase_ink_unlimited",
    name: "Ink Business Unlimited",
    issuer: "Chase",
    network: "Visa",
    currency: "chase_ur",
    fee: 0,
    earn_json: earn(1.5),
    sub_json: sub(75000, 6000, 3),
    sub_hi_json: sub(100000, 8000, 4, 2026),
    score: 76,
    perks_json: [
      { label: "1.5x on Everything", value: "Business card" },
      { label: "Huge Cash SUB", value: "$750 after $6k / 3 mo" },
      { label: "Employee Cards", value: "No extra cost" },
    ],
    color_json: ["#14213d", "#2b4c7e"],
    ftf: 3,
    fico_min: 690,
    business: true,
  }),

  card({
    id: "chase_ink_cash",
    name: "Ink Business Cash",
    issuer: "Chase",
    network: "Visa",
    currency: "chase_ur",
    fee: 0,
    earn_json: earn(1, { streaming: 5, dining: 2, gas: 2 }),
    // $25k/yr at 5% (internet, cable, phone); $25k/yr at 2% (dining, gas)
    caps_json: { streaming: 25000, dining: 25000, gas: 25000 },
    capPeriod: "year",
    sub_json: sub(75000, 6000, 3),
    sub_hi_json: sub(100000, 8000, 4, 2026),
    score: 75,
    perks_json: [
      { label: "5x Office Supply, Internet, Cable & Phone", value: "First $25k/yr combined" },
      { label: "2x Gas & Dining", value: "First $25k/yr combined" },
      { label: "Business card", value: "Pairs with Sapphire for transfers" },
    ],
    color_json: ["#0b3d2e", "#1f7a5c"],
    ftf: 3,
    fico_min: 690,
    business: true,
  }),

  card({
    id: "chase_ink_preferred",
    name: "Ink Business Preferred",
    issuer: "Chase",
    network: "Visa",
    currency: "chase_ur",
    fee: 95,
    earn_json: earn(1, { travel: 3, hotels: 3 }),
    sub_json: sub(100000, 8000, 3),
    sub_hi_json: sub(120000, 8000, 3, 2024),
    score: 80,
    perks_json: [
      { label: "3x Travel, Shipping, Internet/Phone, Social Ads", value: "First $150k/yr combined" },
      { label: "Cell Phone Protection", value: "Up to $1,000/claim" },
      { label: "Transfer Partners", value: "Chase Ultimate Rewards 1:1" },
    ],
    color_json: ["#111827", "#374151"],
    ftf: 0,
    fico_min: 700,
    business: true,
  }),

  card({
    id: "chase_hyatt",
    name: "World of Hyatt",
    issuer: "Chase",
    network: "Visa",
    currency: "hyatt",
    fee: 95,
    earn_json: earn(1, { hotels: 4, dining: 2, travel: 2, transit: 2 }),
    // Current offer is 4 free nights (Cat 1–4), counted as ~60k points.
    sub_json: sub(60000, 5000, 3),
    sub_hi_json: sub(65000, 3000, 6, 2025),
    score: 74,
    perks_json: [
      { label: "Welcome Offer", value: "4 free nights (Cat 1–4) after $5k / 3 mo" },
      { label: "4x at Hyatt", value: "Plus up to 5x as a member" },
      { label: "Free Night (Cat 1–4)", value: "Every anniversary, 2nd after $15k spend" },
      { label: "Discoverist Status", value: "+5 elite nights/yr" },
    ],
    color_json: ["#2b1d0e", "#7a5c2e"],
    ftf: 0,
    fico_min: 700,
  }),

  card({
    id: "chase_united_explorer",
    name: "United Explorer",
    issuer: "Chase",
    network: "Visa",
    currency: "united",
    fee: 150,
    earn_json: earn(1, { travel: 3, hotels: 2, dining: 2 }),
    sub_json: sub(70000, 3000, 3),
    sub_hi_json: sub(80000, 3000, 3, 2026),
    score: 68,
    perks_json: [
      { label: "3x United, 5x United Hotels", value: "2x dining & hotels booked direct" },
      { label: "Free First Checked Bag", value: "You + 1 companion" },
      { label: "United Hotels Credit", value: "$100/yr ($50 x2 stays)", annual_credit: 100 },
      { label: "Rideshare Credit", value: "$60/yr ($5/mo)", annual_credit: 60 },
      { label: "JSX & Avis/Budget Credits", value: "$100 + $50/yr" },
      { label: "United Club Passes", value: "2 one-time passes/yr" },
      { label: "$0 Intro Annual Fee", value: "First year" },
    ],
    color_json: ["#002244", "#0b4a8b"],
    ftf: 0,
    fico_min: 690,
  }),

  card({
    id: "chase_marriott_boundless",
    name: "Marriott Bonvoy Boundless",
    issuer: "Chase",
    network: "Visa",
    currency: "marriott",
    fee: 95,
    earn_json: earn(2, { hotels: 6, groceries: 3, gas: 3, dining: 3 }),
    // 3x on the first $6,000 a year across groceries, gas and dining
    caps_json: { groceries: 6000, gas: 6000, dining: 6000 },
    capPeriod: "year",
    capShared: true,
    sub_json: sub(125000, 3000, 3),
    sub_hi_json: sub(200000, 3000, 3, 2026),
    score: 62,
    perks_json: [
      { label: "6x at Marriott", value: "3x grocery/gas/dining on first $6k/yr" },
      { label: "Free Night (up to 35k pts)", value: "Every anniversary" },
      { label: "Airline Credit", value: "$100/yr after $500 airline spend (thru Jun 2027)" },
      { label: "Silver Elite Status", value: "Complimentary" },
    ],
    color_json: ["#3b0d0c", "#8a2b26"],
    ftf: 0,
    fico_min: 690,
  }),

  // ─── AMEX ─────────────────────────────────────────────────────────────────

  card({
    id: "amex_plat",
    name: "Platinum Card",
    issuer: "Amex",
    network: "Amex",
    currency: "amex_mr",
    fee: 895,
    earn_json: earn(1, { travel: 5 }),
    sub_json: sub(175000, 12000, 6),
    sub_hi_json: sub(175000, 8000, 6, 2025),
    score: 88,
    perks_json: [
      { label: "5x Flights & Amex Travel Hotels", value: "Flights direct or via Amex Travel (first $500k/yr)" },
      { label: "Lodging Credit (FHR / THC / Airbnb Luxe)", value: "$600/yr ($300 semiannual)", annual_credit: 600 },
      { label: "Resy Dining Credit", value: "$400/yr ($100/qtr)", annual_credit: 400 },
      { label: "Digital Entertainment Credit", value: "$300/yr ($25/mo)", annual_credit: 300 },
      { label: "lululemon Credit", value: "$300/yr ($75/qtr)", annual_credit: 300 },
      { label: "Airline Fee Credit", value: "$200/yr", annual_credit: 200 },
      { label: "Oura Ring Credit", value: "$200/yr", annual_credit: 200 },
      { label: "Uber Cash + Uber One", value: "$200 + $120/yr", annual_credit: 320 },
      { label: "CLEAR+ Credit", value: "$219/yr", annual_credit: 219 },
      { label: "Walmart+ Credit", value: "$155/yr", annual_credit: 155 },
      { label: "Centurion + Priority Pass Lounges", value: "Unlimited" },
    ],
    color_json: ["#8a8a8a", "#c8c8c8", "#e8e8e8"],
    ftf: 0,
    fico_min: 720,
  }),

  card({
    id: "amex_gold",
    name: "Gold Card",
    issuer: "Amex",
    network: "Amex",
    currency: "amex_mr",
    fee: 325,
    earn_json: earn(1, { dining: 4, groceries: 4, travel: 3 }),
    caps_json: { dining: 50000, groceries: 25000 },
    capPeriod: "year",
    sub_json: sub(100000, 8000, 6),
    sub_hi_json: sub(100000, 6000, 6, 2025),
    score: 88,
    perks_json: [
      { label: "4x Restaurants & US Supermarkets", value: "$50k / $25k per year" },
      { label: "5x Prepaid Hotels via Amex Travel", value: "3x flights" },
      { label: "Dining Credit", value: "$120/yr (Grubhub, Five Guys, etc.)", annual_credit: 120 },
      { label: "Uber Cash", value: "$120/yr", annual_credit: 120 },
      { label: "Resy Credit", value: "$100/yr ($50 semiannual)", annual_credit: 100 },
      { label: "Dunkin' Credit", value: "$84/yr", annual_credit: 84 },
      { label: "Hotel Collection Credit", value: "$100 on 2+ night stays" },
    ],
    color_json: ["#c9940a", "#e8b82a", "#f5d060"],
    ftf: 0,
    fico_min: 700,
  }),

  card({
    id: "amex_green",
    name: "Green Card",
    issuer: "Amex",
    network: "Amex",
    currency: "amex_mr",
    fee: 150,
    earn_json: earn(1, { dining: 3, travel: 3, hotels: 3, transit: 3 }),
    sub_json: sub(40000, 3000, 6),
    sub_hi_json: sub(60000, 3000, 6, 2023),
    score: 70,
    perks_json: [
      { label: "3x Travel, Transit & Restaurants", value: "Broad travel definition" },
      { label: "CLEAR+ Credit", value: "$209/yr", annual_credit: 209 },
      { label: "No Foreign Transaction Fee", value: "Transfer to 20+ partners" },
    ],
    color_json: ["#1f4d3a", "#3f8a68"],
    ftf: 0,
    fico_min: 690,
  }),

  card({
    id: "amex_bcp",
    name: "Blue Cash Preferred",
    issuer: "Amex",
    network: "Amex",
    currency: "cash",
    fee: 95,
    earn_json: earn(1, { groceries: 6, streaming: 6, gas: 3, transit: 3 }),
    caps_json: { groceries: 6000 },
    capPeriod: "year",
    sub_json: sub(30000, 3000, 6),
    sub_hi_json: sub(30000, 3000, 6, 2026),
    score: 78,
    perks_json: [
      { label: "6% US Supermarkets", value: "First $6k/yr, then 1%" },
      { label: "6% Select US Streaming", value: "3% gas & transit" },
      { label: "Disney Bundle Credit", value: "$120/yr ($10/mo)", annual_credit: 120 },
      { label: "$0 Intro Annual Fee", value: "First year" },
    ],
    color_json: ["#003087", "#0057b8"],
    ftf: 2.7,
    fico_min: 670,
  }),

  card({
    id: "amex_bce",
    name: "Blue Cash Everyday",
    issuer: "Amex",
    network: "Amex",
    currency: "cash",
    fee: 0,
    earn_json: earn(1, { groceries: 3, gas: 3, online: 3 }),
    caps_json: { groceries: 6000, gas: 6000, online: 6000 },
    capPeriod: "year",
    sub_json: sub(25000, 2000, 6),
    sub_hi_json: sub(25000, 2000, 6, 2026),
    score: 64,
    perks_json: [
      { label: "3% Supermarkets, Gas & Online Retail", value: "$6k/yr each" },
      { label: "Disney Bundle Credit", value: "$84/yr ($7/mo)", annual_credit: 84 },
      { label: "Home Chef Credit", value: "$180/yr ($15/mo)", annual_credit: 180 },
    ],
    color_json: ["#003087", "#4a90d9"],
    ftf: 2.7,
    fico_min: 670,
  }),

  card({
    id: "amex_bbp",
    name: "Blue Business Plus",
    issuer: "Amex",
    network: "Amex",
    currency: "amex_mr",
    fee: 0,
    earn_json: earn(2),
    // 2x on the first $50k a year of all purchases combined
    caps_json: Object.fromEntries(ALL_CATEGORIES.map((c) => [c, 50000])),
    capPeriod: "year",
    capShared: true,
    sub_json: sub(50000, 5000, 3),
    sub_hi_json: sub(75000, 15000, 3, 2026),
    score: 74,
    perks_json: [
      { label: "2x on Everything", value: "First $50k/yr, then 1x" },
      { label: "Transferable Points", value: "No annual fee" },
      { label: "Business card", value: "Expanded buying power" },
    ],
    color_json: ["#0b2a5b", "#2563eb"],
    ftf: 2.7,
    fico_min: 680,
    business: true,
  }),

  card({
    id: "amex_hilton_surpass",
    name: "Hilton Honors Surpass",
    issuer: "Amex",
    network: "Amex",
    currency: "hilton",
    fee: 150,
    earn_json: earn(3, { hotels: 12, dining: 6, groceries: 6, gas: 6, online: 4 }),
    sub_json: sub(130000, 3000, 6),
    sub_hi_json: sub(180000, 10000, 6, 2024),
    score: 66,
    perks_json: [
      { label: "12x at Hilton", value: "6x dining, supermarkets, gas" },
      { label: "Welcome Free Night", value: "Plus 130k pts after $3k / 6 mo" },
      { label: "Hilton Credit", value: "$200/yr ($50/qtr)", annual_credit: 200 },
      { label: "Gold Status", value: "Diamond after $40k spend" },
      { label: "Free Night Reward", value: "After $15k spend/yr" },
    ],
    color_json: ["#0c2340", "#1d4e89"],
    ftf: 0,
    fico_min: 690,
  }),

  card({
    id: "amex_delta_gold",
    name: "Delta SkyMiles Gold",
    issuer: "Amex",
    network: "Amex",
    currency: "delta",
    fee: 150,
    earn_json: earn(1, { travel: 2, dining: 2, groceries: 2 }),
    sub_json: sub(80000, 2000, 6),
    sub_hi_json: sub(90000, 5000, 6, 2026),
    score: 60,
    perks_json: [
      { label: "Free First Checked Bag", value: "Up to 9 on your reservation" },
      { label: "Delta Stays Credit", value: "$100/yr", annual_credit: 100 },
      { label: "Delta Flight Credit", value: "$200 after $10k spend" },
      { label: "$0 Intro Annual Fee", value: "First year" },
    ],
    color_json: ["#7a5c00", "#c9a227"],
    ftf: 0,
    fico_min: 680,
  }),

  // ─── CAPITAL ONE ──────────────────────────────────────────────────────────

  card({
    id: "c1_venturex",
    name: "Venture X",
    issuer: "Capital One",
    network: "Visa",
    currency: "cap1",
    fee: 395,
    earn_json: earn(2),
    sub_json: sub(75000, 4000, 3),
    sub_hi_json: sub(100000, 10000, 6, 2025),
    score: 88,
    perks_json: [
      { label: "10x Hotels & Cars, 5x Flights", value: "Via Capital One Travel" },
      { label: "Annual Travel Credit", value: "$300/yr (C1 Travel)", annual_credit: 300 },
      { label: "10,000 Anniversary Miles", value: "≈$100+ per year", annual_credit: 100 },
      { label: "Capital One + Priority Pass Lounges", value: "Unlimited" },
      { label: "Global Entry / TSA PreCheck", value: "$120 credit" },
    ],
    color_json: ["#0a0a0a", "#1a1a2e", "#2d2d44"],
    ftf: 0,
    fico_min: 720,
  }),

  card({
    id: "c1_venture",
    name: "Venture",
    issuer: "Capital One",
    network: "Visa",
    currency: "cap1",
    fee: 95,
    earn_json: earn(2),
    sub_json: sub(75000, 4000, 3),
    sub_hi_json: sub(100000, 20000, 12, 2023),
    score: 74,
    perks_json: [
      { label: "2x on Everything", value: "5x hotels & cars via C1 Travel" },
      { label: "Global Entry / TSA PreCheck", value: "$120 credit" },
      { label: "Transfer Partners", value: "15+ airlines & hotels" },
      { label: "Welcome Travel Credit", value: "$300 Capital One Travel (first year)" },
    ],
    color_json: ["#1c1c2e", "#4a4a7a"],
    ftf: 0,
    fico_min: 700,
  }),

  card({
    id: "c1_ventureone",
    name: "VentureOne",
    issuer: "Capital One",
    network: "Visa",
    currency: "cap1",
    fee: 0,
    earn_json: earn(1.25),
    sub_json: sub(20000, 500, 3),
    score: 56,
    perks_json: [
      { label: "1.25x on Everything", value: "No annual fee" },
      { label: "Transfer Partners", value: "Capital One miles" },
    ],
    color_json: ["#232946", "#5a6496"],
    ftf: 0,
    sub_hi_json: sub(40000, 1000, 3, 2026),
    fico_min: 670,
  }),

  card({
    id: "c1_savorone",
    name: "Savor",
    issuer: "Capital One",
    network: "Mastercard",
    currency: "cash",
    fee: 0,
    earn_json: earn(1, { dining: 3, groceries: 3, entertainment: 3, streaming: 3 }),
    sub_json: sub(25000, 500, 3),
    sub_hi_json: sub(25000, 500, 3, 2026),
    score: 70,
    perks_json: [
      { label: "3% Dining, Groceries, Entertainment, Streaming", value: "No annual fee" },
      { label: "5% Hotels & Cars via C1 Travel", value: "Formerly SavorOne" },
    ],
    color_json: ["#0d0d0d", "#2a0a0a"],
    ftf: 0,
    fico_min: 670,
  }),

  card({
    id: "c1_quicksilver",
    name: "Quicksilver",
    issuer: "Capital One",
    network: "Mastercard",
    currency: "cash",
    fee: 0,
    earn_json: earn(1.5),
    sub_json: sub(20000, 500, 3),
    score: 56,
    perks_json: [
      { label: "1.5% on Everything", value: "No annual fee" },
      { label: "Welcome Travel Credit", value: "$100 Capital One Travel" },
    ],
    color_json: ["#3a3a3a", "#7a7a7a", "#b0b0b0"],
    ftf: 0,
    fico_min: 670,
  }),

  // ─── CITI ─────────────────────────────────────────────────────────────────

  card({
    id: "citi_strata_elite",
    name: "Strata Elite",
    issuer: "Citi",
    network: "Mastercard",
    currency: "citi_typ",
    fee: 595,
    earn_json: earn(1.5, { dining: 3 }),
    sub_json: sub(75000, 6000, 3),
    sub_hi_json: sub(100000, 4000, 3, 2025),
    score: 80,
    perks_json: [
      { label: "12x Hotels/Cars, 6x Flights", value: "Via Citi Travel" },
      { label: "6x Dining Fri & Sat 6pm–6am", value: "3x other times" },
      { label: "Hotel Credit", value: "$300/yr (2+ nights, Citi Travel)", annual_credit: 300 },
      { label: "Splurge Credit", value: "$200/yr (select brands)", annual_credit: 200 },
      { label: "Blacklane Credit", value: "$200/yr", annual_credit: 200 },
      { label: "Priority Pass + Admirals Club Passes", value: "4 AA lounge passes/yr" },
    ],
    color_json: ["#0a0a14", "#1a1a2e", "#2a2a4a"],
    ftf: 0,
    fico_min: 720,
  }),

  card({
    id: "citi_strata_premier",
    name: "Strata Premier",
    issuer: "Citi",
    network: "Mastercard",
    currency: "citi_typ",
    fee: 95,
    earn_json: earn(1, { dining: 3, groceries: 3, gas: 3, travel: 3, hotels: 3 }),
    sub_json: sub(60000, 4000, 3),
    sub_hi_json: sub(75000, 4000, 3, 2025),
    score: 82,
    perks_json: [
      { label: "3x Dining, Supermarkets, Gas/EV, Air & Hotels", value: "10x via Citi Travel" },
      { label: "Annual Hotel Credit", value: "$100 off a $500+ stay", annual_credit: 100 },
      { label: "Transfer Partners", value: "Incl. American AAdvantage" },
    ],
    color_json: ["#0a1628", "#1a3a6e"],
    ftf: 0,
    fico_min: 700,
  }),

  card({
    id: "citi_strata",
    name: "Strata",
    issuer: "Citi",
    network: "Mastercard",
    currency: "citi_typ",
    fee: 0,
    earn_json: earn(1, { groceries: 3, gas: 3, dining: 2 }),
    sub_json: sub(20000, 1000, 3),
    score: 66,
    perks_json: [
      { label: "3x Supermarkets & Gas/EV", value: "Plus one self-select 3x category" },
      { label: "2x Restaurants", value: "No annual fee" },
    ],
    color_json: ["#16324f", "#2f6690"],
    custom: { max: 1, rate: 3, opts: ["streaming", "entertainment", "transit"] },
    ftf: 3,
    sub_hi_json: sub(30000, 1000, 3, 2025),
    fico_min: 670,
  }),

  card({
    id: "citi_custom_cash",
    name: "Custom Cash",
    issuer: "Citi",
    network: "Mastercard",
    currency: "citi_typ",
    fee: 0,
    earn_json: earn(1),
    caps_json: { custom: 500 }, // per billing cycle
    sub_json: sub(20000, 1500, 6),
    score: 70,
    perks_json: [
      { label: "5% Top Eligible Category", value: "First $500/billing cycle" },
      { label: "Auto-Selected Each Month", value: "No activation needed" },
    ],
    color_json: ["#f5f5f5", "#e0e0e0"],
    custom: {
      max: 1,
      rate: 5,
      opts: ["dining", "groceries", "gas", "travel", "transit", "streaming", "drugstore", "entertainment"],
    },
    ftf: 3,
    fico_min: 670,
  }),

  card({
    id: "citi_double_cash",
    name: "Double Cash",
    issuer: "Citi",
    network: "Mastercard",
    currency: "citi_typ",
    fee: 0,
    earn_json: earn(2),
    sub_json: sub(20000, 1500, 6),
    score: 64,
    perks_json: [
      { label: "2% on Everything", value: "1% buy + 1% pay" },
      { label: "Convertible to ThankYou Points", value: "Pairs with Strata Premier" },
    ],
    color_json: ["#1a3a6e", "#2d5aaa"],
    ftf: 3,
    fico_min: 670,
  }),

  // ─── DISCOVER ─────────────────────────────────────────────────────────────

  card({
    id: "discover_it",
    name: "Discover it Cash Back",
    issuer: "Discover",
    network: "Discover",
    currency: "discover",
    fee: 0,
    earn_json: earn(1),
    sub_json: sub(20000, 500, 3),
    score: 60,
    perks_json: [
      { label: "5% Rotating Quarterly Categories", value: "Up to $1,500/quarter (activate)" },
      { label: "Cashback Match", value: "All first-year rewards doubled" },
      { label: "Now Issued by Capital One", value: "No annual or foreign transaction fee" },
    ],
    color_json: ["#e8e8e8", "#f5a623", "#e8e8e8"],
    rotating: {
      cap: 1500,
      opts: ROTATING_OPTS,
      schedule: {
        "2026": {
          Q1: ["groceries", "streaming"],
          Q2: ["dining"],
          Q3: ["gas", "transit", "travel", "drugstore"],
          Q4: ["entertainment", "dining"],
        },
      },
    },
    ftf: 0,
    fico_min: 650,
  }),

  // ─── US BANK ──────────────────────────────────────────────────────────────

  card({
    id: "usb_cash_plus",
    name: "Cash+",
    issuer: "US Bank",
    network: "Visa",
    currency: "cash",
    fee: 0,
    earn_json: earn(1),
    caps_json: { custom: 2000 },
    capPeriod: "quarter",
    sub_json: sub(20000, 1000, 4),
    score: 66,
    perks_json: [
      { label: "5% on 2 Chosen Categories", value: "First $2,000/qtr combined" },
      { label: "2% on 1 Everyday Category", value: "Gas/EV, groceries, or restaurants" },
      { label: "5% Prepaid Travel", value: "Via US Bank travel center" },
    ],
    color_json: ["#8b0000", "#cc0000"],
    custom: { max: 2, rate: 5, opts: ["streaming", "entertainment", "transit", "dining"] },
    ftf: 3,
    fico_min: 670,
  }),

  card({
    id: "usb_altitude_go",
    name: "Altitude Go",
    issuer: "US Bank",
    network: "Visa",
    currency: "cash",
    fee: 0,
    earn_json: earn(1, { dining: 4, groceries: 2, gas: 2, streaming: 2 }),
    sub_json: sub(20000, 1000, 3),
    score: 65,
    perks_json: [
      { label: "4x Dining", value: "Incl. takeout & delivery (first $2k/qtr)" },
      { label: "Streaming Credit", value: "$15/yr", annual_credit: 15 },
    ],
    color_json: ["#1b1b3a", "#4b3f72"],
    ftf: 0,
    caps_json: { dining: 2000 },
    capPeriod: "quarter",
    fico_min: 670,
  }),

  // ─── WELLS FARGO ──────────────────────────────────────────────────────────

  card({
    id: "wf_autograph",
    name: "Autograph",
    issuer: "Wells Fargo",
    network: "Visa",
    currency: "wf",
    fee: 0,
    earn_json: earn(1, { dining: 3, travel: 3, hotels: 3, gas: 3, transit: 3, streaming: 3 }),
    sub_json: sub(20000, 1000, 3),
    sub_hi_json: sub(30000, 1500, 3, 2024),
    score: 68,
    perks_json: [
      { label: "3x Dining, Travel, Gas, Transit, Streaming, Phone", value: "No annual fee" },
      { label: "Cell Phone Protection", value: "Up to $600/claim" },
    ],
    color_json: ["#6b1a1a", "#c0392b"],
    ftf: 0,
    fico_min: 670,
  }),

  card({
    id: "wf_autograph_journey",
    name: "Autograph Journey",
    issuer: "Wells Fargo",
    network: "Visa",
    currency: "wf",
    fee: 95,
    earn_json: earn(1, { hotels: 5, travel: 4, dining: 3, transit: 3 }),
    sub_json: sub(60000, 4000, 3),
    score: 70,
    perks_json: [
      { label: "5x Hotels, 4x Airlines", value: "3x dining & other travel" },
      { label: "Airline Credit", value: "$50/yr", annual_credit: 50 },
      { label: "Transfer Partners", value: "Incl. Avios, Flying Blue, Choice" },
    ],
    color_json: ["#3d0c11", "#9e2a2b"],
    ftf: 0,
    fico_min: 700,
  }),

  card({
    id: "wf_active_cash",
    name: "Active Cash",
    issuer: "Wells Fargo",
    network: "Visa",
    currency: "cash",
    fee: 0,
    earn_json: earn(2),
    sub_json: sub(20000, 500, 3),
    score: 62,
    perks_json: [
      { label: "2% on Everything", value: "Unlimited cash rewards" },
      { label: "Cell Phone Protection", value: "Up to $600/claim" },
    ],
    color_json: ["#4a0000", "#8b1a1a"],
    ftf: 3,
    fico_min: 670,
  }),

  // ─── BANK OF AMERICA ──────────────────────────────────────────────────────

  card({
    id: "boa_ccr",
    name: "Customized Cash Rewards",
    issuer: "Bank of America",
    network: "Visa",
    currency: "cash",
    fee: 0,
    earn_json: earn(1, { groceries: 2 }),
    // 3% choice + 2% grocery share $2,500 a quarter
    caps_json: { custom: 2500, groceries: 2500 },
    capPeriod: "quarter",
    capShared: true,
    sub_json: sub(20000, 1000, 3),
    score: 60,
    perks_json: [
      { label: "3% Chosen Category", value: "Gas/EV, online, dining, travel, drugstore, or home improvement" },
      { label: "2% Grocery & Wholesale Clubs", value: "$2,500/qtr combined with 3%" },
      { label: "6% First Year", value: "On your 3% category" },
      { label: "BofA Rewards Boost", value: "Up to +75% for BofA clients" },
    ],
    color_json: ["#8b0000", "#b22222", "#cc3333"],
    custom: { max: 1, rate: 3, opts: ["gas", "online", "dining", "travel", "drugstore"] },
    ftf: 3,
    fico_min: 670,
  }),

  card({
    id: "boa_premium_rewards",
    name: "Premium Rewards",
    issuer: "Bank of America",
    network: "Visa",
    currency: "cash",
    fee: 95,
    earn_json: earn(1.5, { dining: 2, travel: 2, hotels: 2 }),
    sub_json: sub(60000, 4000, 3),
    score: 64,
    perks_json: [
      { label: "2x Travel & Dining", value: "1.5x everything else" },
      { label: "Airline Incidental Credit", value: "$100/yr", annual_credit: 100 },
      { label: "Global Entry / TSA PreCheck", value: "$120 credit" },
    ],
    color_json: ["#0b1d3a", "#3a5a98"],
    ftf: 0,
    fico_min: 700,
  }),

  // ─── FINTECH ──────────────────────────────────────────────────────────────

  card({
    id: "robinhood_gold",
    name: "Robinhood Gold Card",
    issuer: "Robinhood",
    network: "Visa",
    currency: "cash",
    fee: 50,
    earn_json: earn(3),
    sub_json: null,
    score: 72,
    perks_json: [
      { label: "3% on Everything", value: "Requires Robinhood Gold ($50/yr)" },
      { label: "5% Travel", value: "Via Robinhood travel portal" },
      { label: "3% Foreign Transaction Fee", value: "New accounts since July 2026" },
    ],
    color_json: ["#2a2208", "#b08d2e", "#e6c763"],
    ftf: 3,
    fico_min: 690,
  }),

  // ─── BILT ─────────────────────────────────────────────────────────────────

  card({
    id: "bilt",
    name: "Bilt Blue Card",
    issuer: "Bilt",
    network: "Mastercard",
    currency: "bilt",
    fee: 0,
    earn_json: earn(1),
    sub_json: null,
    score: 68,
    perks_json: [
      { label: "Welcome Bonus", value: "$100 Bilt Cash on approval" },
      { label: "Points on Rent & Mortgage", value: "Up to 1.25x, no transaction fee" },
      { label: "4% Bilt Cash", value: "On everyday spend (Bilt Cash option)" },
      { label: "4x Bilt Dining, 3x Bilt Travel Hotels", value: "3x Lyft" },
      { label: "Transfer Partners", value: "Hyatt, United, Alaska & more 1:1" },
    ],
    color_json: ["#1a1a1a", "#2d2d2d", "#404040"],
    ftf: 0,
    fico_min: 670,
  }),

  card({
    id: "bilt_obsidian",
    name: "Bilt Obsidian Card",
    issuer: "Bilt",
    network: "Mastercard",
    currency: "bilt",
    fee: 95,
    earn_json: earn(1, { travel: 2, hotels: 2 }),
    caps_json: { custom: 25000 },
    capPeriod: "year",
    sub_json: null,
    score: 70,
    perks_json: [
      { label: "Welcome Bonus", value: "$200 Bilt Cash on approval" },
      { label: "3x Dining OR Groceries", value: "Your choice (groceries up to $25k/yr)" },
      { label: "2x Travel", value: "4x hotels via Bilt Travel" },
      { label: "Points on Rent & Mortgage", value: "Up to 1.25x, no transaction fee" },
      { label: "Hotel Credit", value: "$100/yr ($50 semiannual, Bilt Travel)", annual_credit: 100 },
    ],
    color_json: ["#0b0b0b", "#1f1f1f", "#3a3a3a"],
    custom: { max: 1, rate: 3, opts: ["dining", "groceries"] },
    ftf: 0,
    fico_min: 700,
  }),

  card({
    id: "bilt_palladium",
    name: "Bilt Palladium Card",
    issuer: "Bilt",
    network: "Mastercard",
    currency: "bilt",
    fee: 495,
    earn_json: earn(2, { rent: 1 }),
    sub_json: sub(50000, 4000, 3),
    score: 74,
    perks_json: [
      { label: "2x on Everything", value: "Rent & mortgage up to 1.25x, no fee" },
      { label: "Welcome Bilt Cash", value: "$300 on approval + Gold status" },
      { label: "Hotel Credit", value: "$400/yr ($200 semiannual, Bilt Travel)", annual_credit: 400 },
      { label: "Bilt Cash", value: "$200/yr", annual_credit: 200 },
      { label: "Priority Pass", value: "Unlimited lounge access" },
    ],
    color_json: ["#4a3728", "#8b6914", "#c9a84c"],
    ftf: 0,
    fico_min: 720,
  }),
];

/** O(1) lookup by card id. */
export const CARD_MAP: Record<string, Card> = Object.fromEntries(
  CARDS.map((c) => [c.id, c])
);

export default CARDS;
