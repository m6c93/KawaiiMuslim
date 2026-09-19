-- Isolated, expiring presentation sessions. No real account or classroom writes.
begin;
create table if not exists public.quran_demo_sessions(
 id uuid primary key default gen_random_uuid(), teacher_hash text unique not null,
 data jsonb not null, chat jsonb not null default '{"settings":{},"threads":{},"sequence":0}',
 created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '14 days'
);
create table if not exists public.quran_demo_links(
 session_id uuid references public.quran_demo_sessions(id) on delete cascade,
 class_id text not null, student_id text not null, token_hash text unique not null,
 primary key(session_id,student_id)
);
create table if not exists public.quran_demo_audio(
 session_id uuid references public.quran_demo_sessions(id) on delete cascade,
 student_id text not null, id text not null, mime text not null, content bytea not null,
 primary key(session_id,student_id,id)
);
alter table public.quran_demo_sessions enable row level security;
alter table public.quran_demo_links enable row level security;
alter table public.quran_demo_audio enable row level security;
revoke all on public.quran_demo_sessions,public.quran_demo_links,public.quran_demo_audio from public,anon,authenticated;

create or replace function public.quran_demo_class_check(c jsonb) returns void language plpgsql set search_path='' as $$
declare s jsonb; n integer;
begin
 if jsonb_typeof(c) is distinct from 'object' or length(coalesce(c->>'id','')) not between 1 and 100 or length(trim(coalesce(c->>'name',''))) not between 1 and 80
 or jsonb_typeof(c->'students') is distinct from 'array' or jsonb_typeof(c->'juz') is distinct from 'array' or jsonb_typeof(c->'surahs') is distinct from 'array'
 then raise exception 'Classe de démonstration invalide.'; end if;
 if jsonb_array_length(c->'students')>100 or length(c::text)>1000000 then raise exception 'La classe de démonstration est trop volumineuse.'; end if;
 for n in select value::integer from jsonb_array_elements_text(c->'juz') loop if n not between 1 and 30 then raise exception 'Juz invalide.'; end if; end loop;
 for n in select value::integer from jsonb_array_elements_text(c->'surahs') loop if n not between 1 and 114 then raise exception 'Sourate invalide.'; end if; end loop;
 for s in select value from jsonb_array_elements(c->'students') loop
  if length(coalesce(s->>'id','')) not between 1 and 100 or length(trim(coalesce(s->>'name',''))) not between 1 and 60 or jsonb_typeof(s->'trees') is distinct from 'object' or jsonb_typeof(coalesce(s->'submissions','[]'))<>'array' then raise exception 'Élève invalide.'; end if;
 end loop;
 if (select count(*)<>count(distinct value->>'id') from jsonb_array_elements(c->'students')) then raise exception 'Élève en double.'; end if;
end;
$$;
revoke all on function public.quran_demo_class_check(jsonb) from public,anon,authenticated;

-- The scheduler and RPC both use this narrow cleanup; it never touches real tables.
create or replace function public.quran_demo_purge(target uuid default null) returns integer
language plpgsql security definer set search_path='' as $$
declare d public.quran_demo_sessions; c jsonb; p jsonb; classes jsonb; pupils jsonb; threads jsonb; item record; removed integer:=0;
begin
 for d in select * from public.quran_demo_sessions where target is null or id=target for update skip locked loop
  if d.expires_at<=now() then delete from public.quran_demo_sessions where id=d.id;continue;end if;
  classes:='[]';threads:=d.chat->'threads';
  for c in select value from jsonb_array_elements(d.data->'classes') loop
   pupils:='[]';
   for p in select value from jsonb_array_elements(c->'students') loop
    if coalesce((p->>'demoExpiresAt')::timestamptz,d.created_at+interval '48 hours')<=now() then
     removed:=removed+1;threads:=threads-(p->>'id');
    else pupils:=pupils||jsonb_build_array(p);end if;
   end loop;
   if pupils<>c->'students' then c:=c||jsonb_build_object('students',pupils,'revision',coalesce((c->>'revision')::bigint,0)+1);end if;
   classes:=classes||jsonb_build_array(c);
  end loop;
  -- Also remove orphan data when the teacher removed a trial pupil.
  delete from public.quran_demo_links l where l.session_id=d.id and not exists(select 1 from jsonb_array_elements(classes) c cross join lateral jsonb_array_elements(c.value->'students') p where p.value->>'id'=l.student_id);
  delete from public.quran_demo_audio a where a.session_id=d.id and not exists(select 1 from jsonb_array_elements(classes) c cross join lateral jsonb_array_elements(c.value->'students') p where p.value->>'id'=a.student_id);
  for item in select * from jsonb_each(threads) loop
   if not exists(select 1 from jsonb_array_elements(classes) c cross join lateral jsonb_array_elements(c.value->'students') p where p.value->>'id'=item.key) then threads:=threads-item.key;end if;
  end loop;
  if classes<>d.data->'classes' or threads<>d.chat->'threads' then
   update public.quran_demo_sessions set data=jsonb_set(d.data,'{classes}',classes),chat=jsonb_set(d.chat,'{threads}',threads) where id=d.id;
  end if;
 end loop;
 return removed;
end;
$$;
revoke all on function public.quran_demo_purge(uuid) from public,anon,authenticated;

-- One-time backfill: existing trial pupils receive 48 hours from this deployment.
-- Reapplying the migration cannot renew an existing pupil's deadline.
update public.quran_demo_sessions d set data=jsonb_set(d.data,'{classes}',(
 select coalesce(jsonb_agg(c.value||jsonb_build_object('students',(
  select coalesce(jsonb_agg(p.value||jsonb_build_object('demoExpiresAt',coalesce(p.value->'demoExpiresAt',to_jsonb(now()+interval '48 hours')))),'[]'::jsonb)
  from jsonb_array_elements(c.value->'students') p
 ))),'[]'::jsonb) from jsonb_array_elements(d.data->'classes') c
)) where exists(select 1 from jsonb_array_elements(d.data->'classes') c cross join lateral jsonb_array_elements(c.value->'students') p where p.value->>'demoExpiresAt' is null);

create or replace function public.quran_demo(action text,payload jsonb default '{}',token text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 d public.quran_demo_sessions; link public.quran_demo_links; teacher boolean; role_name text;
 c jsonb; oldc jsonb; s jsonb; old_s jsonb; item jsonb; entry record; pos record;
 classes jsonb; output jsonb:='[]'; pupils jsonb; trees jsonb; oldtree jsonb; newtree jsonb; submissions jsonb;
 cid text; sid text; newtoken text; h text; ci integer; si integer; version bigint;
 config jsonb; threads jsonb; thread jsonb; msg jsonb; messages jsonb; seq bigint; seen bigint; count_unread integer; students_json jsonb;
 bytes bytea; mime text; audio_id text; body text; mid text; existing jsonb; pupil_expiry timestamptz; new_pupil boolean:=false;
begin
 if length(payload::text)>9000000 then raise exception 'Données trop volumineuses.'; end if;
 if action='create' then
  -- A retry with the same client-generated capability does not create duplicates.
  newtoken:=payload->>'owner';
  if coalesce(newtoken,'') !~ '^[0-9a-f]{64}$' then raise exception 'Clé de démonstration invalide.'; end if;
  h:=encode(extensions.digest(newtoken,'sha256'),'hex');
  perform pg_advisory_xact_lock(17840031);
  select * into d from public.quran_demo_sessions where teacher_hash=h;
  if found and d.expires_at>now() then return jsonb_build_object('expiresAt',d.expires_at); end if;
  delete from public.quran_demo_sessions where expires_at<now();
  if (select count(*) from public.quran_demo_sessions)>=100 or (select count(*) from public.quran_demo_sessions where created_at>now()-interval '1 hour')>=20 then raise exception 'Trop de nouvelles démonstrations. Réessayez plus tard.'; end if;
  classes:=payload#>'{data,classes}';
  if jsonb_typeof(classes) is distinct from 'array' or jsonb_array_length(classes) not between 1 and 10 or length(classes::text)>2000000 then raise exception 'Choisissez de 1 à 10 classes de démonstration.'; end if;
  for c in select value from jsonb_array_elements(classes) loop
   perform public.quran_demo_class_check(c);pupils:='[]';
   for s in select value from jsonb_array_elements(c->'students') loop pupils:=pupils||jsonb_build_array(s||jsonb_build_object('demoExpiresAt',now()+interval '48 hours'));end loop;
   output:=output||jsonb_build_array(c||jsonb_build_object('revision',1,'students',pupils));
  end loop;
  if (select count(*)<>count(distinct value->>'id') from jsonb_array_elements(classes)) or (select count(*)<>count(distinct p.value->>'id') from jsonb_array_elements(classes) c cross join lateral jsonb_array_elements(c.value->'students') p) then raise exception 'Identifiants en double.'; end if;
  config:=coalesce(payload->'settings','{}');if jsonb_typeof(config)<>'object' then raise exception 'Réglages invalides.';end if;
  insert into public.quran_demo_sessions(teacher_hash,data,chat) values(h,jsonb_build_object('classes',output),jsonb_build_object('settings',config,'threads','{}'::jsonb,'sequence',0)) returning * into d;
  return jsonb_build_object('expiresAt',d.expires_at);
 end if;
 if coalesce(token,'') !~ '^[0-9a-f]{64}$' then raise exception 'Ce lien de démonstration est invalide ou a expiré.' using errcode='42501'; end if;
 h:=encode(extensions.digest(token,'sha256'),'hex');
 select * into d from public.quran_demo_sessions where teacher_hash=h for update;
 teacher:=found;
 if not teacher then
  select * into link from public.quran_demo_links where token_hash=h;
  if not found then raise exception 'Ce lien de démonstration est invalide ou a expiré.' using errcode='42501'; end if;
  select * into d from public.quran_demo_sessions where id=link.session_id for update;
 end if;
 if d.id is null or d.expires_at<=now() then raise exception 'Cette démonstration a expiré. Demandez un nouveau lien au professeur.' using errcode='42501'; end if;
 perform public.quran_demo_purge(d.id);
 select * into d from public.quran_demo_sessions where id=d.id;
 role_name:=case when teacher then 'teacher' else 'student' end;
 if not teacher then
  select (b.value->>'demoExpiresAt')::timestamptz into pupil_expiry from jsonb_array_elements(d.data->'classes') a cross join lateral jsonb_array_elements(a.value->'students') b where a.value->>'id'=link.class_id and b.value->>'id'=link.student_id;
  if pupil_expiry is null or pupil_expiry<=now() then raise exception 'Ce compte de démonstration a expiré après 48 heures. Demandez un nouveau compte au professeur.' using errcode='42501';end if;
 end if;
 if not teacher and not exists(select 1 from jsonb_array_elements(d.data->'classes') a cross join lateral jsonb_array_elements(a.value->'students') b where a.value->>'id'=link.class_id and b.value->>'id'=link.student_id) then raise exception 'Cet élève n’est plus dans la démonstration.' using errcode='42501';end if;
 if action='context' then return jsonb_build_object('studentId',case when teacher then null else link.student_id end,'classId',case when teacher then null else link.class_id end,'expiresAt',case when teacher then d.expires_at else least(d.expires_at,pupil_expiry) end);end if;
 if action='classes' then
  if teacher then return d.data; end if;
  select value into c from jsonb_array_elements(d.data->'classes') where value->>'id'=link.class_id;
  select value into s from jsonb_array_elements(c->'students') where value->>'id'=link.student_id;
  return jsonb_build_object('classes',jsonb_build_array(c||jsonb_build_object('students',jsonb_build_array(s))));
 end if;
 if action='save_class' then
  if not teacher then raise exception 'Seul le professeur peut modifier la classe.' using errcode='42501';end if;
  c:=payload->'class';perform public.quran_demo_class_check(c);
  select value,ordinality::integer-1 into oldc,ci from jsonb_array_elements(d.data->'classes') with ordinality where value->>'id'=c->>'id';
  if coalesce((oldc->>'revision')::bigint,0)<>coalesce((payload->>'revision')::bigint,-1) then raise exception 'La classe a changé. Actualisez avant de réessayer.' using errcode='40001';end if;
  if exists(select 1 from jsonb_array_elements(d.data->'classes') a cross join lateral jsonb_array_elements(a.value->'students') b join jsonb_array_elements(c->'students') p on p.value->>'id'=b.value->>'id' where a.value->>'id'<>c->>'id') then raise exception 'Identifiant élève déjà utilisé.';end if;
  pupils:='[]';
  for s in select value from jsonb_array_elements(c->'students') loop
   select value into old_s from jsonb_array_elements(coalesce(oldc->'students','[]')) where value->>'id'=s->>'id';
   if old_s is null then new_pupil:=true;end if;
   pupils:=pupils||jsonb_build_array(s||jsonb_build_object('demoExpiresAt',coalesce((old_s->>'demoExpiresAt')::timestamptz,now()+interval '48 hours')));
  end loop;
  c:=c||jsonb_build_object('revision',coalesce((oldc->>'revision')::bigint,0)+1,'students',pupils);
  if ci is null then
   if jsonb_array_length(d.data->'classes')>=10 then raise exception 'Cette démonstration contient déjà 10 classes.';end if;
   d.data:=jsonb_set(d.data,'{classes}',d.data->'classes'||jsonb_build_array(c));
  else d.data:=jsonb_set(d.data,array['classes',ci::text],c);end if;
  if length(d.data::text)>2000000 then raise exception 'Démonstration trop volumineuse.';end if;
  update public.quran_demo_sessions set data=d.data,expires_at=case when new_pupil then greatest(expires_at,now()+interval '14 days') else expires_at end where id=d.id;return c;
 end if;
 if action='invite' then
  if not teacher then raise exception 'Seul le professeur peut partager un accès.' using errcode='42501';end if;
  cid:=payload->>'class';sid:=payload->>'student';
  if not exists(select 1 from jsonb_array_elements(d.data->'classes') a cross join lateral jsonb_array_elements(a.value->'students') b where a.value->>'id'=cid and b.value->>'id'=sid) then raise exception 'Élève introuvable.';end if;
  -- Stable links are derived from the teacher capability, never returned by reads.
  newtoken:=encode(extensions.hmac(d.id::text||':'||cid||':'||sid,token,'sha256'),'hex');
  insert into public.quran_demo_links values(d.id,cid,sid,encode(extensions.digest(newtoken,'sha256'),'hex')) on conflict(session_id,student_id) do update set token_hash=excluded.token_hash,class_id=excluded.class_id;
  select (b.value->>'demoExpiresAt')::timestamptz into pupil_expiry from jsonb_array_elements(d.data->'classes') a cross join lateral jsonb_array_elements(a.value->'students') b where a.value->>'id'=cid and b.value->>'id'=sid;
  return jsonb_build_object('token',newtoken,'expiresAt',least(d.expires_at,pupil_expiry));
 end if;
 if action='save_student' then
  if teacher then raise exception 'Lien élève requis.' using errcode='42501';end if;
  select value,ordinality::integer-1 into c,ci from jsonb_array_elements(d.data->'classes') with ordinality where value->>'id'=link.class_id;
  if (c->>'revision')::bigint<>coalesce((payload->>'revision')::bigint,-1) then raise exception 'Le professeur a mis à jour ton jardin. Actualise avant de réessayer.' using errcode='40001';end if;
  select value,ordinality::integer-1 into old_s,si from jsonb_array_elements(c->'students') with ordinality where value->>'id'=link.student_id;
  s:=payload->'studentData';
  if s->>'id' is distinct from link.student_id or jsonb_typeof(s->'trees') is distinct from 'object' or jsonb_typeof(coalesce(s->'submissions','[]'))<>'array' then raise exception 'Données élève invalides.';end if;
  trees:=old_s->'trees';submissions:=coalesce(old_s->'submissions','[]');
  for entry in select * from jsonb_each(s->'trees') loop
   if entry.key !~ '^[0-9]+$' or entry.key::integer not between 1 and 114 then raise exception 'Sourate invalide.';end if;
   oldtree:=coalesce(trees->entry.key,'{"verses":[],"pendingVerses":[],"completedAt":null,"teacher":"","messages":[],"verseComments":[],"events":[],"assignment":null,"requested":false,"review":false,"positions":{}}');
   newtree:=oldtree||jsonb_build_object('positions',coalesce(oldtree->'positions','{}'));
   for pos in select * from jsonb_each(coalesce(entry.value->'positions','{}')) loop
    if pos.key !~ '^[0-9]+$' or pos.key::integer not between 1 and 30 or coalesce((pos.value->>'x')::numeric,0) not between 16 and 84 or coalesce((pos.value->>'y')::numeric,0) not between 35 and 92 then raise exception 'Position invalide.';end if;
    newtree:=jsonb_set(newtree,array['positions',pos.key],pos.value);
   end loop;
   if entry.value->>'requested'='true' then newtree:=newtree||'{"requested":true}';end if;
   if entry.value->>'messagesSeenAt' is not null and entry.value->>'messagesSeenAt' is distinct from oldtree->>'messagesSeenAt' then newtree:=newtree||jsonb_build_object('messagesSeenAt',now());end if;
   if entry.value#>>'{moment,seenAt}' is not null and oldtree->'moment' is not null and oldtree->'moment'<>'null'::jsonb then newtree:=jsonb_set(newtree,'{moment,seenAt}',to_jsonb(now()));end if;
   if entry.value->>'lastReviewedAt' is distinct from oldtree->>'lastReviewedAt' and oldtree->'assignment'<>'null'::jsonb then newtree:=newtree||jsonb_build_object('lastReviewedAt',now(),'assignment',null,'review',false,'events',coalesce(oldtree->'events','[]')||jsonb_build_array(jsonb_build_object('kind','reviewed','from',oldtree#>'{assignment,from}','to',oldtree#>'{assignment,to}','at',now(),'author','Élève')));end if;
   trees:=jsonb_set(trees,array[entry.key],newtree);
  end loop;
  for item in select value from jsonb_array_elements(coalesce(s->'submissions','[]')) loop
   if not exists(select 1 from jsonb_array_elements(submissions) x where x->>'id'=item->>'id') then
    if coalesce(item->>'id','') !~ '^[0-9a-f-]{36}$' or not exists(select 1 from public.quran_demo_audio where session_id=d.id and student_id=link.student_id and id=item->>'id') then raise exception 'Enregistrement non reçu. Réessaie l’envoi.';end if;
    if public.quran_verse_count((item->>'surah')::integer) is null or coalesce((item->>'from')::integer,0)<1 or coalesce((item->>'to')::integer,0)<(item->>'from')::integer or (item->>'to')::integer>public.quran_verse_count((item->>'surah')::integer) then raise exception 'Passage invalide.';end if;
    submissions:=submissions||jsonb_build_array(item||jsonb_build_object('at',now(),'listenedAt',null));
   end if;
  end loop;
  old_s:=old_s||jsonb_build_object('trees',trees,'submissions',submissions);
  c:=jsonb_set(c,array['students',si::text],old_s)||jsonb_build_object('revision',(c->>'revision')::bigint+1);
  d.data:=jsonb_set(d.data,array['classes',ci::text],c);
  if length(d.data::text)>2000000 then raise exception 'Démonstration trop volumineuse.';end if;
  update public.quran_demo_sessions set data=d.data where id=d.id;
  return c||jsonb_build_object('students',jsonb_build_array(old_s));
 end if;
 config:=d.chat->'settings';threads:=d.chat->'threads';
 if action='chat_status' then
  for c in select value from jsonb_array_elements(d.data->'classes') loop
   students_json:='[]';seq:=0;
   for s in select value from jsonb_array_elements(c->'students') loop
    if teacher or s->>'id'=link.student_id then
     thread:=threads->(s->>'id');seen:=coalesce((thread#>>array['seen',role_name])::bigint,0);
     select count(*) into count_unread from jsonb_array_elements(coalesce(thread->'messages','[]')) m where m->>'role'<>role_name and (m->>'sequence')::bigint>seen;
     students_json:=students_json||jsonb_build_array(jsonb_build_object('id',s->>'id','unread',count_unread));seq:=seq+count_unread;
    end if;
   end loop;
   if teacher or c->>'id'=link.class_id then output:=output||jsonb_build_array(jsonb_build_object('id',c->>'id','enabled',config->(c->>'id')='true'::jsonb,'students',students_json,'unread',seq));end if;
  end loop;
  return jsonb_build_object('classes',output);
 end if;
 if action='chat_configure' then
  cid:=payload->>'class';
  if not teacher or not exists(select 1 from jsonb_array_elements(d.data->'classes') x where x->>'id'=cid) then raise exception 'Seul le professeur peut choisir cette option.' using errcode='42501';end if;
  if jsonb_typeof(payload->'enabled') is distinct from 'boolean' then raise exception 'Option invalide.';end if;
  d.chat:=jsonb_set(d.chat,array['settings',cid],payload->'enabled');update public.quran_demo_sessions set chat=d.chat where id=d.id;return jsonb_build_object('enabled',payload->'enabled');
 end if;
 sid:=payload->>'student';
 select a.value,b.value into c,s from jsonb_array_elements(d.data->'classes') a cross join lateral jsonb_array_elements(a.value->'students') b where b.value->>'id'=sid;
 if s is null or (not teacher and sid is distinct from link.student_id) then raise exception 'Cet espace ne vous est pas accessible.' using errcode='42501';end if;
 cid:=c->>'id';
 if action in ('audio_save','audio_load') then
  audio_id:=payload->>'id';
  if payload->>'class' is distinct from cid or coalesce(audio_id,'') !~ '^(chat-(teacher|student)-|verse-comment-)?[0-9a-f-]{36}$' then raise exception 'Audio invalide.';end if;
  if audio_id like 'chat-%' and config->cid is distinct from 'true'::jsonb then raise exception 'Messagerie désactivée.';end if;
  if action='audio_load' then
   select content,q.mime into bytes,mime from public.quran_demo_audio q where q.session_id=d.id and q.student_id=sid and q.id=audio_id;
   if not found then raise exception 'Cet audio n’est pas disponible dans la démo partagée.';end if;
   return jsonb_build_object('data',encode(bytes,'base64'),'mime',mime);
  end if;
  if (not teacher and audio_id like 'verse-comment-%') or (audio_id like 'chat-%' and audio_id not like 'chat-'||role_name||'-%') then raise exception 'Envoi audio interdit.' using errcode='42501';end if;
  if exists(select 1 from public.quran_demo_audio where session_id=d.id and student_id=sid and id=audio_id) then return '{"saved":true}';end if;
  bytes:=decode(coalesce(payload->>'data',''),'base64');mime:=payload->>'mime';
  if length(bytes) not between 1 and 6291456 or mime not in ('audio/webm','audio/mp4','audio/ogg','audio/wav','audio/mpeg','audio/aac') then raise exception 'Audio trop long ou format non pris en charge.';end if;
  perform pg_advisory_xact_lock(17840032);
  if (select coalesce(sum(length(content)),0) from public.quran_demo_audio where session_id=d.id)+length(bytes)>41943040 or (select coalesce(sum(length(content)),0) from public.quran_demo_audio)+length(bytes)>524288000 then raise exception 'La capacité audio de la démonstration est atteinte.';end if;
  insert into public.quran_demo_audio values(d.id,sid,audio_id,mime,bytes);return '{"saved":true}';
 end if;
 if action like 'chat_%' then
  if config->cid is distinct from 'true'::jsonb then raise exception 'Le professeur a désactivé la messagerie.';end if;
  thread:=coalesce(threads->sid,'{"messages":[],"seen":{}}');messages:=thread->'messages';
  if action='chat_thread' then
   select coalesce(jsonb_agg(x.value order by (x.value->>'sequence')::bigint),'[]') into output from (select value from jsonb_array_elements(messages) where (value->>'sequence')::bigint<coalesce((payload->>'before')::bigint,9223372036854775807) order by (value->>'sequence')::bigint desc limit 100) x;
   return jsonb_build_object('messages',output,'hasOlder',exists(select 1 from jsonb_array_elements(messages) x where (x->>'sequence')::bigint<(output->0->>'sequence')::bigint));
  elsif action='chat_read' then
   select coalesce(max((value->>'sequence')::bigint),0) into seq from jsonb_array_elements(messages);
   thread:=jsonb_set(thread,array['seen',role_name],to_jsonb(greatest(coalesce((thread#>>array['seen',role_name])::bigint,0),least(seq,coalesce((payload->>'sequence')::bigint,0)))));
  elsif action='chat_send' then
   mid:=payload->>'id';body:=trim(coalesce(payload->>'text',''));audio_id:=coalesce(payload->>'audioId','');
   select value into existing from jsonb_array_elements(messages) where value->>'id'=mid;
   if existing is not null then if existing->>'role'<>role_name then raise exception 'Message inaccessible.';end if;return existing;end if;
   if coalesce(mid,'') !~ '^[0-9a-f-]{36}$' or length(body)>3000 or (body='' and audio_id='') then raise exception 'Écrivez un message de 3 000 caractères maximum, ou ajoutez un audio.';end if;
   if audio_id<>'' and (audio_id not like 'chat-'||role_name||'-%' or not exists(select 1 from public.quran_demo_audio where session_id=d.id and student_id=sid and id=audio_id)) then raise exception 'Audio non reçu.';end if;
   if jsonb_array_length(messages)>=1000 then raise exception 'Cette conversation de démonstration contient déjà 1 000 messages.';end if;
   seq:=coalesce((d.chat->>'sequence')::bigint,0)+1;
   msg:=jsonb_build_object('id',mid,'sequence',seq,'role',role_name,'author',case when teacher then 'Professeur · Démonstration' else s->>'name' end,'text',body,'audioId',audio_id,'at',now());
   thread:=jsonb_set(thread,'{messages}',messages||jsonb_build_array(msg));d.chat:=jsonb_set(d.chat,'{sequence}',to_jsonb(seq));
  else raise exception 'Action inconnue.';end if;
  d.chat:=jsonb_set(d.chat,array['threads',sid],thread);
  if length(d.chat::text)>2000000 then raise exception 'Messagerie de démonstration pleine.';end if;
  update public.quran_demo_sessions set chat=d.chat where id=d.id;return coalesce(msg,'{"saved":true}');
 end if;
 raise exception 'Action inconnue.';
end;
$$;
revoke all on function public.quran_demo(text,jsonb,text) from public;
grant execute on function public.quran_demo(text,jsonb,text) to anon,authenticated;
notify pgrst,'reload schema';
commit;
