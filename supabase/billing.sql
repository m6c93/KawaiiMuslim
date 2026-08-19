-- Kawaii Muslim World — abonnements Stripe
-- À exécuter dans Supabase avant de déployer les trois fonctions Edge.

create table if not exists public.subscriptions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  price_id text,
  plan_code text not null default 'family_1_child'
    check (plan_code in ('family_1_child', 'family_2_children', 'family_3_children')),
  child_limit smallint not null default 1 check (child_limit between 1 and 3),
  status text not null default 'incomplete',
  cancel_at_period_end boolean not null default false,
  current_period_start timestamptz,
  current_period_end timestamptz,
  payment_failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

drop policy if exists "subscription_read_own" on public.subscriptions;
create policy "subscription_read_own"
  on public.subscriptions for select
  to authenticated
  using (user_id = auth.uid());

revoke all on public.subscriptions from anon, authenticated;
grant select on public.subscriptions to authenticated;

create or replace function public.enforce_child_profile_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed_children integer := 1;
  existing_children integer := 0;
begin
  select coalesce(max(child_limit), 1)
    into allowed_children
  from public.subscriptions
  where user_id = new.parent_id
    and status in ('active', 'trialing', 'past_due');

  select count(*) into existing_children
  from public.child_profiles
  where parent_id = new.parent_id
    and id is distinct from new.id;

  if existing_children >= allowed_children then
    raise exception 'Cette offre permet au maximum % profil(s) enfant.', allowed_children;
  end if;
  return new;
end;
$$;

drop trigger if exists child_profiles_limit_before_insert on public.child_profiles;
create trigger child_profiles_limit_before_insert
  before insert on public.child_profiles
  for each row execute procedure public.enforce_child_profile_limit();

revoke all on function public.enforce_child_profile_limit() from public, anon, authenticated;
