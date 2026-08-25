-- Kawaii Muslim — administration professionnelle
-- Migration réexécutable après supabase/schema.sql

begin;

-- Rôles séparés : admin = super-administrateur.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('parent', 'admin', 'content_admin', 'support'));

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
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
  select exists (
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
  select exists (
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
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('admin', 'support')
      and is_active = true
  );
$$;

-- Les écrits intimes restent strictement privés, y compris pour l’administration.
drop policy if exists "planner_family_or_admin" on public.planner_days;
drop policy if exists "planner_owner_only" on public.planner_days;
create policy "planner_owner_only"
  on public.planner_days for all
  to authenticated
  using (owner_id = auth.uid())
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

drop policy if exists "profile_read_own_or_admin" on public.profiles;
drop policy if exists "profile_read_own_or_staff" on public.profiles;
create policy "profile_read_own_or_staff"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.can_manage_families());

drop policy if exists "children_read_family_or_admin" on public.child_profiles;
drop policy if exists "children_read_family_or_staff" on public.child_profiles;
drop policy if exists "children_read_own_family" on public.child_profiles;
create policy "children_read_own_family"
  on public.child_profiles for select
  to authenticated
  using (parent_id = auth.uid());

drop policy if exists "children_update_by_parent_or_admin" on public.child_profiles;
drop policy if exists "children_update_by_parent" on public.child_profiles;
create policy "children_update_by_parent"
  on public.child_profiles for update
  to authenticated
  using (parent_id = auth.uid())
  with check (parent_id = auth.uid());

drop policy if exists "children_delete_by_parent_or_admin" on public.child_profiles;
drop policy if exists "children_delete_by_parent" on public.child_profiles;
create policy "children_delete_by_parent"
  on public.child_profiles for delete
  to authenticated
  using (parent_id = auth.uid());

create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (char_length(slug) between 2 and 120),
  title text not null check (char_length(title) between 1 and 160),
  description text not null default '',
  content_type text not null default 'livre'
    check (content_type in ('livre', 'coloriage', 'quiz', 'audio', 'planner', 'activite')),
  audience text not null default 'famille'
    check (audience in ('maman', 'enfant', 'famille')),
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  url text not null default '',
  cover_url text not null default '',
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null check (char_length(subject) between 3 and 160),
  category text not null default 'autre'
    check (category in ('compte', 'abonnement', 'contenu', 'technique', 'confidentialite', 'autre')),
  message text not null check (char_length(message) between 5 and 3000),
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'waiting_user', 'resolved', 'closed')),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  staff_note text not null default '',
  assigned_to uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  key text primary key check (char_length(key) between 2 and 80),
  value text not null default '',
  description text not null default '',
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_audit_logs (
  id bigint generated by default as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

drop trigger if exists content_touch_updated_at on public.content_items;
create trigger content_touch_updated_at
  before update on public.content_items
  for each row execute procedure public.touch_updated_at();

drop trigger if exists tickets_touch_updated_at on public.support_tickets;
create trigger tickets_touch_updated_at
  before update on public.support_tickets
  for each row execute procedure public.touch_updated_at();

alter table public.content_items enable row level security;
alter table public.support_tickets enable row level security;
alter table public.site_settings enable row level security;
alter table public.admin_audit_logs enable row level security;

drop policy if exists "content_read_published_or_staff" on public.content_items;
create policy "content_read_published_or_staff"
  on public.content_items for select
  to authenticated
  using (status = 'published' or public.can_manage_content());

drop policy if exists "content_manage_staff" on public.content_items;
create policy "content_manage_staff"
  on public.content_items for all
  to authenticated
  using (public.can_manage_content())
  with check (public.can_manage_content());

drop policy if exists "tickets_create_own" on public.support_tickets;
create policy "tickets_create_own"
  on public.support_tickets for insert
  to authenticated
  with check (requester_id = auth.uid());

drop policy if exists "tickets_read_own_or_staff" on public.support_tickets;
create policy "tickets_read_own_or_staff"
  on public.support_tickets for select
  to authenticated
  using (requester_id = auth.uid() or public.can_manage_support());

drop policy if exists "tickets_update_staff" on public.support_tickets;
create policy "tickets_update_staff"
  on public.support_tickets for update
  to authenticated
  using (public.can_manage_support())
  with check (public.can_manage_support());

drop policy if exists "settings_read_members" on public.site_settings;
create policy "settings_read_members"
  on public.site_settings for select
  to authenticated
  using (true);

drop policy if exists "settings_manage_content_staff" on public.site_settings;
create policy "settings_manage_content_staff"
  on public.site_settings for all
  to authenticated
  using (public.can_manage_content())
  with check (public.can_manage_content());

drop policy if exists "audit_read_admin_or_own" on public.admin_audit_logs;
create policy "audit_read_admin_or_own"
  on public.admin_audit_logs for select
  to authenticated
  using (public.is_admin() or actor_id = auth.uid());

revoke all on public.content_items from anon, authenticated;
grant select, insert, update, delete on public.content_items to authenticated;
revoke all on public.support_tickets from anon, authenticated;
grant select, insert, update on public.support_tickets to authenticated;
revoke all on public.site_settings from anon, authenticated;
grant select, insert, update, delete on public.site_settings to authenticated;
revoke all on public.admin_audit_logs from anon, authenticated;
grant select on public.admin_audit_logs to authenticated;

create or replace function public.write_admin_log(
  log_action text,
  log_target_type text,
  log_target_id text default null,
  log_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.admin_audit_logs (actor_id, action, target_type, target_id, details)
  values (auth.uid(), log_action, log_target_type, log_target_id, coalesce(log_details, '{}'::jsonb));
end;
$$;

create or replace function public.audit_managed_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  object_id text;
begin
  object_id := coalesce(
    case when tg_op = 'DELETE' then old.id::text else new.id::text end,
    ''
  );
  perform public.write_admin_log(
    lower(tg_op) || '_' || tg_table_name,
    tg_table_name,
    object_id,
    jsonb_build_object('operation', tg_op)
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists audit_content_changes on public.content_items;
create trigger audit_content_changes
  after insert or update or delete on public.content_items
  for each row execute procedure public.audit_managed_change();

create or replace function public.audit_setting_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.write_admin_log(
    'update_setting',
    'site_setting',
    new.key,
    jsonb_build_object('key', new.key)
  );
  return new;
end;
$$;

drop trigger if exists audit_setting_changes on public.site_settings;
create trigger audit_setting_changes
  after insert or update on public.site_settings
  for each row execute procedure public.audit_setting_change();

create or replace function public.staff_log_export(export_type text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (
    public.can_manage_families()
    or public.can_manage_content()
    or public.can_manage_support()
  ) then
    raise exception 'Accès équipe requis';
  end if;
  perform public.write_admin_log(
    'export_data',
    'export',
    left(coalesce(export_type, 'unknown'), 80)
  );
end;
$$;

create or replace function public.staff_list_families()
returns table (
  id uuid,
  email text,
  full_name text,
  avatar text,
  role text,
  plan text,
  is_active boolean,
  created_at timestamptz,
  children_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_manage_families() then
    raise exception 'Accès équipe requis';
  end if;
  return query
    select p.id, p.email, p.full_name, p.avatar, p.role, p.plan,
      p.is_active, p.created_at, count(c.id)
    from public.profiles p
    left join public.child_profiles c on c.parent_id = p.id
    group by p.id
    order by p.created_at desc;
end;
$$;

create or replace function public.admin_set_user_status(target_user uuid, enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_manage_families() then
    raise exception 'Accès équipe requis';
  end if;
  if target_user = auth.uid() and enabled = false then
    raise exception 'Impossible de désactiver son propre compte';
  end if;
  update public.profiles set is_active = enabled where id = target_user;
  perform public.write_admin_log(
    case when enabled then 'reactivate_account' else 'deactivate_account' end,
    'profile',
    target_user::text
  );
end;
$$;

create or replace function public.admin_set_user_plan(target_user uuid, new_plan text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_manage_families() then
    raise exception 'Accès équipe requis';
  end if;
  if new_plan not in ('gratuit', 'mensuel', 'annuel') then
    raise exception 'Abonnement invalide';
  end if;
  update public.profiles set plan = new_plan where id = target_user;
  perform public.write_admin_log(
    'change_plan', 'profile', target_user::text,
    jsonb_build_object('plan', new_plan)
  );
end;
$$;

create or replace function public.admin_set_user_role(target_user uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_role text;
  admin_count integer;
begin
  if not public.is_admin() then
    raise exception 'Accès super-administrateur requis';
  end if;
  if new_role not in ('parent', 'admin', 'content_admin', 'support') then
    raise exception 'Rôle invalide';
  end if;

  select role into current_role from public.profiles where id = target_user;
  if target_user = auth.uid() and new_role <> 'admin' then
    raise exception 'Impossible de retirer son propre rôle administrateur';
  end if;
  if current_role = 'admin' and new_role <> 'admin' then
    select count(*) into admin_count
    from public.profiles
    where role = 'admin' and is_active = true;
    if admin_count <= 1 then
      raise exception 'Impossible de retirer le dernier super-administrateur';
    end if;
  end if;

  update public.profiles set role = new_role where id = target_user;
  perform public.write_admin_log(
    'change_role', 'profile', target_user::text,
    jsonb_build_object('role', new_role)
  );
end;
$$;

create or replace function public.staff_update_ticket(
  target_ticket uuid,
  new_status text,
  new_priority text,
  new_note text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_manage_support() then
    raise exception 'Accès support requis';
  end if;
  if new_status not in ('open', 'in_progress', 'waiting_user', 'resolved', 'closed') then
    raise exception 'Statut invalide';
  end if;
  if new_priority not in ('low', 'normal', 'high', 'urgent') then
    raise exception 'Priorité invalide';
  end if;
  update public.support_tickets
  set status = new_status,
      priority = new_priority,
      staff_note = left(coalesce(new_note, ''), 3000),
      assigned_to = auth.uid()
  where id = target_ticket;
  perform public.write_admin_log(
    'update_ticket', 'support_ticket', target_ticket::text,
    jsonb_build_object('status', new_status, 'priority', new_priority)
  );
end;
$$;

insert into public.content_items
  (slug, title, description, content_type, audience, status, url, cover_url, sort_order)
values
  ('tawakkul', 'Tawakkul', 'La confiance en Allah', 'livre', 'famille', 'published', 'books/tawakkul.html', 'brand/assets/scene-tawakkul.png', 10),
  ('bubble-tea-time-hijabi', 'Bubble Tea Time Hijabi', 'Un goûter entre copines', 'livre', 'enfant', 'published', 'books/bubble-tea-time-hijabi.html', 'brand/assets/coloring-bubble-tea.png', 20),
  ('aya-armure-de-lumiere', 'Aya et l’Armure de Lumière', 'Une aventure de courage', 'livre', 'enfant', 'published', 'books/aya-armure-de-lumiere.html', 'brand/assets/coloring-armure-lumiere.png', 30),
  ('exploration-espace', 'Exploration de l’espace', 'Les planètes du système solaire', 'livre', 'enfant', 'published', 'books/exploration-espace.html', 'brand/assets/cover-exploration-espace.png', 40),
  ('hijabi-girls', 'Hijabi Girls', 'Nos héroïnes du quotidien', 'livre', 'enfant', 'published', 'books/hijabi-girls.html', 'brand/assets/cover-hijabi-girls.png', 50),
  ('aliments-coran', 'Les aliments dans le Coran', 'Découvrir les bienfaits de la création', 'livre', 'famille', 'published', 'books/aliments-dans-le-coran.html', 'brand/assets/cover-aliments-coran.png', 60),
  ('animaux-coran', 'Les animaux du Coran', 'À la rencontre des créatures d’Allah', 'livre', 'famille', 'published', 'books/animaux-du-coran.html', 'brand/assets/cover-animaux-coran.png', 70),
  ('vers-allah', 'Vers Allah', 'Le chemin de la foi', 'livre', 'famille', 'published', 'books/vers-allah.html', 'brand/assets/cover-vers-allah.png', 80),
  ('planner-cocon', 'Mon Planner Cocon', 'Le planner spirituel des mamans musulmanes', 'planner', 'maman', 'published', 'Safe Place.dc.html', '', 90)
on conflict (slug) do nothing;

insert into public.site_settings (key, value, description)
values
  ('support_email', 'mohamed6c@gmail.com', 'Adresse de contact affichée aux familles'),
  ('announcement', '', 'Message important affichable dans l’univers Kawaii Muslim')
on conflict (key) do nothing;

-- Couvertures envoyées depuis l’administration.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'content-covers',
  'content-covers',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "content_covers_staff_insert" on storage.objects;
create policy "content_covers_staff_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'content-covers'
    and public.can_manage_content()
  );

drop policy if exists "content_covers_staff_update" on storage.objects;
create policy "content_covers_staff_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'content-covers'
    and public.can_manage_content()
  )
  with check (
    bucket_id = 'content-covers'
    and public.can_manage_content()
  );

drop policy if exists "content_covers_staff_delete" on storage.objects;
create policy "content_covers_staff_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'content-covers'
    and public.can_manage_content()
  );

-- Livres PDF envoyés depuis l’administration.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'content-books',
  'content-books',
  false,
  52428800,
  array['application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "content_books_subscriber_read" on storage.objects;
create policy "content_books_subscriber_read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'content-books'
    and (
      public.can_manage_content()
      or exists (
        select 1
        from public.subscriptions subscription
        where subscription.user_id = auth.uid()
          and subscription.status in ('active', 'trialing', 'past_due')
      )
    )
  );

drop policy if exists "content_books_staff_insert" on storage.objects;
create policy "content_books_staff_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'content-books'
    and public.can_manage_content()
  );

drop policy if exists "content_books_staff_update" on storage.objects;
create policy "content_books_staff_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'content-books'
    and public.can_manage_content()
  )
  with check (
    bucket_id = 'content-books'
    and public.can_manage_content()
  );

drop policy if exists "content_books_staff_delete" on storage.objects;
create policy "content_books_staff_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'content-books'
    and public.can_manage_content()
  );

-- Coloriages imprimables envoyés depuis l’administration.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'content-colorings',
  'content-colorings',
  true,
  20971520,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "content_colorings_staff_insert" on storage.objects;
create policy "content_colorings_staff_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'content-colorings'
    and public.can_manage_content()
  );

drop policy if exists "content_colorings_staff_update" on storage.objects;
create policy "content_colorings_staff_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'content-colorings'
    and public.can_manage_content()
  )
  with check (
    bucket_id = 'content-colorings'
    and public.can_manage_content()
  );

drop policy if exists "content_colorings_staff_delete" on storage.objects;
create policy "content_colorings_staff_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'content-colorings'
    and public.can_manage_content()
  );

revoke all on function public.write_admin_log(text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.audit_managed_change() from public, anon, authenticated;
revoke all on function public.audit_setting_change() from public, anon, authenticated;
revoke all on function public.staff_log_export(text) from public, anon;
grant execute on function public.staff_log_export(text) to authenticated;
revoke all on function public.staff_list_families() from public, anon;
grant execute on function public.staff_list_families() to authenticated;
revoke all on function public.admin_set_user_status(uuid, boolean) from public, anon;
grant execute on function public.admin_set_user_status(uuid, boolean) to authenticated;
revoke all on function public.admin_set_user_plan(uuid, text) from public, anon;
grant execute on function public.admin_set_user_plan(uuid, text) to authenticated;
revoke all on function public.admin_set_user_role(uuid, text) from public, anon;
grant execute on function public.admin_set_user_role(uuid, text) to authenticated;
revoke all on function public.staff_update_ticket(uuid, text, text, text) from public, anon;
grant execute on function public.staff_update_ticket(uuid, text, text, text) to authenticated;
revoke all on function public.can_manage_families() from public, anon;
grant execute on function public.can_manage_families() to authenticated;
revoke all on function public.can_manage_content() from public, anon;
grant execute on function public.can_manage_content() to authenticated;
revoke all on function public.can_manage_support() from public, anon;
grant execute on function public.can_manage_support() to authenticated;

commit;
