-- ============================================================
-- MyCreditCardinal — Initial Schema
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ── Users ─────────────────────────────────────────────────────────────────────

create type plan_type as enum ('trial', 'free', 'pro');

create table public.users (
  id                  uuid primary key default gen_random_uuid(),
  email               text unique not null,
  name                text,
  plan                plan_type not null default 'trial',
  trial_ends_at       timestamptz,
  device_fingerprint  text,
  stripe_customer_id  text,
  created_at          timestamptz not null default now()
);

-- ── Households ────────────────────────────────────────────────────────────────

create table public.households (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name    text not null
);

create table public.household_members (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name         text not null,
  sort_order   int  not null default 0
);

-- ── Wallet cards ──────────────────────────────────────────────────────────────

create table public.wallet_cards (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.household_members(id) on delete cascade,
  card_id     text not null,
  -- config_json example: { "rotQ": ["groceries", null, "dining", null], "custom": ["gas"] }
  config_json jsonb not null default '{}'::jsonb
);

-- ── Card database (admin-managed) ─────────────────────────────────────────────

create table public.cards (
  id              text primary key,
  name            text not null,
  issuer          text not null,
  network         text not null,
  currency        text not null,
  fee             int  not null default 0,
  earn_json       jsonb not null default '{}'::jsonb,
  caps_json       jsonb not null default '{}'::jsonb,
  sub_json        jsonb,
  sub_hi_json     jsonb,
  score           int  not null default 0,
  perks_json      jsonb not null default '[]'::jsonb,
  color_json      jsonb not null default '[]'::jsonb,
  rotating        boolean not null default false,
  rot_cap         int,
  rot_opts        jsonb,
  custom_select   boolean not null default false,
  custom_max      int,
  custom_rate     numeric,
  custom_opts     jsonb,
  fico_min        int,
  status          text not null default 'active'
);

-- ── User-created custom cards ─────────────────────────────────────────────────

create table public.custom_cards (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  name            text not null,
  issuer          text not null,
  network         text not null,
  currency        text not null,
  fee             int  not null default 0,
  earn_json       jsonb not null default '{}'::jsonb,
  caps_json       jsonb not null default '{}'::jsonb,
  sub_json        jsonb,
  score           int  not null default 0,
  perks_json      jsonb not null default '[]'::jsonb,
  color_json      jsonb not null default '[]'::jsonb,
  rotating        boolean not null default false,
  rot_cap         int,
  rot_opts        jsonb,
  custom_select   boolean not null default false,
  custom_max      int,
  custom_rate     numeric,
  custom_opts     jsonb,
  status          text not null default 'active'
);

-- ── SUB tracking ──────────────────────────────────────────────────────────────

create table public.sub_earned (
  id             uuid primary key default gen_random_uuid(),
  wallet_card_id uuid not null references public.wallet_cards(id) on delete cascade,
  earned_at      timestamptz not null default now()
);

-- ── Spend profiles ────────────────────────────────────────────────────────────

create table public.spend_profiles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  name        text not null,
  -- spend_json: { "dining": 300, "groceries": 500, ... }
  spend_json  jsonb not null default '{}'::jsonb,
  is_default  boolean not null default false
);

-- ── Valuation data ────────────────────────────────────────────────────────────

create table public.valuations (
  id          uuid primary key default gen_random_uuid(),
  currency    text not null,
  month       text not null,       -- e.g. "2025-01"
  source      text not null,       -- e.g. "tpg", "nerdwallet"
  value_cents numeric not null,    -- e.g. 200 = 2.00¢
  unique (currency, month, source)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

create index on public.households (user_id);
create index on public.household_members (household_id);
create index on public.wallet_cards (member_id);
create index on public.sub_earned (wallet_card_id);
create index on public.spend_profiles (user_id);
create index on public.custom_cards (user_id);
create index on public.valuations (currency, month);
