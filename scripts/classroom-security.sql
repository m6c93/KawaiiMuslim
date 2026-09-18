-- Run as database owner after quran-classroom-reliability.sql.
-- Synthetic identities have no password. The entire fixture is rolled back.
begin;
do $$
declare
 teacher uuid:=gen_random_uuid(); learner uuid:=gen_random_uuid(); stranger uuid:=gen_random_uuid();
 org uuid:=gen_random_uuid(); cls uuid:=gen_random_uuid(); pupil uuid:=gen_random_uuid(); other uuid:=gen_random_uuid(); unlinked uuid:=gen_random_uuid();
 doc jsonb; result jsonb; data jsonb; invitation jsonb; audio uuid:=gen_random_uuid(); rev bigint; failed boolean;
begin
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
 select id,'qa-'||id::text||'@example.invalid',now(),'{"full_name":"QA transaction"}'::jsonb from unnest(array[teacher,learner,stranger]) id;
 insert into public.profiles(id,email,full_name) select id,'qa-'||id::text||'@example.invalid','QA transaction' from unnest(array[teacher,learner,stranger]) id on conflict(id) do nothing;
 insert into public.quran_organizations(id,name,status) values(org,'QA rollback','active');
 insert into public.quran_licenses(organization_id,student_limit,starts_at,expires_at,status) values(org,3,current_date,current_date+30,'active');
 insert into public.quran_organization_members(organization_id,profile_id,role) values(org,teacher,'teacher');
 insert into public.quran_platform_classes(id,organization_id,teacher_id,name,program) values(cls,org,teacher,'QA classe','{"juz":[30],"surahs":[]}');
 insert into public.quran_platform_students(id,organization_id,class_id,profile_id,display_name)
 values(pupil,org,cls,learner,'QA élève'),(other,org,cls,stranger,'QA autre'),(unlinked,org,cls,null,'QA invitation');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',teacher,'role','authenticated','aal','aal1')::text,true);
 doc:=public.quran_class_document(cls);
 assert jsonb_array_length(doc->'students')=3,'Teacher roster';
 -- The formerly nullable profile check must deny a teacher pretending to save as an unlinked child.
 failed:=false;begin perform public.quran_portal('save_student',jsonb_build_object('student',unlinked,'revision',0,'studentData','{"trees":{},"submissions":[]}'::jsonb));exception when insufficient_privilege then failed:=true;end;
 assert failed,'Unlinked student role must be denied';
 result:=public.quran_portal('save_class',jsonb_build_object('organization',org,'revision',0,'class',doc));
 assert (result->>'revision')::bigint=1,'Teacher save confirmed';
 failed:=false;begin perform public.quran_portal('save_class',jsonb_build_object('organization',org,'revision',0,'class',doc));exception when serialization_failure then failed:=true;end;
 assert failed,'Stale class writes rejected';
 invitation:=public.quran_portal('invite',jsonb_build_object('organization',org,'student',unlinked,'email','qa-'||learner::text||'@example.invalid','name','QA'));
 assert invitation->>'token' is not null,'Invitation token issued';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',learner,'role','authenticated','aal','aal1')::text,true);
 result:=public.quran_portal('classes',jsonb_build_object('organization',org));
 assert jsonb_array_length(result#>'{classes,0,students}')=1,'Student cannot list classmates';
 assert public.quran_class_document(cls)#>>'{students,0,id}'=pupil::text,'Own student only';
 assert not public.quran_audio_allowed(cls::text||'/'||other::text||'/'||audio::text),'Other student audio is private';
 assert public.quran_audio_allowed(cls::text||'/'||pupil::text||'/'||audio::text,true),'Own upload permitted';
 assert not public.quran_audio_allowed(cls::text||'/'||pupil::text||'/verse-comment-'||audio::text,true),'Student cannot impersonate teacher audio';
 data:=jsonb_build_object('trees','{"112":{"verses":[1,2,3,4],"completedAt":"2026-01-01","teacher":"Fake","positions":{"30":{"x":50,"y":60}}}}'::jsonb,'submissions','[]'::jsonb);
 result:=public.quran_portal('save_student',jsonb_build_object('student',pupil,'revision',1,'studentData',data));
 assert result#>'{students,0,trees,112,verses}'='[]'::jsonb,'Only teacher can validate';
 assert result#>'{students,0,trees,112,completedAt}'='null'::jsonb,'Student cannot complete sourate';
 assert result#>>'{students,0,trees,112,positions,30,x}'='50','Placement is preserved';
 assert not has_table_privilege('authenticated','public.quran_platform_students','select'),'No broad student table access';
 failed:=false;begin perform public.quran_portal('save_class',jsonb_build_object('organization',org,'revision',2,'class',doc));exception when insufficient_privilege then failed:=true;end;
 assert failed,'Student teacher-write blocked';
 insert into storage.objects(bucket_id,name) values('quran-classroom-audio',cls::text||'/'||pupil::text||'/'||audio::text);
 data:=jsonb_build_object('trees','{}'::jsonb,'submissions',jsonb_build_array(jsonb_build_object('id',audio,'surah',112,'from',1,'to',5)));
 failed:=false;begin perform public.quran_portal('save_student',jsonb_build_object('student',pupil,'revision',2,'studentData',data));exception when raise_exception then failed:=true;end;
 assert failed,'Submission cannot exceed actual chapter length';
 data:=jsonb_set(data,'{submissions,0,to}','4');
 result:=public.quran_portal('save_student',jsonb_build_object('student',pupil,'revision',2,'studentData',data));
 assert jsonb_array_length(result#>'{students,0,submissions}')=1,'Audio metadata saved';
 result:=public.quran_portal('save_student',jsonb_build_object('student',pupil,'revision',3,'studentData',data));
 assert jsonb_array_length(result#>'{students,0,submissions}')=1,'Idempotent audio retry';
 perform public.quran_portal('accept_invite',jsonb_build_object('token',invitation->>'token'));
 failed:=false;begin perform public.quran_portal('accept_invite',jsonb_build_object('token',invitation->>'token'));exception when raise_exception then failed:=true;end;
 assert failed,'Invitation is single-use';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',teacher,'role','authenticated','aal','aal1')::text,true);
 assert public.quran_audio_allowed(cls::text||'/'||pupil::text||'/'||audio::text),'Teacher can hear own pupil';
 doc:=public.quran_class_document(cls);rev:=(doc->>'revision')::bigint;
 doc:=jsonb_set(doc,'{students}',(doc->'students')||jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'name','Au-delà des places','trees','{}'::jsonb,'submissions','[]'::jsonb)));
 failed:=false;begin perform public.quran_portal('save_class',jsonb_build_object('organization',org,'revision',rev,'class',doc));exception when raise_exception then failed:=true;end;
 assert failed,'Licence capacity enforced';
 update public.quran_licenses set expires_at=current_date-1 where organization_id=org;
 assert not public.quran_student_access(pupil),'Expired licence blocks student access';
 assert not public.quran_teach(cls),'Expired licence blocks teaching';
end;
$$;
select 'PASS: permissions, isolated pupils, invitations, revisions, private audio, actual verse ranges and licence limits' as result;
rollback;
