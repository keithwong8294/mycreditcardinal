-- ============================================================
-- 004 — Fix first sign-in (Google OAuth / magic link)
--
-- Problem: public.users has RLS enabled but no INSERT policy, and the
-- "signup trigger" referenced in 002 was never created. New users therefore
-- authenticated successfully but never got a users/household row, which broke
-- sync, plan checks and Stripe.
--
-- Fix: a SECURITY DEFINER trigger on auth.users creates the rows, plus a
-- backfill for accounts that already signed in. Also stops clients from
-- editing their own plan.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  display_name text;
  hh_id uuid;
begin
  display_name := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    split_part(new.email, '@', 1),
    'You'
  );

  insert into public.users (id, email, name, plan, trial_ends_at)
  values (new.id, coalesce(new.email, new.id::text || '@users.noreply'), display_name,
          'trial', now() + interval '30 days')
  on conflict do nothing;

  if exists (select 1 from public.users where id = new.id)
     and not exists (select 1 from public.households where user_id = new.id) then
    insert into public.households (user_id, name)
    values (new.id, display_name || '''s Wallet')
    returning id into hh_id;

    insert into public.household_members (household_id, name, sort_order)
    values (hh_id, display_name, 0);
  end if;

  return new;
exception when others then
  -- Never block authentication because of app-side bookkeeping.
  raise warning 'handle_new_user failed for %: %', new.id, sqlerrm;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill users who signed in before this migration.
insert into public.users (id, email, name, plan, trial_ends_at)
select au.id,
       coalesce(au.email, au.id::text || '@users.noreply'),
       coalesce(au.raw_user_meta_data ->> 'full_name', au.raw_user_meta_data ->> 'name', split_part(au.email, '@', 1), 'You'),
       'trial',
       now() + interval '30 days'
from auth.users au
on conflict do nothing;

with missing as (
  select u.id, u.name from public.users u
  where not exists (select 1 from public.households h where h.user_id = u.id)
), new_hh as (
  insert into public.households (user_id, name)
  select id, coalesce(name, 'My') || '''s Wallet' from missing
  returning id, user_id
)
insert into public.household_members (household_id, name, sort_order)
select nh.id, coalesce(m.name, 'You'), 0
from new_hh nh join missing m on m.id = nh.user_id;

-- Users may only change their display name / Stripe customer id themselves;
-- plan and trial changes go through the service role (Stripe webhook).
revoke update on public.users from authenticated, anon;
grant update (name, stripe_customer_id) on public.users to authenticated;
