-- ============================================================
-- MyCreditCardinal — Wallet Health Reports
-- ============================================================

-- One report per user per month
create table public.health_reports (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  month        text not null,    -- e.g. "2025-01"
  -- JSON blob with the full report content
  content_json jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  unique (user_id, month)
);

create index on public.health_reports (user_id, month desc);

-- RLS
alter table public.health_reports enable row level security;

create policy "Users can view their own health reports"
  on public.health_reports for select
  using (auth.uid() = user_id);

-- Service role can insert/update (used by cron job)
create policy "Service role can manage health reports"
  on public.health_reports for all
  using (true)
  with check (true);
