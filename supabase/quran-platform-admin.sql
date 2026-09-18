-- Kawaii Muslim Coran — structures, licences et accès
-- À exécuter après supabase/admin-professional.sql.

begin;

create table if not exists public.quran_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 160),
  city text not null default '',
  contact_name text not null default '',
  contact_email text not null default '',
  status text not null default 'trial' check (status in ('trial','active','suspended','closed')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quran_licenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.quran_organizations(id) on delete cascade,
  plan text not null default 'class' check (plan in ('class','school','association')),
  student_limit integer not null default 20 check (student_limit between 1 and 10000),
  starts_at date not null default current_date,
  expires_at date not null,
  status text not null default 'trial' check (status in ('trial','active','suspended','expired')),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.quran_organization_members (
  organization_id uuid not null references public.quran_organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner','manager','teacher')),
  is_active boolean not null default true,
  joined_at timestamptz not null default now(),
  primary key (organization_id, profile_id)
);

create table if not exists public.quran_platform_classes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.quran_organizations(id) on delete cascade,
  teacher_id uuid references public.profiles(id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  school_year text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quran_platform_students (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.quran_organizations(id) on delete cascade,
  class_id uuid not null references public.quran_platform_classes(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  display_name text not null check (char_length(display_name) between 1 and 80),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.quran_access_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.quran_organizations(id) on delete cascade,
  email text not null,
  display_name text not null default '',
  role text not null check (role in ('owner','manager','teacher','student')),
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  expires_at timestamptz not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create index if not exists quran_members_profile_idx on public.quran_organization_members(profile_id);
create index if not exists quran_classes_org_idx on public.quran_platform_classes(organization_id);
create index if not exists quran_students_class_idx on public.quran_platform_students(class_id);
create index if not exists quran_invites_org_idx on public.quran_access_invitations(organization_id);

drop trigger if exists quran_organizations_touch on public.quran_organizations;
create trigger quran_organizations_touch before update on public.quran_organizations
for each row execute procedure public.touch_updated_at();
drop trigger if exists quran_licenses_touch on public.quran_licenses;
create trigger quran_licenses_touch before update on public.quran_licenses
for each row execute procedure public.touch_updated_at();
drop trigger if exists quran_classes_touch on public.quran_platform_classes;
create trigger quran_classes_touch before update on public.quran_platform_classes
for each row execute procedure public.touch_updated_at();

alter table public.quran_organizations enable row level security;
alter table public.quran_licenses enable row level security;
alter table public.quran_organization_members enable row level security;
alter table public.quran_platform_classes enable row level security;
alter table public.quran_platform_students enable row level security;
alter table public.quran_access_invitations enable row level security;

create or replace function public.is_quran_org_member(target_organization uuid)
returns boolean language sql stable security definer set search_path=public
as $$ select exists (select 1 from public.quran_organization_members where organization_id=target_organization and profile_id=auth.uid() and is_active) $$;

create or replace function public.is_quran_org_manager(target_organization uuid)
returns boolean language sql stable security definer set search_path=public
as $$ select exists (select 1 from public.quran_organization_members where organization_id=target_organization and profile_id=auth.uid() and role in ('owner','manager') and is_active) $$;
-- Le super-administrateur pilote tout. Les membres ne voient que leur structure.
drop policy if exists "quran_org_admin_all" on public.quran_organizations;
create policy "quran_org_admin_all" on public.quran_organizations for all to authenticated
using (public.is_admin()) with check (public.is_admin());
drop policy if exists "quran_org_member_read" on public.quran_organizations;
create policy "quran_org_member_read" on public.quran_organizations for select to authenticated
using (public.is_quran_org_member(id));

drop policy if exists "quran_license_admin_all" on public.quran_licenses;
create policy "quran_license_admin_all" on public.quran_licenses for all to authenticated
using (public.is_admin()) with check (public.is_admin());
drop policy if exists "quran_license_member_read" on public.quran_licenses;
create policy "quran_license_member_read" on public.quran_licenses for select to authenticated
using (public.is_quran_org_member(quran_licenses.organization_id));

drop policy if exists "quran_members_admin_all" on public.quran_organization_members;
create policy "quran_members_admin_all" on public.quran_organization_members for all to authenticated
using (public.is_admin()) with check (public.is_admin());
drop policy if exists "quran_members_org_read" on public.quran_organization_members;
create policy "quran_members_org_read" on public.quran_organization_members for select to authenticated
using (profile_id=auth.uid() or public.is_quran_org_manager(quran_organization_members.organization_id));

drop policy if exists "quran_classes_admin_all" on public.quran_platform_classes;
create policy "quran_classes_admin_all" on public.quran_platform_classes for all to authenticated
using (public.is_admin()) with check (public.is_admin());
drop policy if exists "quran_classes_member_read" on public.quran_platform_classes;
create policy "quran_classes_member_read" on public.quran_platform_classes for select to authenticated
using (public.is_quran_org_member(quran_platform_classes.organization_id));

drop policy if exists "quran_students_admin_all" on public.quran_platform_students;
create policy "quran_students_admin_all" on public.quran_platform_students for all to authenticated
using (public.is_admin()) with check (public.is_admin());
drop policy if exists "quran_students_member_read" on public.quran_platform_students;
create policy "quran_students_member_read" on public.quran_platform_students for select to authenticated
using (public.is_quran_org_member(quran_platform_students.organization_id));

drop policy if exists "quran_invites_admin_all" on public.quran_access_invitations;
create policy "quran_invites_admin_all" on public.quran_access_invitations for all to authenticated
using (public.is_admin()) with check (public.is_admin());

grant select,insert,update,delete on public.quran_organizations to authenticated;
grant select,insert,update,delete on public.quran_licenses to authenticated;
grant select,insert,update,delete on public.quran_organization_members to authenticated;
grant select,insert,update,delete on public.quran_platform_classes to authenticated;
grant select,insert,update,delete on public.quran_platform_students to authenticated;
grant select,insert,update,delete on public.quran_access_invitations to authenticated;

commit;
