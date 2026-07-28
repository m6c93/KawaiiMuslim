-- Kawaii Muslim — double identification obligatoire pour toute l'équipe
-- À exécuter après supabase/admin-professional.sql

begin;

create or replace function public.has_staff_aal2()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_staff_aal2() and exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_active = true
  );
$$;

create or replace function public.can_manage_families()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_staff_aal2() and exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('admin', 'support')
      and is_active = true
  );
$$;

create or replace function public.can_manage_content()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_staff_aal2() and exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('admin', 'content_admin')
      and is_active = true
  );
$$;

create or replace function public.can_manage_support()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_staff_aal2() and exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('admin', 'support')
      and is_active = true
  );
$$;

drop policy if exists "audit_read_admin_or_own" on public.admin_audit_logs;
create policy "audit_read_admin_or_own"
  on public.admin_audit_logs for select
  to authenticated
  using (
    public.is_admin()
    or (public.has_staff_aal2() and actor_id = auth.uid())
  );

revoke all on function public.has_staff_aal2() from public, anon;
grant execute on function public.has_staff_aal2() to authenticated;

commit;
