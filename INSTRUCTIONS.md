# MyCreditCardinal — Product Specification

> This file is the authoritative product spec. Read it at the start of every session.
> For visual/styling rules, see DESIGN.md. For build sequence, see TASKS.md.

## What is this product?

MyCreditCardinal is a freemium Progressive Web App that helps users maximize credit card rewards. Users build a virtual wallet, enter monthly spending, and the app routes each category to the optimal card. A Pro tier adds an optimizer that recommends new cards, a monthly Wallet Health Report, and multi-person household wallets.

## Tech stack

- **Framework:** Next.js 14+ (App Router, Server Components)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS with CSS variables for theming (see DESIGN.md)
- **State:** Zustand with localStorage hydration for offline, syncs to Supabase when online
- **Auth:** Supabase Auth (Google OAuth + Apple Sign-In for trial; email magic link for returning users)
- **Database:** PostgreSQL via Supabase with Row-Level Security
- **Hosting:** Vercel
- **Payments:** Stripe (subscriptions, trials, webhooks)
- **Anti-abuse:** Fingerprint.js for trial cycling prevention
- **Analytics:** PostHog
- **PWA:** next-pwa / Workbox (service worker, offline shell, install prompt)

## Database schema

```sql
-- Users
users: id uuid PK, email text UNIQUE, name text, plan enum('trial','free','pro'), trial_ends_at timestamp, device_fingerprint text, stripe_customer_id text, created_at timestamp

-- Households (multi-person wallets)
households: id uuid PK, user_id uuid FK(users), name text
household_members: id uuid PK, household_id uuid FK(households), name text, sort_order int

-- Wallet cards
wallet_cards: id uuid PK, member_id uuid FK(household_members), card_id text, config_json jsonb
-- config_json example: { "rotQ": ["groceries", null, "dining", null], "custom": ["gas", "streaming"] }

-- Card database (admin-managed)
cards: id text PK, name text, issuer text, network text, currency text, fee int, earn_json jsonb, caps_json jsonb, sub_json jsonb, sub_hi_json jsonb, score int, perks_json jsonb, color_json jsonb, rotating boolean, rot_cap int, rot_opts jsonb, custom_select boolean, custom_max int, custom_rate numeric, custom_opts jsonb, status text DEFAULT 'active'

-- User-created custom cards
custom_cards: id uuid PK, user_id uuid FK(users), [same columns as cards]

-- SUB tracking
sub_earned: id uuid PK, wallet_card_id uuid FK(wallet_cards), earned_at timestamp

-- Spend profiles
spend_profiles: id uuid PK, user_id uuid FK(users), name text, spend_json jsonb, is_default boolean
-- spend_json: { "dining": 300, "groceries": 500, "gas": 150, ... }

-- Valuation data (for MCC Composite)
valuations: id uuid PK, currency text, month text, source text, value_cents numeric
```

## Spending categories (12 total)

| ID | Label | Default $/mo | Slider max |
|----|-------|-------------|------------|
| dining | Dining | 300 | 2000 |
| groceries | Groceries | 500 | 2000 |
| gas | Gas | 150 | 600 |
| travel | Travel / flights | 200 | 3000 |
| hotels | Hotels | 100 | 2000 |
| streaming | Streaming / subs | 100 | 500 |
| online | Online shopping | 200 | 1500 |
| entertainment | Entertainment | 150 | 1500 |
| transit | Transit / rideshare | 80 | 500 |
| rent | Rent / mortgage | 0 | 10000 |
| drugstore | Drug stores | 40 | 300 |
| other | Everything else | 200 | 3000 |

## Point/mile currencies and valuations

MyCreditCardinal uses a proprietary "MCC Composite" valuation — a trimmed mean of 5-6 published sources (TPG, Upgraded Points, NerdWallet, Bankrate, OMAAT, Freddie Awards). Users see three tiers:

| Currency | ID | Floor | MCC Composite | Ceiling |
|----------|----|-------|---------------|---------|
| Chase Ultimate Rewards | chase_ur | 1.00¢ | 2.00¢ | 4.00¢ |
| Amex Membership Rewards | amex_mr | 1.00¢ | 1.95¢ | 4.00¢ |
| Capital One Miles | cap1 | 1.00¢ | 1.70¢ | 3.00¢ |
| Citi ThankYou Points | citi_typ | 1.00¢ | 1.75¢ | 3.50¢ |
| Bilt Rewards | bilt | 1.00¢ | 2.10¢ | 3.50¢ |
| Wells Fargo Rewards | wf | 1.00¢ | 1.55¢ | 2.50¢ |
| Cash Back | cash | 1.00¢ | 1.00¢ | 1.00¢ |
| Discover Cashback | discover | 1.00¢ | 1.00¢ | 1.00¢ |

## Routing engine rules

1. For each spending category, evaluate all cards in the user's wallet
2. Calculate earn rate per card per category (handle rotating, custom-select, and base rates)
3. Sort by **raw earn rate descending** (NOT by dollar value — valuations never affect routing order)
4. Tiebreak: user-preferred currency > higher-valued currency
5. Check if the best card has a cap for this category. If spend exceeds cap:
   - Route up-to-cap amount to best card
   - Route overflow to second-best card
   - If second card also caps, route remaining to third-best
6. Track per-card cap usage across all categories (caps are shared, not per-category)
7. Allow manual override per category via dropdown

### Special card logic:
- **Rotating cards** (Freedom Flex, Discover it): earn rate = base_rate + 5 for the selected quarterly category. E.g., Freedom Flex dining base is 3x; with quarterly bonus it's 7x (not 5x). Cap applies only to the bonus portion.
- **Custom-select cards** (Citi Custom Cash, US Bank Cash+, BoA CCR): earn rate = customRate for selected categories, default rate for everything else.
- **Annual summary**: runs the routing engine 4 times (once per quarter with different flex/rotating selections) and sums 3 months per quarter.

## Tier design

### 30-day trial (full access, no card required)
- Google/Apple OAuth only for signup
- Fingerprint.js device check — block trial on devices that already had one
- Full Pro access for 30 days
- First Wallet Health Report delivered around day 25-30
- Trial expiration flow: show what they're losing + upgrade prompt

### Free tier (after trial)
- 1 person, 5 cards max
- 1 spending profile
- Full simulator (all 12 categories, 3 valuation tiers)
- Full annual summary
- Optimizer: top 2 results visible, remaining 6 blurred
- No Wallet Health Report (ghost preview monthly)
- No export or sharing
- Card browser: full access

### Pro tier ($7.99/month or $59.99/year)
- Unlimited people and cards
- Unlimited spending profiles
- Full optimizer (8 results + what-if mode)
- Monthly Wallet Health Report (email + in-app)
- SUB alerts, rotation reminders, fee renewal checks
- Export PDF, shareable wallet link

## Card database (V1 — 24 cards)

Launch cards: Chase Sapphire Reserve, Sapphire Preferred, Freedom Flex, Freedom Unlimited, Amazon Prime Visa; Amex Platinum, Gold, Blue Cash Preferred, Blue Cash Everyday; Capital One Venture X, Venture, SavorOne, Quicksilver; Citi Strata Premier, Strata Elite, Custom Cash, Double Cash; Discover it Cash Back; US Bank Cash+; Wells Fargo Autograph, Active Cash; Bank of America Customized Cash; Bilt Mastercard, Bilt Palladium.

Expand based on user "add this card" requests — each request is a prioritization signal.

## Optimizer engine

```
For each card NOT in wallet:
  Filter by user preferences (max fee, credit score, preferred issuer)
  For each spending category:
    current_best_rate = max(earn_rate of wallet cards for this category)
    candidate_rate = earn_rate of candidate card for this category
    if candidate_rate > current_best_rate:
      gain += (candidate_rate - current_best_rate) * monthly_spend * 12 * cpp / 100
  sub_value = candidate SUB points * cpp / 100 (or cash amount)
  net_value = gain + sub_value - annual_fee
  
Rank by net_value descending. Return top 8.
```

## Wallet Health Report (Pro, monthly)

Delivered 1st of each month. Contains:
1. **Routing drift**: compares current spending to last month. Flags categories where a different card is now optimal.
2. **SUB opportunities**: cards with elevated or all-time-high SUBs, filtered to user's wallet gaps.
3. **Rotation recommendation**: suggests optimal quarterly categories for upcoming quarter.
4. **Fee renewal check**: upcoming annual fees with net-value assessment.

## Pages / Routes

- `/` — Landing page (logged out) or Dashboard (logged in)
- `/login` — Auth page (Google/Apple OAuth, email magic link)
- `/browse` — Card browser with search/filter
- `/browse/[cardId]` — Card detail modal/page
- `/wallet` — Wallet management (cards, rotations, custom picks, SUBs)
- `/simulate` — Spend simulator with routing table
- `/optimize` — Optimizer (Pro-gated)
- `/settings` — Account, plan, billing
- `/admin` — Card database management (restricted to admin email)
