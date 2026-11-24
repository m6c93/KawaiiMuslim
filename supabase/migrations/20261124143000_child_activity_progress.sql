begin;

create function public.valid_child_activity_progress(progress_key text, state jsonb) returns boolean
language sql immutable strict set search_path = ''
as $$
  select (
    progress_key in (
      'kmw-salah-v1', 'kmw-salah-journal-v1', 'kmw-salah-session-v2',
      'kmw-salah-surahs-v1', 'kmw-salah-inline-position', 'kmw-salah-learn-position',
      'kmw-aya-chansons-v1', 'kmw-aya-premium-stamps',
      'kmw-weekly-dua-preview-v1', 'kmw-dua-sleep-ritual-v1'
    ) or progress_key ~ '^kmw-dua-sleep-week-[0-9]{13}$'
  ) and octet_length(state::text) <= 65536 and (
    state = 'null'::jsonb or
    case
      when progress_key like 'kmw-dua-sleep-week-%' then
        jsonb_typeof(state) = 'number' and state::text ~ '^(0|[1-9][0-9]{0,8})$'
      when progress_key = 'kmw-aya-chansons-v1' then
        jsonb_typeof(state) = 'array'
        and not jsonb_path_exists(state, '$[*] ? (@.type() != "number" || @ < 0 || @ != @.floor())')
      when progress_key in ('kmw-aya-premium-stamps', 'kmw-dua-sleep-ritual-v1') then
        jsonb_typeof(state) = 'array'
        and not jsonb_path_exists(state, '$[*] ? (@.type() != "string")')
      else jsonb_typeof(state) = 'object'
    end
  );
$$;
revoke all on function public.valid_child_activity_progress(text,jsonb) from public, anon, authenticated;

create table public.child_activity_progress (
  child_profile_id uuid not null references public.child_profiles(id) on delete cascade,
  parent_id uuid not null references public.profiles(id) on delete cascade,
  progress_key text not null,
  state jsonb not null,
  revision bigint not null check (revision >= 1),
  primary key (child_profile_id, progress_key),
  check (public.valid_child_activity_progress(progress_key, state))
);

-- Receipts contain no activity payload. Retain them with the child so a device
-- can safely retry after a lost response, even after another device has saved.
create table public.child_activity_operations (
  child_profile_id uuid not null,
  progress_key text not null,
  operation_id uuid not null,
  primary key (child_profile_id, progress_key, operation_id),
  foreign key (child_profile_id, progress_key)
    references public.child_activity_progress(child_profile_id, progress_key) on delete cascade
);

alter table public.child_activity_progress enable row level security;
alter table public.child_activity_operations enable row level security;
revoke all on public.child_activity_progress, public.child_activity_operations from public, anon, authenticated;
grant select on public.child_activity_progress to authenticated;
create policy child_activity_read_own_family on public.child_activity_progress
  for select to authenticated
  using (parent_id = (select auth.uid()) and exists (
    select 1 from public.child_profiles as c
    where c.id = child_activity_progress.child_profile_id and c.parent_id = (select auth.uid())
  ));

create function public.save_child_activity_progress(
  p_child_id uuid, p_key text, p_revision bigint, p_state jsonb, p_operation_id uuid
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  next_state jsonb := coalesce(p_state, 'null'::jsonb);
  saved public.child_activity_progress%rowtype;
  applied boolean := false;
begin
  if owner_id is null then
    raise exception 'Connexion requise.' using errcode = '42501';
  end if;
  perform 1 from public.child_profiles
    where id = p_child_id and parent_id = owner_id for share;
  if not found then
    raise exception 'Profil enfant inaccessible.' using errcode = '42501';
  end if;
  if p_revision is null or p_revision < 0 or p_operation_id is null
      or public.valid_child_activity_progress(p_key, next_state) is not true then
    raise exception 'Paramètres de progression invalides.' using errcode = '22023';
  end if;

  if p_revision = 0 then
    insert into public.child_activity_progress(child_profile_id, parent_id, progress_key, state, revision)
    values (p_child_id, owner_id, p_key, next_state, 1)
    on conflict (child_profile_id, progress_key) do nothing
    returning * into saved;
    applied := found;
  end if;

  if not applied then
    select * into saved from public.child_activity_progress
      where child_profile_id = p_child_id and progress_key = p_key for update;
    if not found then
      return jsonb_build_object('applied', false, 'revision', 0, 'state', null);
    end if;
    if saved.parent_id <> owner_id then
      raise exception 'Profil enfant inaccessible.' using errcode = '42501';
    end if;
    if exists (select 1 from public.child_activity_operations
        where child_profile_id = p_child_id and progress_key = p_key and operation_id = p_operation_id) then
      return jsonb_build_object('applied', true, 'revision', saved.revision, 'state', saved.state);
    end if;
    if saved.revision = p_revision then
      update public.child_activity_progress set state = next_state, revision = revision + 1
        where child_profile_id = p_child_id and progress_key = p_key returning * into saved;
      applied := true;
    end if;
  end if;

  if applied then
    insert into public.child_activity_operations(child_profile_id, progress_key, operation_id)
      values (p_child_id, p_key, p_operation_id);
  end if;
  return jsonb_build_object('applied', applied, 'revision', saved.revision, 'state', saved.state);
end;
$$;

revoke all on function public.save_child_activity_progress(uuid,text,bigint,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.save_child_activity_progress(uuid,text,bigint,jsonb,uuid) to authenticated;

commit;
