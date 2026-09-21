-- Targeted production migration for the messaging CPU hot path.
-- Safe to run repeatedly after supabase/quran-messaging.sql.
begin;
create index if not exists quran_direct_messages_unread on public.quran_direct_messages(student_id,sender_role,sequence);

create or replace function public.quran_messaging(action text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 uid uuid:=auth.uid(); org uuid:=nullif(payload->>'organization','')::uuid;
 sid uuid; cid uuid; allowed boolean; role_name text; content text; audio text; mid uuid;
 s public.quran_platform_students; m public.quran_direct_messages; maximum bigint; before_seq bigint;
 result jsonb;
begin
 if uid is null or not public.quran_user_active() then raise exception 'Connectez-vous avec un compte actif.' using errcode='42501'; end if;
 if length(payload::text)>20000 then raise exception 'Le message est trop volumineux.'; end if;
 if action='status' then
  return jsonb_build_object('classes',coalesce((select jsonb_agg(jsonb_build_object(
   'id',c.id,'enabled',coalesce(config.enabled,false),'students',students.doc,'unread',students.unread))
   from public.quran_platform_classes c left join public.quran_class_messaging config on config.class_id=c.id
   cross join lateral (select public.quran_teach(c.id) teacher) actor
   cross join lateral (select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'unread',unread.n)),'[]'::jsonb) doc,
    coalesce(sum(unread.n),0) unread,count(*) visible
    from public.quran_platform_students p
    left join public.quran_message_reads reads on reads.student_id=p.id and reads.reader_role=case when actor.teacher then 'teacher' else 'student' end
    cross join lateral (select case when coalesce(config.enabled,false) then (select count(*) from public.quran_direct_messages dm
     where dm.student_id=p.id and dm.sender_role<>case when actor.teacher then 'teacher' else 'student' end
     and dm.sequence>coalesce(reads.last_sequence,0)) else 0 end n) unread
    where p.class_id=c.id and p.is_active and (actor.teacher or
     (p.profile_id=uid and public.quran_license_active(p.organization_id)))) students
   where c.is_active and (org is null or c.organization_id=org) and
   (actor.teacher or students.visible>0)),'[]'::jsonb));
 end if;
 if action='configure' then
  cid:=(payload->>'class')::uuid;
  perform 1 from public.quran_platform_classes where id=cid and is_active and (org is null or organization_id=org) for update;
  if not found or not public.quran_teach(cid) then raise exception 'Seul le professeur peut choisir cette option.' using errcode='42501'; end if;
  if jsonb_typeof(payload->'enabled') is distinct from 'boolean' then raise exception 'Choisissez une option valide.'; end if;
  insert into public.quran_class_messaging(class_id,enabled) values(cid,(payload->>'enabled')::boolean)
   on conflict(class_id) do update set enabled=excluded.enabled,updated_at=now();
  insert into public.quran_audit(organization_id,actor_id,action,detail)
   select organization_id,uid,'messaging_settings',jsonb_build_object('class',cid,'enabled',payload->'enabled') from public.quran_platform_classes where id=cid;
  return jsonb_build_object('enabled',payload->'enabled');
 end if;
 sid:=(payload->>'student')::uuid;
 select * into s from public.quran_platform_students where id=sid and is_active and (org is null or organization_id=org);
 if not found or not public.quran_student_access(sid) then raise exception 'Conversation inaccessible.' using errcode='42501'; end if;
 cid:=s.class_id;
 -- Serialize against disabling the class; sends cannot slip through after disable.
 perform 1 from public.quran_platform_classes where id=cid for share;
 select enabled into allowed from public.quran_class_messaging where class_id=cid;
 if not coalesce(allowed,false) then raise exception 'Le professeur a désactivé la messagerie pour cette classe.' using errcode='42501'; end if;
 role_name:=case when public.quran_teach(cid) then 'teacher' else 'student' end;
 if role_name='student' and s.profile_id is distinct from uid then raise exception 'Conversation inaccessible.' using errcode='42501'; end if;
 if action='thread' then
  before_seq:=coalesce((payload->>'before')::bigint,9223372036854775807);
  select jsonb_build_object('messages',coalesce(jsonb_agg(jsonb_build_object('id',t.id,'sequence',t.sequence,'role',t.sender_role,
   'author',p.full_name,'text',t.body,'audioId',t.audio_id,'at',t.created_at) order by t.sequence),'[]'::jsonb),
   'hasOlder',exists(select 1 from public.quran_direct_messages older where older.student_id=sid and older.sequence<min(t.sequence))) into result
  from (select * from public.quran_direct_messages where student_id=sid and sequence<before_seq order by sequence desc limit 100) t
  join public.profiles p on p.id=t.sender_id;
  return result;
 end if;
 if action='read' then
  select coalesce(max(sequence),0) into maximum from public.quran_direct_messages where student_id=sid;
  insert into public.quran_message_reads(student_id,reader_role,last_sequence) values(sid,role_name,greatest(0,least(coalesce((payload->>'sequence')::bigint,0),maximum)))
   on conflict(student_id,reader_role) do update set last_sequence=greatest(public.quran_message_reads.last_sequence,excluded.last_sequence);
  return jsonb_build_object('saved',true);
 end if;
 if action='send' then
  mid:=(payload->>'id')::uuid;content:=trim(coalesce(payload->>'text',''));audio:=coalesce(payload->>'audioId','');
  if mid is null or length(content)>3000 or (length(content)=0 and length(audio)=0) then raise exception 'Écrivez un message de 3 000 caractères maximum, ou ajoutez un audio.'; end if;
  if audio<>'' and (audio !~ ('^chat-'||role_name||'-[0-9a-f-]{36}$') or not exists(select 1 from storage.objects where bucket_id='quran-classroom-audio' and name=cid::text||'/'||sid::text||'/'||audio)) then raise exception 'Le message audio n’a pas été reçu. Réessayez l’envoi.'; end if;
  insert into public.quran_direct_messages(id,student_id,sender_id,sender_role,body,audio_id)
   values(mid,sid,uid,role_name,content,audio) on conflict(id) do nothing;
  select * into m from public.quran_direct_messages where id=mid;
  if m.sender_id<>uid or m.student_id<>sid then raise exception 'Message inaccessible.' using errcode='42501'; end if;
  return jsonb_build_object('id',m.id,'sequence',m.sequence,'role',m.sender_role,'author',(select full_name from public.profiles where id=uid),'text',m.body,'audioId',m.audio_id,'at',m.created_at);
 end if;
 raise exception 'Action inconnue.';
end;
$$;
revoke all on function public.quran_messaging(text,jsonb) from public,anon;
grant execute on function public.quran_messaging(text,jsonb) to authenticated;
commit;
