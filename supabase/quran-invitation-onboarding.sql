begin;
-- Close only the Quran tenant provisioning path; family-site Auth stays unchanged.
do $$
declare definition text;
begin
 definition:=pg_get_functiondef('public.quran_portal(text,jsonb)'::regprocedure);
 if position('QURAN_INVITATION_ONLY' in definition)=0 then
  if position('if action in (''request_access'',''create_organization'') then' in definition)=0 then raise exception 'Portal version not recognized'; end if;
  definition:=replace(definition,'if action in (''request_access'',''create_organization'') then',
   'if action=''request_access'' then raise exception ''Cet espace est accessible uniquement sur invitation.'' using errcode=''42501''; end if; -- QURAN_INVITATION_ONLY
 if action in (''request_access'',''create_organization'') then');
  if position('return jsonb_build_object(''accepted'',true);' in definition)=0 then raise exception 'Accept invitation version not recognized'; end if;
  definition:=replace(definition,'return jsonb_build_object(''accepted'',true);','return jsonb_build_object(''accepted'',true,''organization'',inv.organization_id,''student'',inv.student_id);');
  execute definition;
 end if;
end $$;

-- Verify the current Auth email as well as the profile; a stale profile must
-- never allow accepting an invitation for a previously verified address.
do $$
declare definition text;
begin
 definition:=pg_get_functiondef('public.quran_portal(text,jsonb)'::regprocedure);
 definition:=replace(definition,'where id=uid and email_confirmed_at is not null)',
  'where id=uid and email_confirmed_at is not null and lower(email)=lower(inv.email))');
 execute definition;
end $$;

alter table public.quran_access_invitations
 add column if not exists delivery_status text,
 add column if not exists delivery_attempt uuid,
 add column if not exists delivery_attempted_at timestamptz,
 add column if not exists email_sent_at timestamptz,
 add column if not exists email_message_id text;

-- Only the authenticated inviter/manager can request delivery. The service role
-- records the provider result, never a browser-supplied success claim.
create or replace function public.quran_invitation_delivery(action text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare i public.quran_access_invitations; a uuid; u auth.users; authorized boolean;
begin
 if action='finish' then
  if auth.role() is distinct from 'service_role' then raise exception 'Accès serveur requis.' using errcode='42501'; end if;
  update public.quran_access_invitations set
   delivery_status=case when payload->>'sent'='true' then 'sent' else 'failed' end,
   email_sent_at=case when payload->>'sent'='true' then now() else email_sent_at end,
   email_message_id=case when payload->>'sent'='true' then left(payload->>'messageId',300) else email_message_id end
  where id=(payload->>'id')::uuid and delivery_attempt=(payload->>'attempt')::uuid;
  return jsonb_build_object('saved',found);
 end if;
 if action<>'claim' or auth.uid() is null or not public.quran_user_active() then raise exception 'Connexion requise.' using errcode='42501'; end if;
 select * into i from public.quran_access_invitations where token_hash=encode(extensions.digest(payload->>'token','sha256'),'hex') for update;
 if not found or i.status<>'pending' or i.expires_at<=now() then raise exception 'Invitation expirée ou indisponible.'; end if;
 authorized:=public.quran_manage(i.organization_id);
 if i.student_id is not null then
  authorized:=authorized or exists(select 1 from public.quran_platform_students s where s.id=i.student_id and s.organization_id=i.organization_id and public.quran_teach(s.class_id));
 end if;
 if not coalesce(authorized,false) then raise exception 'Invitation inaccessible.' using errcode='42501'; end if;
 if i.delivery_attempted_at>now()-interval '60 seconds' then raise exception 'Patientez une minute avant de renvoyer cette invitation.'; end if;
 -- An organization cannot use invitations as a bulk mail relay.
 if (select count(*) from public.quran_access_invitations where organization_id=i.organization_id and delivery_attempted_at>now()-interval '1 hour')>=100 then raise exception 'Trop d’invitations envoyées. Réessayez plus tard.'; end if;
 a:=extensions.gen_random_uuid();
 update public.quran_access_invitations set delivery_attempt=a,delivery_attempted_at=now(),delivery_status='sending' where id=i.id;
 select * into u from auth.users where lower(email)=lower(i.email) limit 1;
 return jsonb_build_object('id',i.id,'attempt',a,'email',i.email,'name',i.display_name,
  'existing',u.id is not null,'needsPassword',u.id is null or coalesce(u.encrypted_password,'')='',
  'organization',(select name from public.quran_organizations where id=i.organization_id));
end $$;
revoke all on function public.quran_invitation_delivery(text,jsonb) from public,anon;
grant execute on function public.quran_invitation_delivery(text,jsonb) to authenticated,service_role;

-- The membership link is not an authentication link. It discloses no recipient
-- identity anonymously; the emailed Auth proof is needed to create a session.
create or replace function public.quran_invitation_info(token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare i public.quran_access_invitations; current_email text;
begin
 if token is null or token !~ '^[a-f0-9]{64}$' then raise exception 'Lien invalide.'; end if;
 select * into i from public.quran_access_invitations where token_hash=encode(extensions.digest(token,'sha256'),'hex');
 if not found or i.status<>'pending' or i.expires_at<=now() then raise exception 'Cette invitation a expiré ou a déjà été utilisée. Demandez une nouvelle invitation.'; end if;
 select email into current_email from auth.users where id=auth.uid();
 return jsonb_build_object('valid',true,'matches',coalesce(lower(current_email)=lower(i.email),false));
end $$;
revoke all on function public.quran_invitation_info(text) from public;
grant execute on function public.quran_invitation_info(text) to anon,authenticated;
commit;
