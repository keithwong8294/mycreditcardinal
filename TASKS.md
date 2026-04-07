# MyCreditCardinal — Build Tasks

> Execute these tasks in order. Each task is a self-contained mission for Claude Code.
> After each task: test in browser, then commit and push before starting the next.
> Format: tell Claude Code "Read INSTRUCTIONS.md and DESIGN.md. Then do Task X.X."

---

## Phase 1: Foundation (Weeks 1–3)

### Task 1.1 — Project scaffold
Create a new Next.js 14 project called `mycreditcardinal` with TypeScript, Tailwind CSS, and the App Router. Initialize a git repo. Set up the folder structure:
- `app/` — pages and layouts (App Router)
- `app/(auth)/` — login page
- `app/(main)/` — authenticated pages (browse, wallet, simulate, optimize)
- `components/` — shared UI components
- `lib/` — utilities, database client, card data, routing engine
- `types/` — TypeScript interfaces
- `public/` — static assets, PWA manifest

Install dependencies: `@supabase/supabase-js`, `@supabase/ssr`, `zustand`. Set up Tailwind config with the color system from DESIGN.md. Create the base layout with the dark theme, Outfit font, header with logo, person chip bar (hardcoded for now), and tab navigation (Browse Cards, My Wallet, Simulator, Optimize). All tabs show placeholder content.

**Test:** `npm run dev` → localhost:3000 shows the app shell with tabs. Dark theme matches DESIGN.md.

---

### Task 1.2 — TypeScript types
Create all TypeScript interfaces in `types/`:
- `Card` — matches the cards table schema from INSTRUCTIONS.md
- `Currency` — id, name, floor, composite, ceiling values
- `SpendCategory` — id, label, default, sliderMax
- `WalletCard` — card + user config (rotQ, custom selections)
- `SpendProfile` — name, spend record
- `RoutingResult` — per-category: primary card, rate, points, overflow info
- `User` — id, email, name, plan, trialEndsAt
- `HouseholdMember` — id, name, cards
- `Recommendation` — card, gain, subValue, improvements, netValue

**Test:** no runtime test — TypeScript compiles without errors.

---

### Task 1.3 — Card database seed
Create `lib/cards.ts` with the full 24-card database as a typed constant array. Each card follows the Card interface. Include all earn rates, caps, SUB data, colors, rotating/custom-select config. Also create `lib/currencies.ts` with all currency valuations (floor, composite, ceiling) and `lib/categories.ts` with all 12 spending categories.

**Test:** import and console.log the card count — should be 24.

---

### Task 1.4 — Routing engine
Create `lib/engine.ts` with:
- `getEarnRate(card, categoryId, config)` — handles rotating, custom-select, and base rates
- `routeMonth(walletCards, spend, overrides, viewQuarter)` — returns per-category routing + currency totals
- `routeAnnual(walletCards, spend, overrides, quarterConfigs)` — runs routeMonth x4, sums 3mo each
- `calculateFees(walletCards)` — gross fees, credits estimate, net
- `calculateSubValue(walletCards, earnedSubs, valuationTier)` — total earned SUB dollar value
- `getRecommendations(walletCards, spend, preferences, allCards)` — optimizer engine

Write unit tests for the routing engine (at least: basic routing, cap overflow, rotating quarter, custom-select, annual aggregation).

**Test:** `npm test` passes. Routing engine correctly routes dining to Freedom Flex at 7x when quarterly is set to dining.

---

### Task 1.5 — Zustand store
Create `lib/store.ts` with Zustand store containing:
- `people` array (HouseholdMember[]), `activePerson` id
- `spend` record, `overrides` record, `subEarned` set
- `cardConfigs` map (per-card rotation/custom settings)
- `viewQuarter`, `valuationTier`
- `tab` (active tab name)
- Actions: addPerson, removePerson, renamePerson, toggleCard, setSpend, setOverride, toggleSub, setRotation, setCustomCategory, setViewQuarter, setValuation

Persist to localStorage. Hydrate on app load.

**Test:** open app, add a card via console (`useStore.getState().toggleCard('csr')`), refresh page — card persists.

---

### Task 1.6 — Supabase setup
Create `lib/supabase/client.ts` and `lib/supabase/server.ts`. Add environment variables to `.env.local` (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY). Create SQL migration files for all tables from INSTRUCTIONS.md schema. Add Row-Level Security policies so users can only read/write their own data.

**Test:** migration runs successfully against Supabase project. Tables visible in Supabase dashboard.

---

### Task 1.7 — Authentication
Implement Supabase Auth with:
- Login page at `/login` with Google OAuth button and email magic link form
- Auth context provider wrapping the app
- Middleware that redirects unauthenticated users to `/login`
- After first login: create default household with one member named after user, set plan='trial', trial_ends_at = now + 30 days
- Show user name in header; logout button in settings
- Fingerprint.js: on signup, capture device fingerprint and store. On new signup, check if fingerprint already exists with a used trial — if so, skip trial and start on free tier.

**Test:** sign up with Google → redirected to app → name shows in header → refresh → still logged in. Sign up with same device fingerprint → starts on free tier, not trial.

---

### Task 1.8 — Data sync
Connect Zustand store to Supabase:
- On login: fetch user's households, members, wallet_cards, spend_profiles, sub_earned from Supabase → hydrate store
- On any store change: debounced write to Supabase (optimistic local update, async server sync)
- Conflict resolution: last-write-wins (acceptable for V1)
- Offline handling: queue writes when offline, flush when back online

**Test:** add cards and set spending → close browser → reopen → data is there. Open in incognito (different localStorage) → log in → same data.

---

## Phase 2: Core Product (Weeks 3–6)

### Task 2.1 — Card browser page
Build `/browse` page:
- Search input (filters by card name + issuer, debounced 200ms)
- Issuer filter dropdown
- Fee range filter (No fee, Under $100, Under $250, Under $500, Any)
- Card grid (responsive: 1 col mobile, 2 col tablet, 3 col desktop)
- Each card tile per DESIGN.md (face with gradient + issuer + name, body with fee + earn pills)
- Cards in wallet show green checkmark badge and green border
- **Clicking anywhere on a card tile opens the detail modal** (NOT toggle add/remove)
- "Custom card" button opens manual entry form (name, issuer, currency, fee, per-category earn rates)

**Test:** see all 24 cards. Search "chase" → filters to 5 cards. Click a card → detail modal opens (not add to wallet). Close modal → back to grid.

---

### Task 2.2 — Card detail modal
Create a modal that opens when any card tile is clicked in the browser:
- Card face (larger, with gradient)
- Full earn rate table: all 12 categories with rate
- Annual fee, net fee after estimated credits
- Current SUB: points amount, spend requirement, timeframe
- Highest-ever SUB with year
- Required FICO score
- Perks list
- Network badge
- If rotating card: show current quarter's auto-populated category + note about quarterly rotation
- If custom-select: note about category selection
- **Bottom section: list ALL household members**, each with "Add to [name]'s wallet" / "Remove from [name]'s wallet" button. E.g., if user has "Keith" and "Tiff", show both with individual add/remove controls.
- Close modal with X button or clicking outside

**Test:** click Freedom Flex → modal shows full info + all household members with add/remove buttons. Add to person 1 → close → card shows green badge. Reopen → person 1 shows "Remove", person 2 still shows "Add".

---

### Task 2.3 — Wallet page
Build `/wallet` page:
- Person selector at top — switch between household members to see each person's wallet
- Card list per person: each card as a row (mini face, name, issuer/fee/currency, remove button)
- **Rotating cards (Freedom Flex, Discover it): auto-populated quarterly categories from the card's `rotation_schedule` field.** Show Q1–Q4 with the pre-filled categories and an "Override" button per quarter if the user wants to change them. Display a notification banner when a new quarter's categories auto-update.
- Custom-select cards (Citi CC, USB Cash+, BoA CCR): show category pick buttons with max indicator
- SUB section: list of cards with SUBs as checkbox rows. Checked = earned. Shows dollar value at current valuation.
- Person management: rename button, remove button (if >1 person), add person button in header chip bar
- Pro gates: if free tier and >5 cards, show "Upgrade to add more cards" when trying to add 6th. If free tier and trying to add 2nd person, show upgrade prompt.

**Test:** add Freedom Flex → Q1-Q4 auto-populated with 2026 categories. Override Q2 to "groceries" → persists. Check 2 SUBs → see dollar values. Switch person → see different wallet.

---

### Task 2.4 — Spend simulator page ← USE OPUS FOR THIS TASK
Build `/simulate` page. This is the most complex UI in the app — read INSTRUCTIONS.md carefully for the three-layer spending model, per-person routing, and view modes.

**Person selector** at top — switch between household members. Each person has INDEPENDENT spending.

**View mode toggle**: Individual / Combined / Compare
- Individual: shows one person's spending, routing, monthly/annual value
- Combined: merges all people's spending into total household view
- Compare: side-by-side (desktop) or stacked (mobile) showing each person independently

**Month view**: month selector (Jan 2026 – Dec 2026)
- Shows spending and routing for that specific month
- Each category row: slider + text input (pre-filled from default average)
- If user has overridden this month, shows the override. Otherwise shows the default.
- Editing a month's value saves as a monthly override (doesn't change the default average)
- "Reset to average" button per category to clear the override

**Annual summary view**: aggregates all 12 months
- Uses monthly overrides where entered, default average for all other months
- Per-month bar chart or breakdown showing earnings over time
- Total annual value, fees, SUBs, net

**Routing table** (shown in both monthly and annual views):
- 12 category rows
- Each row: category label, spending amount (slider + input), card dropdown (Auto: [card name] [rate]x), rate, raw points, dollar value
- Overflow and cap indicators
- Three valuation tiers (Floor / MCC Composite / Ceiling)

**Metric cards** (4 columns):
- Monthly points value (for monthly view) OR Annual points value (for annual view)
- Fees (net)
- SUBs earned
- Net total value

**Test:** 
- Set person 1 dining to $400 → switch to person 2 → dining should be at THEIR default, not $400
- Enter December dining as $600 (override) → switch to January → shows default $300
- Toggle to Combined view → shows both people's spending merged
- Toggle to Compare → see both people side by side
- Annual summary uses December's $600 override + 11 months of $300 default = $3,900 total dining

---

### Task 2.5 — Admin page
Create `/admin` page (protected: only accessible by a hardcoded admin email, or by a Supabase RLS policy checking a role column):
- Table of all cards in database with edit/delete buttons
- Add card form with all fields from the Card schema
- JSON editor for complex fields (earn rates, caps, perks)
- **Rotation schedule editor**: for rotating cards, a visual Q1–Q4 editor per year to set the announced categories. When saved, all users with this card auto-update on next load.
- Valuation editor: update MCC Composite values per currency per month

**Test:** log in as admin → see all 24 cards → edit Freedom Flex 2026 Q2 rotation to "dining, streaming" → save → verify user wallets auto-populate with updated categories.

---

## Phase 3: Monetization (Weeks 6–9)

### Task 3.1 — Optimizer page ← USE OPUS FOR THIS TASK
Build `/optimize` page:
- Person selector at top (optimizer runs per-person against their wallet and spending)
- Preference filters: max annual fee dropdown, credit score dropdown (Excellent/Good/Fair), preferred issuer dropdown, preferred currency dropdown
- Recommendation cards below (up to 8):
  - Card face mini + name + issuer + fee
  - Net annual value gained (large, green)
  - **Plain-English explanation** (REQUIRED for every recommendation). Dynamically generated. Example:
    > "This card earns 4x on dining vs your current best of 2x (Amazon Visa). At $300/month in dining, that's an extra $144/year in Chase UR points. Combined with the 60,000 point welcome bonus (~$1,230), this card adds $1,278 in first-year value after subtracting the $95 annual fee."
  - Category improvement pills ("Dining: 2x→4x")
  - "Add to [person]'s wallet" button
  - "What-if" button (Pro): opens side-by-side before/after annual summary showing exactly what changes
- Free tier gate: show top 2 results fully. Results 3-8 are blurred/overlaid with "Upgrade to Pro to see 6 more recommendations"

**Test:** with 3 cards in wallet and real spending, optimizer suggests cards with clear explanations referencing the user's actual spend amounts and current card rates. Amex Gold should appear if no 4x grocery/dining card is present.

---

### Task 3.2 — Stripe integration
Set up Stripe:
- Products: MyCreditCardinal Pro Monthly ($7.99/mo), MyCreditCardinal Pro Annual ($59.99/yr)
- Checkout flow: pricing page → Stripe Checkout → redirect back to app
- Webhook handler: listen for checkout.session.completed, customer.subscription.updated, customer.subscription.deleted → update user's plan in Supabase
- 30-day trial: on signup, set plan='trial'. Stripe subscription not created until user clicks "Subscribe" (trial is app-managed, not Stripe-managed, so no card required)
- Billing management: link to Stripe Customer Portal for plan changes/cancellation
- Store stripe_customer_id on user record

**Test:** (Stripe test mode) click Subscribe → Stripe checkout → complete with test card → redirected back → plan shows "Pro" → features unlocked.

---

### Task 3.3 — Pro feature gates
Implement plan-based feature gating:
- `useProCheck()` hook that returns { isPro, isTrial, isExpired }
- Gate: adding 6th card → show upgrade modal
- Gate: adding 2nd person → show upgrade modal
- Gate: optimizer results 3-8 → blur overlay with upgrade CTA
- Gate: export/share buttons → upgrade modal
- Gate: creating 2nd spend profile → upgrade modal
- Trial expiration: when trial_ends_at < now, downgrade to free in UI. Show banner: "Your trial has ended. Upgrade to keep Pro features."
- Monthly ghost health report (free users): on 1st of month, show a card in the app: "Your January Wallet Health Report found 3 optimizations worth $127/month. Upgrade to see details."

**Test:** create free account → try to add 6th card → see upgrade modal. Subscribe to Pro → 6th card adds successfully.

---

### Task 3.4 — Wallet Health Report v1
Create a monthly report system:
- Supabase Edge Function or Vercel Cron Job that runs on the 1st of each month
- For each Pro user: run the routing engine against their current wallet and spend profile
- Compare to previous month (store last month's routing result)
- Generate report content: routing changes, potential improvements, SUB highlights
- Send via email (Resend API or Supabase built-in email)
- Also store in-app as a viewable report at `/reports`

**Test:** manually trigger the report function → receive email with wallet analysis.

---

## Phase 4: Launch (Weeks 9–12)

### Task 4.1 — Landing page
Create marketing landing page at `/` for logged-out users:
- Hero: "Stop leaving rewards on the table." + subhead + "Get started free" CTA
- How it works: 3-step visual (Add cards → Enter spending → See your optimal setup)
- Feature highlights: wallet simulation, optimal routing, smart recommendations, household wallets
- Pricing section: Free vs Pro comparison table
- Social proof section (placeholder testimonials)
- FAQ accordion
- Footer with links
- Mobile responsive
- Dark theme matching the app

**Test:** visit logged out → see landing page → click "Get started free" → goes to /login.

---

### Task 4.2 — PWA setup
Finalize Progressive Web App:
- Manifest with app name, icons (192px, 512px), theme color (#08080e), background color
- Service worker: cache-first for static assets (CSS, JS, fonts), network-first for API calls
- Offline shell: show cached app with "You're offline" banner
- Install prompt: detect beforeinstallprompt event, show custom install banner
- Splash screen configuration

**Test:** Lighthouse PWA audit scores 90+. Install on phone → app icon appears → open offline → see cached content.

---

### Task 4.3 — Performance optimization
- Lazy load card database (dynamic import)
- Code-split each page (App Router handles this)
- Image optimization: next/image for any card images
- Loading states: static gray placeholder cards during data fetch
- Meta tags: title, description, OG image for social sharing
- Sitemap generation for SEO

**Test:** Lighthouse performance score 90+. First Contentful Paint < 1.5s.

---

### Task 4.4 — Analytics
Add PostHog:
- Page views (automatic with Next.js integration)
- Custom events: card_added, card_removed, spend_updated, optimizer_viewed, optimizer_card_added, pro_upgrade_clicked, pro_subscribed, trial_started, trial_expired, health_report_opened
- User identification (link PostHog user to Supabase user ID)
- Feature flags setup (for A/B testing Pro gates later)

**Test:** perform actions in app → see events in PostHog dashboard.

---

### Task 4.5 — Pre-launch checklist
- [ ] All pages render correctly on mobile (test on real phone)
- [ ] Auth flow works end-to-end (signup → trial → expire → upgrade → billing)
- [ ] Stripe webhooks work in production mode
- [ ] Supabase RLS policies prevent cross-user data access
- [ ] Privacy policy page exists
- [ ] Terms of service page exists
- [ ] Disclaimer on optimizer: "For informational purposes only. Not financial advice."
- [ ] Error boundaries on all pages
- [ ] 404 page
- [ ] Favicon and OG image
- [ ] Domain configured in Vercel
- [ ] Environment variables set in Vercel dashboard
- [ ] Supabase production project (separate from dev)

**Test:** full user journey from landing page → signup → add cards → simulate → optimize → subscribe → receive health report.

---

## Phase 5+: Post-Launch Tasks (prioritize based on user feedback)

### Task 5.1 — Enhanced Wallet Health Report
Add routing drift analysis, personalized SUB alerts, quarterly rotation recommendations, fee renewal checks.

### Task 5.2 — Community card submissions
"Report outdated info" button, submission form, admin moderation queue.

### Task 5.3 — Card database expansion
Research and add cards based on user requests. Target: 40-50 cards by month 6.

### Task 5.4 — MCC Composite blog
Monthly valuations blog post. Create `/blog` with MDX support.

### Task 5.5 — Affiliate links
Add "Apply" buttons to card detail and optimizer results. Route through affiliate network. Add disclosure banner.

### Task 5.6 — Plaid integration
Evaluate cost/benefit. If proceeding: Plaid Link integration, transaction categorization, monthly auto-population of spend profiles.
