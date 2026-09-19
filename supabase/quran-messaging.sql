-- Private, optional class messaging. Apply after quran-classroom-reliability.sql.
-- Separate from learning documents: garden saves cannot overwrite conversations.
begin;
create table if not exists public.quran_class_messaging (
 class_id uuid primary key references public.quran_platform_classes(id) on delete cascade,
 enabled boolean not null default false, updated_at timestamptz not null default now()
);
create table if not exists public.quran_direct_messages (
 id uuid primary key, sequence bigint generated always as identity unique,
 student_id uuid not null references public.quran_platform_students(id) on delete cascade,
 sender_id uuid not null references public.profiles(id), sender_role text not null check(sender_role in ('teacher','student')),
 body text not null default '' check(length(body)<=3000), audio_id text not null default '',
 created_at timestamptz not null default now(), check(length(trim(body))>0 or length(audio_id)>0)
);
create index if not exists quran_direct_messages_thread on public.quran_direct_messages(student_id,sequence desc);
create table if not exists public.quran_message_reads (
 student_id uuid references public.quran_platform_students(id) on delete cascade,
 reader_role text check(reader_role in ('teacher','student')), last_sequence bigint not null default 0,
 primary key(student_id,reader_role)
);
alter table public.quran_class_messaging enable row level security;
alter table public.quran_direct_messages enable row level security;
alter table public.quran_message_reads enable row level security;
revoke all on public.quran_class_messaging,public.quran_direct_messages,public.quran_message_reads from public,anon,authenticated;

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
   cross join lateral (select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'unread',unread.n)),'[]'::jsonb) doc,coalesce(sum(unread.n),0) unread
    from public.quran_platform_students p
    cross join lateral (select count(*) n from public.quran_direct_messages dm
     where dm.student_id=p.id and dm.sender_role<>case when public.quran_teach(c.id) then 'teacher' else 'student' end
     and dm.sequence>coalesce((select last_sequence from public.quran_message_reads r where r.student_id=p.id and r.reader_role=case when public.quran_teach(c.id) then 'teacher' else 'student' end),0)) unread
    where p.class_id=c.id and p.is_active and public.quran_student_access(p.id)) students
   where c.is_active and (org is null or c.organization_id=org) and
   (public.quran_teach(c.id) or exists(select 1 from public.quran_platform_students p where p.class_id=c.id and public.quran_student_access(p.id)))),'[]'::jsonb));
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

-- Extend the existing private audio policy for chat, preserving recitation rules.
create or replace function public.quran_audio_allowed(object_name text, writing boolean default false) returns boolean language plpgsql stable security definer set search_path='' as $$
declare parts text[]:=string_to_array(object_name,'/'); sid uuid; cls uuid; teacher boolean;
begin
 if array_length(parts,1)<>3 then return false; end if;
 begin cls:=parts[1]::uuid; sid:=parts[2]::uuid; exception when invalid_text_representation then return false; end;
 if not exists(select 1 from public.quran_platform_students where id=sid and class_id=cls) or not public.quran_student_access(sid) then return false; end if;
 teacher:=public.quran_teach(cls);
 if parts[3] like 'chat-%' then
  if not exists(select 1 from public.quran_class_messaging where class_id=cls and enabled) then return false; end if;
  if writing then return parts[3] ~ ('^chat-'||case when teacher then 'teacher' else 'student' end||'-[0-9a-f-]{36}$'); end if;
  return parts[3] ~ '^chat-(teacher|student)-[0-9a-f-]{36}$';
 end if;
 if writing and parts[3] like 'verse-comment-%' and not teacher then return false; end if;
 return parts[3] ~ '^(verse-comment-)?[0-9a-f-]{36}$';
end;
$$;
notify pgrst,'reload schema';
commit;
