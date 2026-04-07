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
cards: id text PK, name text, issuer text, network text, currency text, fee int, earn_json jsonb, caps_json jsonb, sub_json jsonb, sub_hi_json jsonb, score int, perks_json jsonb, color_json jsonb, rotating boolean, rot_cap int, rot_opts jsonb, rotation_schedule jsonb, custom_select boolean, custom_max int, custom_rate numeric, custom_opts jsonb, status text DEFAULT 'active'
-- rotation_schedule auto-populates quarterly categories for rotating cards:
-- { "2026": { "Q1": ["groceries"], "Q2": ["dining", "streaming"], "Q3": ["online"], "Q4": ["entertainment"] } }
-- When a user adds a rotating card, config_json.rotQ auto-fills from this schedule
-- User can still manually override any quarter

-- User-created custom cards
custom_cards: id uuid PK, user_id uuid FK(users), [same columns as cards]

-- SUB tracking
sub_earned: id uuid PK, wallet_card_id uuid FK(wallet_cards), earned_at timestamp

-- Spend profiles (per household member, not per user)
spend_profiles: id uuid PK, member_id uuid FK(household_members), name text, spend_json jsonb, is_default boolean
-- spend_json uses three-layer model:
-- {
--   "dining": {
--     "default": 300,                    ← Layer 1: quick-start monthly average
--     "months": {                         ← Layer 2: monthly overrides (only months that differ)
--       "2026-01": 280,
--       "2026-12": 600
--     }
--   },
--   "groceries": { "default": 500 },     ← no overrides = uses default for all 12 months
--   ...
-- }
-- Layer 3 (future): Plaid auto-populates the months object from transaction data

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

1. Routing is **per-person**. Each household member has their own spend profile and wallet cards.
2. For each spending category, get the month's spend amount (from monthly override if exists, otherwise from default average)
3. Evaluate all cards in THAT PERSON's wallet for this category
4. Calculate earn rate per card per category (handle rotating, custom-select, and base rates)
5. Sort by **raw earn rate descending** (NOT by dollar value — valuations never affect routing order)
6. Tiebreak: user-preferred currency > higher-valued currency
7. Check if the best card has a cap for this category. If spend exceeds cap:
   - Route up-to-cap amount to best card
   - Route overflow to second-best card
   - If second card also caps, route remaining to third-best
8. Track per-card cap usage across all categories (caps are shared, not per-category)
9. Allow manual override per category via dropdown
10. **Annual summary**: runs routing for each of 12 months separately (using monthly override or default), applying the correct quarterly rotation per month. Sum all 12 months.

### Special card logic:
- **Rotating cards** (Freedom Flex, Discover it): categories **auto-populate** from the `rotation_schedule` field in the card database. When a rotating card is added to a wallet, `config_json.rotQ` is automatically set to the current year's schedule. Users see the pre-filled quarters and can override any of them. When admin updates next year's schedule, all users' cards auto-update on next load. Earn rate = base_rate + 5 for the active quarterly category. E.g., Freedom Flex dining base is 3x; with quarterly bonus it's 7x (not 5x).
- **Custom-select cards** (Citi Custom Cash, US Bank Cash+, BoA CCR): earn rate = customRate for selected categories, default rate for everything else.

### Simulator view modes:
- **Individual**: shows one person's spending, routing, and monthly/annual value (default view)
- **Combined**: merges all household members' spending and routing into one view. Shows total household value.
- **Compare**: shows all household members side by side (desktop) or stacked (mobile). Each person's routing and totals shown independently for easy comparison.

### Monthly vs Annual view:
- **Monthly view**: shows spending and routing for a specific month (Jan–Dec selector). If user has entered monthly overrides, shows actuals. Otherwise shows the default average.
- **Annual summary**: aggregates all 12 months. Shows per-month breakdown chart and total annual value.

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

### Plain-English explanations (required for every recommendation)
Each recommendation card MUST include a dynamically generated explanation. Example:
> "This card earns 4x on dining vs your current best of 2x (Amazon Visa). At $300/month in dining, that's an extra $144/year in Chase UR points. Combined with the 60,000 point welcome bonus (~$1,230 at MCC Composite valuation), this card adds $1,278 in first-year value after subtracting the $95 annual fee."

The explanation should reference: which specific categories improve, the user's actual spend in those categories, the dollar value of the improvement, the SUB value, and the fee impact. Use conversational language, not jargon.

## Wallet Health Report (Pro, monthly)

Delivered 1st of each month. Contains:
1. **Routing drift**: compares current spending to last month. Flags categories where a different card is now optimal.
2. **SUB opportunities**: cards with elevated or all-time-high SUBs, filtered to user's wallet gaps.
3. **Rotation recommendation**: suggests optimal quarterly categories for upcoming quarter.
4. **Fee renewal check**: upcoming annual fees with net-value assessment.

## Pages / Routes

- `/` — Landing page (logged out) or Dashboard (logged in)
- `/login` — Auth page (Google/Apple OAuth, email magic link)
- `/browse` — Card browser with search/filter. **Clicking a card tile opens detail modal** (no separate details button). Modal includes per-person "Add to [name]'s wallet" / "Remove" buttons.
- `/wallet` — Wallet management. Per-person card lists, auto-populated rotating quarter configs (with manual override), custom category picks, SUB toggle tracker.
- `/simulate` — Spend simulator. Person selector at top. View mode toggle: Individual / Combined / Compare. Month selector (Jan–Dec) for monthly view. Annual summary tab. Three-layer spending input (default average pre-filled, override individual months). Routing table with per-row card override dropdown.
- `/optimize` — Optimizer (Pro-gated). Plain-English explanations per recommendation. What-if before/after mode (Pro).
- `/settings` — Account, plan, billing
- `/admin` — Card database management (restricted to admin email). Includes rotation schedule editor for updating quarterly categories.

## UX Patterns

### Card browser → Detail modal
- Clicking anywhere on a card tile opens the detail modal
- Modal shows: full earn rate table, fee, perks, SUB info, highest-ever SUB, FICO, network
- Bottom of modal: list of all household members with "Add to [name]'s wallet" or "Remove from [name]'s wallet" per person
- Close modal returns to browse grid

### Spending input (three-layer model)
- **Layer 1 — Quick-start average**: When a user first sets up, they enter a single monthly average per category. This is the default used for all 12 months.
- **Layer 2 — Monthly overrides**: In the simulator, users can switch to a specific month (Jan–Dec) and override any category's spending for that month. Only the overridden months are stored; everything else falls back to the Layer 1 average.
- **Layer 3 — Auto-connected (future Pro)**: Plaid populates the monthly actuals automatically. Same data structure as Layer 2 but filled by transaction data instead of manual entry.
- Every month field pre-fills from the Layer 1 default. Users only touch the months that differ from their average. This keeps data entry minimal (~10-15 edits vs 144 fields).

### Rotating category auto-population
- The `cards` table has a `rotation_schedule` field with announced quarterly categories per year
- When a user adds a rotating card (Freedom Flex, Discover it), the wallet auto-fills Q1–Q4 from the current year's schedule
- Users see the pre-filled categories and can override any quarter
- Admin updates the schedule via the admin panel when issuers announce new quarters
- On app load, if a new quarter's categories are available, user configs auto-update (with a notification: "Freedom Flex Q2 categories updated: Dining & Streaming")
