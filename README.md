# MyCreditCardinal

Tells you which credit card to use for each purchase, and what a better wallet would earn.

Live: https://mycreditcardinal.vercel.app

## Stack

Next.js 16 (App Router, `proxy.ts`), Supabase (auth + Postgres), Zustand (local-first state, synced when signed in), Stripe, PostHog. Deployed on Vercel from `master`.

## Develop

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # engine + card-data tests
```

Visitors can use everything without an account ("Continue without signing in"); data stays in the browser.

## Environment variables

| Name | Notes |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only. First-login setup, Stripe webhook, cron |
| `NEXT_PUBLIC_SITE_URL` | e.g. `https://mycreditcardinal.vercel.app` (OAuth redirect) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Billing |
| `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | Analytics |
| `CRON_SECRET` | Monthly health report cron |

## Google sign-in checklist

1. Supabase → Auth → Providers → Google: enabled with the Google OAuth client ID/secret.
2. Google Cloud OAuth client → Authorized redirect URI: `https://<project>.supabase.co/auth/v1/callback`.
3. Supabase → Auth → URL Configuration: Site URL = the live URL, Redirect URLs include `<live URL>/auth/callback`.
4. Run the SQL files in `supabase/migrations/` in order (004 creates user rows on sign-up).

## Where things live

- `lib/cards.ts`: card database (fees, earn rates, bonuses, credits)
- `lib/currencies.ts`: point valuations
- `lib/engine.ts`: routing and optimizer
- `lib/brand.tsx`: logo mark used for the UI, favicons and share image
