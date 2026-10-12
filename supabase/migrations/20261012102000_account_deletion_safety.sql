begin;
-- Signed provider events for a deleted owner must not recreate family data.
-- Distinguish a genuinely absent Auth owner from a broken profile/DB read.
create or replace function public.billing_owner_state(p_user_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare owner_role text; owner_active boolean;
begin
  if p_user_id is null then raise exception 'Owner required'; end if;
  if not exists(select 1 from auth.users where id = p_user_id) then return 'absent'; end if;
  select role, is_active into owner_role, owner_active from public.profiles where id = p_user_id;
  if not found then raise exception 'Existing owner has no profile'; end if;
  if owner_role = 'parent' and owner_active then return 'active_parent'; end if;
  return 'restricted';
end;
$$;
revoke all on function public.billing_owner_state(uuid) from public, anon, authenticated;
grant execute on function public.billing_owner_state(uuid) to service_role;

-- A still-valid JWT alone cannot access or recreate artwork after Auth deletion.
-- Restrictive policies combine with, rather than replace, the owner-prefix policies.
drop policy if exists artworks_existing_owner_required on storage.objects;
create policy artworks_existing_owner_required on storage.objects
as restrictive for all to authenticated
using (
  bucket_id <> 'child-artworks' or exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_active
  )
)
with check (
  bucket_id <> 'child-artworks' or exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_active
  )
);
commit;
