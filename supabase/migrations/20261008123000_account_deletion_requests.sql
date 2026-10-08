-- In-app initiation; actual erasure is performed by an authorized operator.
begin;
create table public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'processing')),
  requested_at timestamptz not null default now(),
  due_at timestamptz not null default now() + interval '30 days'
);
alter table public.account_deletion_requests enable row level security;
revoke all on public.account_deletion_requests from public, anon, authenticated;
grant select on public.account_deletion_requests to authenticated;
grant all on public.account_deletion_requests to service_role;
create policy deletion_read_own on public.account_deletion_requests
  for select to authenticated using (user_id = auth.uid());

create or replace function public.request_account_deletion(confirmed boolean)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  claims jsonb := auth.jwt();
  result public.account_deletion_requests;
begin
  if uid is null or not exists(select 1 from auth.users where id = uid)
    or not exists(select 1 from auth.sessions where user_id = uid
      and id::text = claims->>'session_id') then
    raise exception 'Connexion requise.';
  end if;
  if confirmed is distinct from true then
    raise exception 'Confirme la suppression du compte et des profils enfants.';
  end if;
  -- Check the signed authentication event, NOT iat (refreshing a token is not reauthentication).
  if not exists (
    select 1 from jsonb_array_elements(coalesce(claims->'amr', '[]'::jsonb)) as event
    where event->>'method' = 'password'
      and (event->>'timestamp')::numeric between
        extract(epoch from now()) - 300 and extract(epoch from now()) + 30
  ) then
    raise exception 'Vérifie à nouveau ton mot de passe (validité : 5 minutes).';
  end if;
  if exists(select 1 from auth.mfa_factors where user_id = uid and status = 'verified')
    and coalesce(claims->>'aal', '') <> 'aal2' then
    raise exception 'Vérifie aussi ton code de double authentification.';
  end if;
  insert into public.account_deletion_requests(user_id) values(uid)
    on conflict(user_id) do nothing;
  select * into result from public.account_deletion_requests where user_id = uid;
  return to_jsonb(result);
end;
$$;
revoke all on function public.request_account_deletion(boolean) from public, anon;
grant execute on function public.request_account_deletion(boolean) to authenticated;

create or replace function public.admin_list_account_deletions()
returns table(id uuid, user_id uuid, email text, status text, requested_at timestamptz, due_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.jwt()->>'aal', '') <> 'aal2' or not exists (
    select 1 from public.profiles where profiles.id = auth.uid()
      and role = 'admin' and is_active
  ) then raise exception 'Accès administrateur avec double authentification requis.'; end if;
  return query select r.id, r.user_id, u.email::text, r.status, r.requested_at, r.due_at
    from public.account_deletion_requests r join auth.users u on u.id = r.user_id
    order by r.due_at;
end;
$$;
revoke all on function public.admin_list_account_deletions() from public, anon;
grant execute on function public.admin_list_account_deletions() to authenticated;
commit;
