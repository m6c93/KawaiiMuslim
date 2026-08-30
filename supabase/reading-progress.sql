-- Kawaii Muslim World — progression de lecture par profil enfant

create table if not exists public.reading_progress (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.profiles(id) on delete cascade,
  child_profile_id uuid not null references public.child_profiles(id) on delete cascade,
  book_slug text not null check (char_length(book_slug) between 1 and 120),
  book_title text not null default '' check (char_length(book_title) <= 180),
  position integer not null default 0 check (position >= 0),
  total_positions integer not null default 1 check (total_positions > 0),
  completed boolean not null default false,
  last_read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (child_profile_id, book_slug)
);

create index if not exists reading_progress_parent_updated_idx
  on public.reading_progress (parent_id, last_read_at desc);

alter table public.reading_progress enable row level security;

drop policy if exists "reading_progress_read_family" on public.reading_progress;
create policy "reading_progress_read_family"
  on public.reading_progress for select
  to authenticated
  using (parent_id = auth.uid());

drop policy if exists "reading_progress_create_family" on public.reading_progress;
create policy "reading_progress_create_family"
  on public.reading_progress for insert
  to authenticated
  with check (
    parent_id = auth.uid()
    and exists (
      select 1 from public.child_profiles child
      where child.id = child_profile_id and child.parent_id = auth.uid()
    )
  );

drop policy if exists "reading_progress_update_family" on public.reading_progress;
create policy "reading_progress_update_family"
  on public.reading_progress for update
  to authenticated
  using (parent_id = auth.uid())
  with check (
    parent_id = auth.uid()
    and exists (
      select 1 from public.child_profiles child
      where child.id = child_profile_id and child.parent_id = auth.uid()
    )
  );

drop policy if exists "reading_progress_delete_family" on public.reading_progress;
create policy "reading_progress_delete_family"
  on public.reading_progress for delete
  to authenticated
  using (parent_id = auth.uid());

grant select, insert, update, delete on public.reading_progress to authenticated;

