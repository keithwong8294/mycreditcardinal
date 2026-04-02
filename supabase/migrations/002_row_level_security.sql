-- ============================================================
-- MyCreditCardinal — Row-Level Security Policies
-- ============================================================
-- All tables: users can only read/write their own data.
-- The cards table is publicly readable (card database).
-- Admin operations on cards are handled via service_role key server-side.
-- ============================================================

-- ── Enable RLS on all user-data tables ───────────────────────────────────────

alter table public.users              enable row level security;
alter table public.households         enable row level security;
alter table public.household_members  enable row level security;
alter table public.wallet_cards       enable row level security;
alter table public.custom_cards       enable row level security;
alter table public.sub_earned         enable row level security;
alter table public.spend_profiles     enable row level security;
alter table public.valuations         enable row level security;
-- cards table: public read, no RLS needed for reads; writes restricted below
alter table public.cards              enable row level security;

-- ── users ─────────────────────────────────────────────────────────────────────

create policy "Users can view own record"
  on public.users for select
  using (auth.uid() = id);

create policy "Users can update own record"
  on public.users for update
  using (auth.uid() = id);

-- Insert is handled by the server-side signup trigger (service_role), not the client.

-- ── households ───────────────────────────────────────────────────────────────

create policy "Users can manage own households"
  on public.households for all
  using (auth.uid() = user_id);

-- ── household_members ─────────────────────────────────────────────────────────

create policy "Users can manage members in own households"
  on public.household_members for all
  using (
    exists (
      select 1 from public.households h
      where h.id = household_members.household_id
        and h.user_id = auth.uid()
    )
  );

-- ── wallet_cards ──────────────────────────────────────────────────────────────

create policy "Users can manage own wallet cards"
  on public.wallet_cards for all
  using (
    exists (
      select 1
      from public.household_members hm
      join public.households h on h.id = hm.household_id
      where hm.id = wallet_cards.member_id
        and h.user_id = auth.uid()
    )
  );

-- ── custom_cards ──────────────────────────────────────────────────────────────

create policy "Users can manage own custom cards"
  on public.custom_cards for all
  using (auth.uid() = user_id);

-- ── sub_earned ────────────────────────────────────────────────────────────────

create policy "Users can manage own SUB records"
  on public.sub_earned for all
  using (
    exists (
      select 1
      from public.wallet_cards wc
      join public.household_members hm on hm.id = wc.member_id
      join public.households h on h.id = hm.household_id
      where wc.id = sub_earned.wallet_card_id
        and h.user_id = auth.uid()
    )
  );

-- ── spend_profiles ────────────────────────────────────────────────────────────

create policy "Users can manage own spend profiles"
  on public.spend_profiles for all
  using (auth.uid() = user_id);

-- ── cards (public card database) ─────────────────────────────────────────────

-- Everyone can read cards; only service_role (admin) can write
create policy "Anyone can read cards"
  on public.cards for select
  using (true);

-- ── valuations (public read) ─────────────────────────────────────────────────

create policy "Anyone can read valuations"
  on public.valuations for select
  using (true);
