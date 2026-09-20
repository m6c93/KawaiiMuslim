begin;
create table if not exists public.quran_class_attendance (
 class_id uuid not null references public.quran_platform_classes(id), day date not null,
 rows jsonb not null, revision integer not null default 1, updated_at timestamptz not null default now(),
 updated_by uuid references public.profiles(id), primary key(class_id,day)
);
alter table public.quran_class_attendance enable row level security;
revoke all on public.quran_class_attendance from public,anon,authenticated;
alter table public.quran_demo_sessions add column if not exists attendance jsonb not null default '{}';
create or replace function public.quran_attendance(action text,payload jsonb default '{}',token text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare d public.quran_demo_sessions; org uuid; cid text; dt date; roster jsonb; item record;
 old jsonb; result jsonb; supplied jsonb; key text; output jsonb;
begin
 if length(payload::text)>150000 then raise exception 'Appel trop volumineux.';end if;
 if token<>'' then
  select * into d from public.quran_demo_sessions where teacher_hash=encode(extensions.digest(token,'sha256'),'hex') and expires_at>now() for update;
  if not found then raise exception 'Accès professeur requis.' using errcode='42501';end if;
  perform public.quran_demo_purge(d.id);select * into d from public.quran_demo_sessions where id=d.id;
 else
  org:=(payload->>'organization')::uuid;
  if auth.uid() is null or not public.quran_user_active() or (not public.quran_admin() and not public.quran_license_active(org)) then raise exception 'Accès professeur requis.' using errcode='42501';end if;
 end if;
 if action='load' then
  if d.id is not null then return d.attendance;end if;
  select coalesce(jsonb_object_agg(a.class_id::text||'/'||a.day::text,jsonb_build_object('classId',a.class_id,'date',a.day,'rows',a.rows,'revision',a.revision,'updatedAt',a.updated_at)),'{}') into output
  from public.quran_class_attendance a join public.quran_platform_classes c on c.id=a.class_id
  where c.organization_id=org and public.quran_teach(c.id);
  return output;
 end if;
 if action<>'save' then raise exception 'Action inconnue.';end if;
 cid:=payload->>'classId';dt:=(payload->>'date')::date;supplied:=payload->'rows';key:=cid||'/'||dt::text;
 if dt is null or dt<'2000-01-01' or dt>current_date+1 or jsonb_typeof(supplied) is distinct from 'object' then raise exception 'Date ou présences invalides.';end if;
 if d.id is not null then
  select value->'students' into roster from jsonb_array_elements(d.data->'classes') where value->>'id'=cid;
  if roster is null then raise exception 'Classe inaccessible.' using errcode='42501';end if;
  old:=d.attendance->key;
 else
  perform 1 from public.quran_platform_classes where id=cid::uuid and organization_id=org and public.quran_teach(id) for update;
  if not found then raise exception 'Classe inaccessible.' using errcode='42501';end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',id)),'[]') into roster from public.quran_platform_students where class_id=cid::uuid and is_active;
  select jsonb_build_object('revision',revision) into old from public.quran_class_attendance where class_id=cid::uuid and day=dt;
 end if;
 if jsonb_array_length(roster)=0 or (select count(*) from jsonb_each(supplied))<>jsonb_array_length(roster) then raise exception 'Renseignez tous les élèves de la classe.';end if;
 for item in select * from jsonb_each(supplied) loop
  if not exists(select 1 from jsonb_array_elements(roster) where value->>'id'=item.key) or jsonb_typeof(item.value)<>'object' or coalesce(item.value->>'status','') not in ('present','absent','late') or length(coalesce(item.value->>'note',''))>240 or jsonb_typeof(item.value->'justified') is distinct from 'boolean' then raise exception 'Présence invalide.';end if;
  if item.value->>'status'<>'absent' and item.value->'justified'='true' then raise exception 'Seule une absence peut être justifiée.';end if;
 end loop;
 if coalesce((old->>'revision')::integer,0) is distinct from (payload->>'revision')::integer then raise exception 'Cet appel a été modifié. Fermez puis rouvrez pour actualiser.' using errcode='40001';end if;
 select jsonb_object_agg(j.key,jsonb_build_object('status',j.value->>'status','justified',j.value->'justified','note',coalesce(j.value->>'note',''))) into supplied from jsonb_each(supplied) j;
 result:=jsonb_build_object('classId',cid,'date',dt,'rows',supplied,'revision',coalesce((old->>'revision')::integer,0)+1,'updatedAt',now());
 if d.id is not null then update public.quran_demo_sessions set attendance=jsonb_set(attendance,array[key],result) where id=d.id;
 else
  insert into public.quran_class_attendance(class_id,day,rows,revision,updated_by) values(cid::uuid,dt,supplied,(result->>'revision')::integer,auth.uid())
  on conflict(class_id,day) do update set rows=excluded.rows,revision=excluded.revision,updated_at=now(),updated_by=auth.uid();
  insert into public.quran_audit(organization_id,actor_id,action,detail) values(org,auth.uid(),'save_attendance',jsonb_build_object('class',cid,'date',dt));
 end if;
 return result;
end $$;
revoke all on function public.quran_attendance(text,jsonb,text) from public;
grant execute on function public.quran_attendance(text,jsonb,text) to anon,authenticated;
-- Extend the existing 48-hour demo purge. Attendance is never in pupil snapshots.
do $$ declare definition text;begin
 select pg_get_functiondef('public.quran_demo_purge(uuid)'::regprocedure) into definition;
 if strpos(definition,'attendance')=0 then
  if strpos(definition,'return removed;')=0 then raise exception 'Version de nettoyage inattendue.';end if;
  definition:=replace(definition,'return removed;', $cleanup$
  update public.quran_demo_sessions ds set attendance=(select coalesce(jsonb_object_agg(a.key,jsonb_set(a.value,'{rows}',(select coalesce(jsonb_object_agg(p.key,p.value),'{}') from jsonb_each(a.value->'rows') p where exists(select 1 from jsonb_array_elements(ds.data->'classes') c cross join lateral jsonb_array_elements(c.value->'students') s where s.value->>'id'=p.key)))),'{}') from jsonb_each(ds.attendance) a) where target is null or ds.id=target;
  return removed;$cleanup$);execute definition;
 end if;
end $$;
commit;
