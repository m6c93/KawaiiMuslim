-- Real Coran accounts and licences. Apply after quran-platform-admin.sql.
-- Additive migration: never imports or deletes demonstration/family data.
begin;
alter table public.quran_platform_classes add column if not exists program jsonb not null default '{"juz":[],"surahs":[]}';
alter table public.quran_platform_classes add column if not exists revision bigint not null default 0;
alter table public.quran_platform_students add column if not exists learning jsonb not null default '{"trees":{},"submissions":[]}';
alter table public.quran_access_invitations add column if not exists student_id uuid references public.quran_platform_students(id);
create table if not exists public.quran_audit (
 id uuid primary key default gen_random_uuid(), organization_id uuid references public.quran_organizations(id),
 actor_id uuid references public.profiles(id), action text not null, detail jsonb not null default '{}', created_at timestamptz not null default now()
);
alter table public.quran_audit enable row level security;

create or replace function public.quran_admin() returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(auth.jwt()->>'aal'='aal2',false) and exists(select 1 from public.profiles where id=auth.uid() and role='admin' and is_active);
$$;
create or replace function public.quran_user_active() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and is_active);
$$;
create or replace function public.quran_license_active(org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.quran_licenses l join public.quran_organizations o on o.id=l.organization_id
 where o.id=org and o.status in ('active','trial') and l.status in ('active','trial') and current_date between l.starts_at and l.expires_at);
$$;
create or replace function public.quran_manage(org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.quran_admin() or (public.quran_user_active() and exists(select 1 from public.quran_organization_members
 where organization_id=org and profile_id=auth.uid() and role in ('owner','manager') and is_active));
$$;
create or replace function public.quran_teach(cls uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.quran_admin() or (public.quran_user_active() and exists(select 1 from public.quran_platform_classes c
 join public.quran_organization_members m on m.organization_id=c.organization_id and m.profile_id=auth.uid() and m.is_active
 where c.id=cls and c.is_active and (m.role in ('owner','manager') or c.teacher_id=auth.uid()) and public.quran_license_active(c.organization_id)));
$$;
create or replace function public.quran_student_access(pupil uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.quran_platform_students s join public.quran_platform_classes c on c.id=s.class_id
 where s.id=pupil and s.is_active and c.is_active and (public.quran_teach(c.id) or
 (s.profile_id=auth.uid() and public.quran_user_active() and public.quran_license_active(s.organization_id))));
$$;
create or replace function public.quran_class_document(cls uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',c.id,'name',c.name,'organization',c.organization_id,'revision',c.revision,
 'juz',c.program->'juz','surahs',c.program->'surahs','students',coalesce((select jsonb_agg(s.learning||jsonb_build_object('id',s.id,'name',s.display_name,'profileId',s.profile_id) order by s.created_at)
 from public.quran_platform_students s where s.class_id=c.id and s.is_active and public.quran_student_access(s.id)),'[]'::jsonb))
 from public.quran_platform_classes c where c.id=cls and c.is_active and
 (public.quran_teach(c.id) or exists(select 1 from public.quran_platform_students s where s.class_id=c.id and public.quran_student_access(s.id)));
$$;

-- All business writes go through the checked, transactional RPC below.
revoke insert,update,delete on public.quran_organizations,public.quran_licenses,public.quran_organization_members,
 public.quran_platform_classes,public.quran_platform_students,public.quran_access_invitations from authenticated,anon;
revoke all on public.quran_audit from anon,authenticated;
-- Private reads also go through the RPC; no broad member/class exports.
revoke select on public.quran_organizations,public.quran_licenses,public.quran_organization_members,
 public.quran_platform_classes,public.quran_platform_students,public.quran_access_invitations from anon,authenticated;

create or replace function public.quran_portal(action text, payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 uid uuid:=auth.uid(); admin boolean:=public.quran_admin(); org uuid; cls uuid; sid uuid; token text;
 o public.quran_organizations; l public.quran_licenses; c public.quran_platform_classes; s public.quran_platform_students;
 inv public.quran_access_invitations; member_role text; item jsonb; proposed jsonb; oldtree jsonb; newtree jsonb;
 trees jsonb; submissions jsonb; entry record; pos record; count_students integer; version bigint;
 authenticated_email text; who text; result jsonb; new_id uuid; k text; target uuid;
begin
 if uid is null or not public.quran_user_active() then raise exception 'Connectez-vous avec un compte actif.' using errcode='42501'; end if;
 select email,full_name into authenticated_email,who from public.profiles where id=uid;
 if length(payload::text)>3000000 then raise exception 'La demande est trop volumineuse.'; end if;
 if action='context' then
  return jsonb_build_object('admin',admin,'needsMfa',exists(select 1 from public.profiles where id=uid and role='admin') and not admin,
   'profile',jsonb_build_object('id',uid,'name',who,'email',authenticated_email),
   'organizations',coalesce((select jsonb_agg(to_jsonb(x)) from (select o.id,o.name,o.status,m.role,l.plan,l.student_limit,l.starts_at,l.expires_at,l.status as license_status,public.quran_license_active(o.id) as enabled
    from public.quran_organization_members m join public.quran_organizations o on o.id=m.organization_id left join public.quran_licenses l on l.organization_id=o.id where m.profile_id=uid and m.is_active order by o.created_at) x),'[]'::jsonb),
   'students',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.display_name,'classId',s.class_id,'className',c.name,'organization',s.organization_id,'enabled',public.quran_student_access(s.id)))
    from public.quran_platform_students s join public.quran_platform_classes c on c.id=s.class_id where s.profile_id=uid and s.is_active),'[]'::jsonb));
 end if;
 if action='admin_snapshot' then
  if not admin then raise exception 'Accès administrateur et double vérification requis.' using errcode='42501'; end if;
  return jsonb_build_object('organizations',coalesce((select jsonb_agg(to_jsonb(o) order by o.created_at desc) from public.quran_organizations o),'[]'::jsonb),
   'licenses',coalesce((select jsonb_agg(to_jsonb(l)) from public.quran_licenses l),'[]'::jsonb),
   'members',coalesce((select jsonb_agg(to_jsonb(x)) from (select m.*,p.full_name,p.email from public.quran_organization_members m join public.profiles p on p.id=m.profile_id) x),'[]'::jsonb),
   'classes',coalesce((select jsonb_agg(to_jsonb(c)-'program') from public.quran_platform_classes c),'[]'::jsonb),
   'students',coalesce((select jsonb_agg(to_jsonb(s)-'learning') from public.quran_platform_students s),'[]'::jsonb),
   'invites',coalesce((select jsonb_agg(to_jsonb(i)-'token_hash') from public.quran_access_invitations i),'[]'::jsonb),
   'activity',coalesce((select jsonb_agg(to_jsonb(x)) from (select * from public.quran_audit order by created_at desc limit 60) x),'[]'::jsonb));
 end if;
 if action in ('request_access','create_organization') then
  if action='create_organization' and not admin then raise exception 'Accès administrateur requis.' using errcode='42501'; end if;
  if length(trim(payload->>'name')) not between 2 and 160 then raise exception 'Indiquez le nom de la structure.'; end if;
  if action='request_access' then
   select organization_id into org from public.quran_organization_members where profile_id=uid and role='owner' limit 1;
   if org is not null then return jsonb_build_object('id',org); end if;
   -- Serialize onboarding for this account to avoid duplicate registrations.
   perform 1 from public.profiles where id=uid for update;
   select organization_id into org from public.quran_organization_members where profile_id=uid and role='owner' limit 1;
   if org is not null then return jsonb_build_object('id',org); end if;
  end if;
  insert into public.quran_organizations(name,city,contact_name,contact_email,created_by)
   values(trim(payload->>'name'),coalesce(payload->>'city',''),case when admin and action='create_organization' then coalesce(payload->>'contact','') else who end,
   case when admin and action='create_organization' then lower(trim(payload->>'email')) else authenticated_email end,uid) returning id into org;
  insert into public.quran_licenses(organization_id,plan,student_limit,expires_at,status,updated_by)
   values(org,case when payload->>'plan' in ('class','school','association') then payload->>'plan' else 'class' end,20,current_date,'suspended',uid);
  if action='request_access' then insert into public.quran_organization_members(organization_id,profile_id,role) values(org,uid,'owner'); end if;
  insert into public.quran_audit(organization_id,actor_id,action) values(org,uid,action);
  return jsonb_build_object('id',org);
 end if;
 org:=nullif(payload->>'organization','')::uuid;
 if action='set_license' then
  if not admin then raise exception 'Seule l’administration peut modifier une licence.' using errcode='42501'; end if;
  perform 1 from public.quran_organizations where id=org for update;
  if not found then raise exception 'Structure introuvable.'; end if;
  select count(*) into count_students from public.quran_platform_students where organization_id=org and is_active;
  if (payload->>'limit')::integer<count_students then raise exception 'Cette capacité est inférieure au nombre d’élèves actifs (%).',count_students; end if;
  if (payload->>'expires')::date<(payload->>'starts')::date then raise exception 'Vérifiez les dates de la licence.'; end if;
  update public.quran_licenses set plan=payload->>'plan',student_limit=(payload->>'limit')::integer,
   starts_at=(payload->>'starts')::date,expires_at=(payload->>'expires')::date,status=payload->>'status',updated_by=uid where organization_id=org;
  update public.quran_organizations set status=case when payload->>'status' in ('active','trial') then payload->>'status' else 'suspended' end where id=org;
  insert into public.quran_audit(organization_id,actor_id,action,detail) values(org,uid,action,payload-'organization');
  return jsonb_build_object('saved',true);
 end if;
 if action='set_member' then
  if not admin then raise exception 'Accès administrateur requis.' using errcode='42501'; end if;
  target:=(payload->>'profile')::uuid;
  if payload->>'role' not in ('owner','manager','teacher') then raise exception 'Rôle non autorisé.'; end if;
  update public.quran_organization_members set role=payload->>'role',is_active=(payload->>'active')::boolean where organization_id=org and profile_id=target;
  if not found then raise exception 'Membre introuvable.'; end if;
  insert into public.quran_audit(organization_id,actor_id,action,detail) values(org,uid,action,payload-'organization');
  return jsonb_build_object('saved',true);
 end if;
 if action='invite' then
  sid:=nullif(payload->>'student','')::uuid;
  if sid is not null then select * into s from public.quran_platform_students where id=sid and organization_id=org; if not found or not public.quran_teach(s.class_id) then raise exception 'Élève inaccessible.' using errcode='42501'; end if;
  elsif not public.quran_manage(org) then raise exception 'Accès responsable requis.' using errcode='42501'; end if;
  member_role:=case when sid is not null then 'student' else payload->>'role' end;
  if member_role not in ('owner','manager','teacher','student') or (member_role='student' and sid is null) then raise exception 'Choisissez un destinataire valide.'; end if;
  if lower(trim(payload->>'email')) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Indiquez une adresse e-mail valide.'; end if;
  token:=encode(extensions.gen_random_bytes(32),'hex');
  insert into public.quran_access_invitations(organization_id,email,display_name,role,token_hash,expires_at,created_by,student_id)
   values(org,lower(trim(payload->>'email')),coalesce(payload->>'name',''),member_role,encode(extensions.digest(token,'sha256'),'hex'),now()+interval '7 days',uid,sid) returning id into new_id;
  insert into public.quran_audit(organization_id,actor_id,action,detail) values(org,uid,action,jsonb_build_object('invitation',new_id,'role',member_role));
  return jsonb_build_object('id',new_id,'token',token,'expires',now()+interval '7 days');
 end if;
 if action='revoke_invite' then
  select * into inv from public.quran_access_invitations where id=(payload->>'id')::uuid;
  if not found or not public.quran_manage(inv.organization_id) then raise exception 'Invitation inaccessible.' using errcode='42501'; end if;
  update public.quran_access_invitations set status='revoked' where id=inv.id and status='pending';
  insert into public.quran_audit(organization_id,actor_id,action) values(inv.organization_id,uid,action);
  return jsonb_build_object('saved',true);
 end if;
 if action='accept_invite' then
  select * into inv from public.quran_access_invitations where token_hash=encode(extensions.digest(payload->>'token','sha256'),'hex') for update;
  if not found or inv.status<>'pending' or inv.expires_at<=now() then raise exception 'Ce lien a expiré ou a déjà été utilisé. Demandez une nouvelle invitation.'; end if;
  if lower(authenticated_email)<>lower(inv.email) or not exists(select 1 from auth.users where id=uid and email_confirmed_at is not null) then raise exception 'Connectez-vous avec l’adresse vérifiée destinataire de cette invitation.' using errcode='42501'; end if;
  if inv.role='student' then
   update public.quran_platform_students set profile_id=uid where id=inv.student_id and organization_id=inv.organization_id and (profile_id is null or profile_id=uid);
   if not found then raise exception 'Ce compte élève est déjà associé à un autre accès.'; end if;
  else
   insert into public.quran_organization_members(organization_id,profile_id,role) values(inv.organization_id,uid,inv.role)
    on conflict(organization_id,profile_id) do update set role=excluded.role,is_active=true;
  end if;
  update public.quran_access_invitations set status='accepted',accepted_at=now() where id=inv.id;
  insert into public.quran_audit(organization_id,actor_id,action) values(inv.organization_id,uid,action);
  return jsonb_build_object('accepted',true);
 end if;
 if action='classes' then
  return jsonb_build_object('classes',coalesce((select jsonb_agg(doc) from (select public.quran_class_document(id) doc from public.quran_platform_classes where is_active and (org is null or organization_id=org)) x where doc is not null),'[]'::jsonb));
 end if;
 if action='save_class' then
  proposed:=payload->'class'; cls:=(proposed->>'id')::uuid;
  if jsonb_typeof(proposed->'students')<>'array' or jsonb_typeof(proposed->'juz')<>'array' or jsonb_typeof(proposed->'surahs')<>'array' then raise exception 'Classe invalide.'; end if;
  select * into o from public.quran_organizations where id=org for update;
  if not found then raise exception 'Structure introuvable.'; end if;
  if not public.quran_license_active(org) then raise exception 'La licence de cette structure doit être activée ou renouvelée.' using errcode='42501'; end if;
  select * into c from public.quran_platform_classes where id=cls for update;
  if found then
   if c.organization_id<>org or not public.quran_teach(cls) then raise exception 'Classe inaccessible.' using errcode='42501'; end if;
   if c.revision<>coalesce((payload->>'revision')::bigint,-1) then raise exception 'La classe a changé sur un autre appareil. Actualisez avant de réessayer.' using errcode='40001'; end if;
  else
   if not (public.quran_manage(org) or exists(select 1 from public.quran_organization_members where organization_id=org and profile_id=uid and role='teacher' and is_active)) then raise exception 'Accès professeur requis.' using errcode='42501'; end if;
   insert into public.quran_platform_classes(id,organization_id,teacher_id,name) values(cls,org,uid,proposed->>'name') returning * into c;
  end if;
  for item in select value from jsonb_array_elements(proposed->'juz') loop if item::text !~ '^[0-9]+$' or item::text::integer not between 1 and 30 then raise exception 'Juz invalide.'; end if; end loop;
  for item in select value from jsonb_array_elements(proposed->'surahs') loop if item::text !~ '^[0-9]+$' or item::text::integer not between 1 and 114 then raise exception 'Sourate invalide.'; end if; end loop;
  for item in select value from jsonb_array_elements(proposed->'students') loop
   sid:=(item->>'id')::uuid;
   if exists(select 1 from public.quran_platform_students where id=sid and class_id<>cls) then raise exception 'Élève d’une autre classe.' using errcode='42501'; end if;
   if jsonb_typeof(coalesce(item->'trees','{}'))<>'object' or jsonb_typeof(coalesce(item->'submissions','[]'))<>'array' then raise exception 'Données élève invalides.'; end if;
   insert into public.quran_platform_students(id,organization_id,class_id,display_name,learning)
    values(sid,org,cls,item->>'name',jsonb_build_object('trees',coalesce(item->'trees','{}'),'submissions',coalesce(item->'submissions','[]')))
    on conflict(id) do update set display_name=excluded.display_name,learning=excluded.learning;
  end loop;
  select count(*) into count_students from public.quran_platform_students where organization_id=org and is_active;
  select * into l from public.quran_licenses where organization_id=org;
  if count_students>l.student_limit then raise exception 'La licence autorise % élèves. Demandez des places supplémentaires.',l.student_limit; end if;
  update public.quran_platform_classes set name=proposed->>'name',program=jsonb_build_object('juz',proposed->'juz','surahs',proposed->'surahs'),revision=revision+1 where id=cls;
  insert into public.quran_audit(organization_id,actor_id,action,detail) values(org,uid,action,jsonb_build_object('class',cls));
  return public.quran_class_document(cls);
 end if;
 if action='save_student' then
  sid:=(payload->>'student')::uuid;
  select class_id into cls from public.quran_platform_students where id=sid;
  select * into c from public.quran_platform_classes where id=cls for update;
  select * into s from public.quran_platform_students where id=sid for update;
  if not found or s.profile_id<>uid or not public.quran_student_access(sid) then raise exception 'Accès élève requis.' using errcode='42501'; end if;
  if c.revision<>coalesce((payload->>'revision')::bigint,-1) then raise exception 'Le professeur a mis à jour ton jardin. Actualise avant de réessayer.' using errcode='40001'; end if;
  proposed:=payload->'studentData'; trees:=coalesce(s.learning->'trees','{}'); submissions:=coalesce(s.learning->'submissions','[]');
  -- The learner never supplies validated verses, completion, teacher messages or colours.
  for entry in select * from jsonb_each(coalesce(proposed->'trees','{}')) loop
   if entry.key !~ '^[0-9]+$' or entry.key::integer not between 1 and 114 then raise exception 'Sourate invalide.'; end if;
   oldtree:=coalesce(trees->entry.key,'{"verses":[],"pendingVerses":[],"completedAt":null,"teacher":"","messages":[],"verseComments":[],"events":[],"assignment":null,"requested":false,"review":false,"positions":{}}'); newtree:=oldtree;
   for pos in select * from jsonb_each(coalesce(entry.value->'positions','{}')) loop
    if pos.key !~ '^[0-9]+$' or pos.key::integer not between 1 and 30 or (pos.value->>'x')::numeric not between 16 and 84 or (pos.value->>'y')::numeric not between 35 and 92 then raise exception 'Position invalide.'; end if;
    newtree:=jsonb_set(newtree,array['positions',pos.key],pos.value,true);
   end loop;
   if entry.value->>'requested'='true' then newtree:=newtree||jsonb_build_object('requested',true); end if;
   if entry.value->>'messagesSeenAt' is not null then newtree:=newtree||jsonb_build_object('messagesSeenAt',now()); end if;
   if entry.value#>>'{moment,seenAt}' is not null and oldtree->'moment' is not null then newtree:=jsonb_set(newtree,'{moment,seenAt}',to_jsonb(now())); end if;
   if entry.value->>'lastReviewedAt' is distinct from oldtree->>'lastReviewedAt' and oldtree->'assignment'<>'null'::jsonb then
    newtree:=newtree||jsonb_build_object('lastReviewedAt',now(),'assignment',null,'review',false,'events',coalesce(oldtree->'events','[]')||jsonb_build_array(jsonb_build_object('kind','reviewed','from',oldtree#>'{assignment,from}','to',oldtree#>'{assignment,to}','at',now(),'author','Élève')));
   end if;
   trees:=jsonb_set(trees,array[entry.key],newtree,true);
  end loop;
  for item in select value from jsonb_array_elements(coalesce(proposed->'submissions','[]')) loop
   if not exists(select 1 from jsonb_array_elements(submissions) x where x->>'id'=item->>'id') then
    if not exists(select 1 from storage.objects where bucket_id='quran-classroom-audio' and name=s.class_id::text||'/'||s.id::text||'/'||(item->>'id')) then raise exception 'Enregistrement non reçu. Réessaie l’envoi.'; end if;
    if (item->>'surah')::integer not between 1 and 114 or (item->>'from')::integer<1 or (item->>'to')::integer<(item->>'from')::integer or (item->>'to')::integer>286 then raise exception 'Passage invalide.'; end if;
    submissions:=submissions||jsonb_build_array(jsonb_build_object('id',item->>'id','surah',(item->>'surah')::integer,'from',(item->>'from')::integer,'to',(item->>'to')::integer,'at',now(),'listenedAt',null));
   end if;
  end loop;
  update public.quran_platform_students set learning=jsonb_build_object('trees',trees,'submissions',submissions) where id=sid;
  update public.quran_platform_classes set revision=revision+1 where id=cls;
  return public.quran_class_document(cls);
 end if;
 raise exception 'Action inconnue.';
end;
$$;

-- Audio is private, restricted to this learner and the assigned teaching team.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('quran-classroom-audio','quran-classroom-audio',false,26214400,array['audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav','audio/x-wav'])
 on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create or replace function public.quran_audio_allowed(object_name text, writing boolean default false) returns boolean language plpgsql stable security definer set search_path='' as $$
declare parts text[]:=string_to_array(object_name,'/'); sid uuid; cls uuid;
begin
 if array_length(parts,1)<>3 then return false; end if;
 begin cls:=parts[1]::uuid; sid:=parts[2]::uuid; exception when invalid_text_representation then return false; end;
 if not exists(select 1 from public.quran_platform_students where id=sid and class_id=cls) or not public.quran_student_access(sid) then return false; end if;
 if writing and parts[3] like 'verse-comment-%' and not public.quran_teach(cls) then return false; end if;
 return parts[3] ~ '^(verse-comment-)?[0-9a-f-]{36}$';
end;
$$;
drop policy if exists quran_audio_read on storage.objects;
create policy quran_audio_read on storage.objects for select to authenticated using(bucket_id='quran-classroom-audio' and public.quran_audio_allowed(name));
drop policy if exists quran_audio_insert on storage.objects;
create policy quran_audio_insert on storage.objects for insert to authenticated with check(bucket_id='quran-classroom-audio' and public.quran_audio_allowed(name,true));
-- No overwrite or delete permission for recordings submitted by students.
revoke all on function public.quran_portal(text,jsonb),public.quran_class_document(uuid),public.quran_admin(),public.quran_user_active(),
 public.quran_license_active(uuid),public.quran_manage(uuid),public.quran_teach(uuid),public.quran_student_access(uuid),public.quran_audio_allowed(text,boolean) from public,anon;
grant execute on function public.quran_portal(text,jsonb),public.quran_audio_allowed(text,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
