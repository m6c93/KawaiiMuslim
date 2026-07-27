-- Kawaii Muslim — comptes parents, profils enfants et administration
-- À exécuter une seule fois dans l’éditeur SQL du projet Supabase.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  avatar text not null default '🌸',
  role text not null default 'parent' check (role in ('parent', 'admin')),
  plan text not null default 'gratuit' check (plan in ('gratuit', 'mensuel', 'annuel')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.child_profiles (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  avatar text not null default '🐤',
  age_group text not null default '6-8' check (age_group in ('3-5', '6-8', '9-12', '13+')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.planner_days (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  child_profile_id uuid references public.child_profiles(id) on delete cascade,
  day date not null,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists planner_parent_day_unique
  on public.planner_days (owner_id, day)
  where child_profile_id is null;

create unique index if not exists planner_child_day_unique
  on public.planner_days (owner_id, child_profile_id, day)
  where child_profile_id is not null;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid() and role = 'admin' and is_active = true
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute procedure public.touch_updated_at();

drop trigger if exists children_touch_updated_at on public.child_profiles;
create trigger children_touch_updated_at
  before update on public.child_profiles
  for each row execute procedure public.touch_updated_at();

drop trigger if exists planner_touch_updated_at on public.planner_days;
create trigger planner_touch_updated_at
  before update on public.planner_days
  for each row execute procedure public.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.child_profiles enable row level security;
alter table public.planner_days enable row level security;

drop policy if exists "profile_read_own_or_admin" on public.profiles;
create policy "profile_read_own_or_admin"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists "profile_update_own" on public.profiles;
create policy "profile_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid() and is_active = true)
  with check (id = auth.uid() and is_active = true);

drop policy if exists "children_read_family_or_admin" on public.child_profiles;
create policy "children_read_family_or_admin"
  on public.child_profiles for select
  to authenticated
  using (parent_id = auth.uid() or public.is_admin());

drop policy if exists "children_create_by_parent" on public.child_profiles;
create policy "children_create_by_parent"
  on public.child_profiles for insert
  to authenticated
  with check (parent_id = auth.uid());

drop policy if exists "children_update_by_parent_or_admin" on public.child_profiles;
create policy "children_update_by_parent_or_admin"
  on public.child_profiles for update
  to authenticated
  using (parent_id = auth.uid() or public.is_admin())
  with check (parent_id = auth.uid() or public.is_admin());

drop policy if exists "children_delete_by_parent_or_admin" on public.child_profiles;
create policy "children_delete_by_parent_or_admin"
  on public.child_profiles for delete
  to authenticated
  using (parent_id = auth.uid() or public.is_admin());

drop policy if exists "planner_family_or_admin" on public.planner_days;
create policy "planner_family_or_admin"
  on public.planner_days for all
  to authenticated
  using (owner_id = auth.uid() or public.is_admin())
  with check (
    owner_id = auth.uid()
    and (
      child_profile_id is null
      or exists (
        select 1 from public.child_profiles
        where id = child_profile_id and parent_id = auth.uid()
      )
    )
  );

-- Les comptes ordinaires ne peuvent jamais modifier leur rôle ni leur statut.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, avatar) on public.profiles to authenticated;

revoke all on public.child_profiles from anon, authenticated;
grant select, insert, update, delete on public.child_profiles to authenticated;

revoke all on public.planner_days from anon, authenticated;
grant select, insert, update, delete on public.planner_days to authenticated;

create or replace function public.admin_set_user_status(target_user uuid, enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Accès administrateur requis';
  end if;
  if target_user = auth.uid() and enabled = false then
    raise exception 'Impossible de désactiver son propre compte administrateur';
  end if;
  update public.profiles set is_active = enabled where id = target_user;
end;
$$;

create or replace function public.admin_set_user_role(target_user uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Accès administrateur requis';
  end if;
  if new_role not in ('parent', 'admin') then
    raise exception 'Rôle invalide';
  end if;
  if target_user = auth.uid() and new_role <> 'admin' then
    raise exception 'Impossible de retirer son propre rôle administrateur';
  end if;
  update public.profiles set role = new_role where id = target_user;
end;
$$;

revoke all on function public.admin_set_user_status(uuid, boolean) from public;
revoke all on function public.admin_set_user_status(uuid, boolean) from anon;
grant execute on function public.admin_set_user_status(uuid, boolean) to authenticated;
revoke all on function public.admin_set_user_role(uuid, text) from public;
revoke all on function public.admin_set_user_role(uuid, text) from anon;
grant execute on function public.admin_set_user_role(uuid, text) to authenticated;

-- Les fonctions utilisées uniquement par les triggers ne sont jamais exposées
-- aux visiteurs ni aux membres connectés.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;

-- Cette vérification est nécessaire aux politiques RLS, mais pas aux visiteurs.
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Après avoir créé ton propre compte sur le site, remplace l’adresse ci-dessous
-- puis exécute uniquement ces deux lignes pour activer ton tableau de bord :
--
-- update public.profiles
-- set role = 'admin'
-- where email = 'TON-ADRESSE-ADMIN@EXEMPLE.COM';
