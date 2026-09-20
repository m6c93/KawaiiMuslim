-- Apply after quran-classroom-reliability.sql. School data stays organization-scoped.
begin;
create or replace function public.quran_school(action text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare org uuid := (payload->>'organization')::uuid; target uuid; cls uuid;
begin
 if auth.uid() is null or not public.quran_user_active() or not public.quran_manage(org) then
  raise exception 'Accès direction requis.' using errcode='42501';
 end if;
 if not exists(select 1 from public.quran_licenses where organization_id=org and plan in ('school','association')) then
  raise exception 'Cet espace est réservé aux écoles.' using errcode='42501';
 end if;
 if not public.quran_admin() and not public.quran_license_active(org) then
  raise exception 'L’accès à cette école doit être activé.' using errcode='42501';
 end if;
 if action='snapshot' then
  return jsonb_build_object(
   'name',(select name from public.quran_organizations where id=org),
   'teachers',coalesce((select jsonb_agg(jsonb_build_object('id',m.profile_id,'name',p.full_name,'email',p.email))
    from public.quran_organization_members m join public.profiles p on p.id=m.profile_id
    where m.organization_id=org and m.role='teacher' and m.is_active),'[]'::jsonb),
   'classes',coalesce((select jsonb_agg(public.quran_class_document(c.id)||jsonb_build_object('teacherId',c.teacher_id))
    from public.quran_platform_classes c where c.organization_id=org and c.is_active),'[]'::jsonb),
   'invites',coalesce((select jsonb_agg(jsonb_build_object('name',display_name,'email',email))
    from public.quran_access_invitations where organization_id=org and role='teacher' and status='pending' and expires_at>now()),'[]'::jsonb));
 elsif action='reassign' then
  target:=(payload->>'teacherId')::uuid;cls:=(payload->>'classId')::uuid;
  perform 1 from public.quran_organization_members where organization_id=org and profile_id=target and role='teacher' and is_active for update;
  if not found then raise exception 'Professeur actif de cette école requis.' using errcode='42501';end if;
  update public.quran_platform_classes set teacher_id=target,revision=revision+1 where id=cls and organization_id=org and is_active;
  if not found then raise exception 'Classe inaccessible.' using errcode='42501';end if;
  insert into public.quran_audit(organization_id,actor_id,action,detail) values(org,auth.uid(),'reassign_class',jsonb_build_object('class',cls,'teacher',target));
  return jsonb_build_object('saved',true);
 end if;
 raise exception 'Action inconnue.';
end $$;
revoke all on function public.quran_school(text,jsonb) from public,anon;
grant execute on function public.quran_school(text,jsonb) to authenticated;
commit;
