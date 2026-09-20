-- Temporary identities with no passwords; all fixtures roll back.
begin;
do $test$
declare
 teacher uuid:=gen_random_uuid(); learner uuid:=gen_random_uuid(); administrator uuid:=gen_random_uuid();
 org uuid:=gen_random_uuid(); cls uuid:=gen_random_uuid(); pupil uuid:=gen_random_uuid();
 result jsonb; denied boolean;
begin
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
 select id,'context-qa-'||id::text||'@example.invalid',now(),'{"full_name":"Context QA"}'::jsonb
 from unnest(array[teacher,learner,administrator]) id;
 insert into public.profiles(id,email,full_name)
 select id,'context-qa-'||id::text||'@example.invalid','Context QA'
 from unnest(array[teacher,learner,administrator]) id on conflict(id) do nothing;
 update public.profiles set role='admin' where id=administrator;
 insert into public.quran_organizations(id,name,status) values(org,'Context QA rollback','active');
 insert into public.quran_licenses(organization_id,student_limit,starts_at,expires_at,status)
 values(org,3,current_date,current_date+30,'active');
 insert into public.quran_organization_members(organization_id,profile_id,role) values(org,teacher,'teacher');
 insert into public.quran_platform_classes(id,organization_id,teacher_id,name,program)
 values(cls,org,teacher,'QA context','{"juz":[30],"surahs":[]}');
 insert into public.quran_platform_students(id,organization_id,class_id,profile_id,display_name)
 values(pupil,org,cls,learner,'QA student');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',teacher,'role','authenticated','aal','aal1')::text,true);
 result:=public.quran_portal('context');
 assert result#>>'{profile,id}'=teacher::text,'Teacher profile identity';
 assert jsonb_array_length(result->'organizations')=1,'Teacher has only own organization';
 assert result#>>'{organizations,0,id}'=org::text,'Organization alias resolves correctly';
 assert result#>>'{organizations,0,role}'='teacher','Teacher role preserved';
 assert result#>>'{organizations,0,enabled}'='true','Active licence visible';
 assert jsonb_array_length(result->'students')=0,'No unrelated pupil profiles';
 denied:=false;begin perform public.quran_portal('admin_snapshot');exception when insufficient_privilege then denied:=true;end;
 assert denied,'Teacher cannot access administration';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',learner,'role','authenticated','aal','aal1')::text,true);
 result:=public.quran_portal('context');
 assert jsonb_array_length(result->'organizations')=0,'Pupil cannot access teacher workspace';
 assert jsonb_array_length(result->'students')=1,'Pupil has only own student account';
 assert result#>>'{students,0,id}'=pupil::text,'Student alias resolves correctly';
 assert result#>>'{students,0,className}'='QA context','Class alias resolves correctly';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',administrator,'role','authenticated','aal','aal1')::text,true);
 result:=public.quran_portal('context');
 assert result->>'needsMfa'='true' and result->>'admin'='false','MFA still required';
 denied:=false;begin perform public.quran_portal('admin_snapshot');exception when insufficient_privilege then denied:=true;end;
 assert denied,'Admin without MFA cannot read administrative records';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',administrator,'role','authenticated','aal','aal2')::text,true);
 result:=public.quran_portal('admin_snapshot');
 assert exists(select 1 from jsonb_array_elements(result->'organizations') x where x->>'id'=org::text),'Admin sees actual organization rows';
 assert exists(select 1 from jsonb_array_elements(result->'licenses') x where x->>'organization_id'=org::text),'Admin sees actual licence rows';
 assert exists(select 1 from jsonb_array_elements(result->'classes') x where x->>'id'=cls::text and not x?'program'),'Admin class summaries';
 assert exists(select 1 from jsonb_array_elements(result->'students') x where x->>'id'=pupil::text and not x?'learning'),'Admin student summaries';
end $test$;
rollback;
select 'PASS: context teacher/pupil; admin MFA; snapshots; all fixtures rolled back' as audit_result;
