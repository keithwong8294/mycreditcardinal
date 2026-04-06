-- ============================================================
-- MyCreditCardinal — Per-member spend profiles
-- ============================================================
-- Adds member_id to spend_profiles so each household member can
-- have their own independent spending amounts.

alter table public.spend_profiles
  add column if not exists member_id uuid references public.household_members(id) on delete cascade;

create index if not exists spend_profiles_member_id_idx on public.spend_profiles (member_id);
