-- ============================================================
-- 005 — Card requests
--
-- Visitors (signed in or guest) can ask for a card that isn't in the catalog.
-- Rows are written and read only by the server with the service-role key, so
-- RLS is on with no public policies.
-- ============================================================

create table if not exists public.card_requests (
  id          uuid primary key default gen_random_uuid(),
  card_name   text not null check (char_length(card_name) between 2 and 120),
  issuer      text not null check (char_length(issuer) between 1 and 80),
  annual_fee  numeric(7, 2) check (annual_fee is null or annual_fee >= 0),
  earn_rates  text check (char_length(earn_rates) <= 1000),
  link        text check (char_length(link) <= 500),
  notes       text check (char_length(notes) <= 1000),
  email       text check (char_length(email) <= 200),
  user_id     uuid references auth.users(id) on delete set null,
  sandbox     boolean not null default false,
  client_hash text,
  status      text not null default 'new' check (status in ('new', 'added', 'dismissed')),
  created_at  timestamptz not null default now()
);

create index if not exists card_requests_created_idx on public.card_requests (created_at desc);
create index if not exists card_requests_client_idx on public.card_requests (client_hash, created_at desc);

alter table public.card_requests enable row level security;
