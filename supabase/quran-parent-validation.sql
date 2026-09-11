-- Mon Coran — progression enfant et validation parentale des sourates

create table if not exists public.quran_verse_progress (
  child_profile_id uuid not null references public.child_profiles(id) on delete cascade,
  parent_id uuid not null references public.profiles(id) on delete cascade,
  surah integer not null check (surah between 1 and 114),
  verse integer not null check (verse > 0),
  practiced_at timestamptz not null default now(),
  primary key (child_profile_id, surah, verse)
);

create table if not exists public.quran_surah_validations (
  child_profile_id uuid not null references public.child_profiles(id) on delete cascade,
  parent_id uuid not null references public.profiles(id) on delete cascade,
  surah integer not null check (surah between 1 and 114),
  validated_at timestamptz not null default now(),
  primary key (child_profile_id, surah)
);

alter table public.quran_verse_progress enable row level security;
alter table public.quran_surah_validations enable row level security;

drop policy if exists "quran_progress_family" on public.quran_verse_progress;
create policy "quran_progress_family" on public.quran_verse_progress for all to authenticated
  using (parent_id = auth.uid())
  with check (parent_id = auth.uid() and exists (
    select 1 from public.child_profiles child
    where child.id = child_profile_id and child.parent_id = auth.uid()
  ));

drop policy if exists "quran_validations_family" on public.quran_surah_validations;
create policy "quran_validations_family" on public.quran_surah_validations for all to authenticated
  using (parent_id = auth.uid())
  with check (parent_id = auth.uid() and exists (
    select 1 from public.child_profiles child
    where child.id = child_profile_id and child.parent_id = auth.uid()
  ));

grant select, insert, update, delete on public.quran_verse_progress to authenticated;
grant select, insert, update, delete on public.quran_surah_validations to authenticated;

