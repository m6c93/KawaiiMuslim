-- Kawaii Muslim — Atelier des Petits Artistes
-- Galerie privée : visible uniquement par l'enfant et son parent.

begin;

create table if not exists public.child_artworks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  child_profile_id uuid not null references public.child_profiles(id) on delete cascade,
  title text not null default 'Mon coloriage' check (char_length(title) between 1 and 160),
  source_url text not null default '',
  kind text not null default 'digital' check (kind in ('digital', 'paper')),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  drawing_data jsonb not null default '{"strokes":[]}'::jsonb,
  image_path text not null default '',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists child_artworks_family_index
  on public.child_artworks (owner_id, child_profile_id, updated_at desc);

create unique index if not exists child_artworks_one_draft_per_source
  on public.child_artworks (child_profile_id, source_url)
  where status = 'in_progress' and source_url <> '';

drop trigger if exists child_artworks_touch_updated_at on public.child_artworks;
create trigger child_artworks_touch_updated_at
  before update on public.child_artworks
  for each row execute procedure public.touch_updated_at();

alter table public.child_artworks enable row level security;

drop policy if exists "artworks_family_only" on public.child_artworks;
create policy "artworks_family_only"
  on public.child_artworks for all
  to authenticated
  using (
    owner_id = auth.uid()
    and exists (
      select 1 from public.child_profiles
      where id = child_profile_id and parent_id = auth.uid()
    )
  )
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.child_profiles
      where id = child_profile_id and parent_id = auth.uid()
    )
  );

revoke all on public.child_artworks from anon, authenticated;
grant select, insert, update, delete on public.child_artworks to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'child-artworks',
  'child-artworks',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "artworks_storage_family_read" on storage.objects;
create policy "artworks_storage_family_read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'child-artworks'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "artworks_storage_family_insert" on storage.objects;
create policy "artworks_storage_family_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'child-artworks'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "artworks_storage_family_update" on storage.objects;
create policy "artworks_storage_family_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'child-artworks'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'child-artworks'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "artworks_storage_family_delete" on storage.objects;
create policy "artworks_storage_family_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'child-artworks'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

commit;
