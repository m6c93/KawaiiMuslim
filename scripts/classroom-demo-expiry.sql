-- Run with the migration inside BEGIN ... ROLLBACK. All fixtures are test-only.
set local role anon;
do $$
declare owner text:=repeat('d',64); child text; r jsonb; c jsonb; deadline timestamptz;
begin
 c:='{"id":"expiry-test","name":"Essai expiration","juz":[30],"surahs":[],"students":[{"id":"expire-me","name":"Temporaire","trees":{},"submissions":[],"demoExpiresAt":"2099-01-01"},{"id":"keep-me","name":"Reste actif","trees":{},"submissions":[]}]}';
 perform public.quran_demo('create',jsonb_build_object('owner',owner,'data',jsonb_build_object('classes',jsonb_build_array(c))));
 r:=public.quran_demo('invite','{"class":"expiry-test","student":"expire-me"}',owner);child:=r->>'token';deadline:=(r->>'expiresAt')::timestamptz;
 if abs(extract(epoch from deadline-now()-interval '48 hours'))>1 then raise exception 'New pupil is not exactly 48 hours';end if;
 if (public.quran_demo('context','{}',child)->>'expiresAt')::timestamptz<>deadline then raise exception 'Student sees wrong deadline';end if;
 c:=public.quran_demo('classes','{}',owner)#>'{classes,0}';
 c:=jsonb_set(c,'{students,0,demoExpiresAt}','"2099-01-01"');
 c:=public.quran_demo('save_class',jsonb_build_object('class',c,'revision',1),owner);
 if (c#>>'{students,0,demoExpiresAt}')::timestamptz<>deadline then raise exception 'Teacher extended deadline';end if;
 if (public.quran_demo('invite','{"class":"expiry-test","student":"expire-me"}',owner)->>'expiresAt')::timestamptz<>deadline then raise exception 'Copying link renewed lifetime';end if;
 perform public.quran_demo('chat_configure','{"class":"expiry-test","enabled":true}',owner);
 perform public.quran_demo('chat_send','{"student":"expire-me","id":"30000000-0000-0000-0000-000000000001","text":"Temporary conversation"}',child);
 perform public.quran_demo('audio_save','{"class":"expiry-test","student":"expire-me","id":"30000000-0000-0000-0000-000000000002","mime":"audio/webm","data":"dGVzdA=="}',child);
 begin perform public.quran_demo_purge();raise exception 'Anonymous purge allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$
declare session uuid; r jsonb; token text;
begin
 select id into session from public.quran_demo_sessions where teacher_hash=encode(extensions.digest(repeat('d',64),'sha256'),'hex');
 update public.quran_demo_sessions set data=jsonb_set(data,'{classes,0,students,0,demoExpiresAt}',to_jsonb(now()-interval '1 second')) where id=session;
 -- The same cleanup invoked by the scheduler, without any open application.
 if public.quran_demo_purge(session)<>1 then raise exception 'Expired pupil not removed';end if;
 select data into r from public.quran_demo_sessions where id=session;
 if jsonb_array_length(r#>'{classes,0,students}')<>1 or r#>>'{classes,0,students,0,id}'<>'keep-me' then raise exception 'Wrong pupil deleted';end if;
 if exists(select 1 from public.quran_demo_links where session_id=session and student_id='expire-me') then raise exception 'Link not deleted';end if;
 if exists(select 1 from public.quran_demo_audio where session_id=session and student_id='expire-me') then raise exception 'Audio not deleted';end if;
 if (select chat#>'{threads,expire-me}' from public.quran_demo_sessions where id=session) is not null then raise exception 'Conversation not deleted';end if;
 if (r#>>'{classes,0,revision}')::integer<>3 then raise exception 'Cleanup did not invalidate stale writes';end if;
 token:=encode(extensions.hmac(session::text||':expiry-test:expire-me',repeat('d',64),'sha256'),'hex');
 begin perform public.quran_demo('classes','{}',token);raise exception 'Expired link still works';exception when insufficient_privilege then null;end;
 if public.quran_demo_purge(session)<>0 then raise exception 'Cleanup is not idempotent';end if;
end $$;
set local role anon;
do $$
declare owner text:=repeat('d',64); c jsonb; result jsonb;
begin
 c:=public.quran_demo('classes','{}',owner)#>'{classes,0}';
 c:=jsonb_set(c,'{students}',c->'students'||'[{"id":"new-later","name":"Nouvel élève","trees":{},"submissions":[]}]');
 result:=public.quran_demo('save_class',jsonb_build_object('class',c,'revision',3),owner);
 if abs(extract(epoch from (result#>>'{students,1,demoExpiresAt}')::timestamptz-now()-interval '48 hours'))>1 then raise exception 'Future pupil has no independent 48-hour lifetime';end if;
 if public.quran_demo('invite','{"class":"expiry-test","student":"new-later"}',owner)->>'token' is null then raise exception 'Future pupil cannot share';end if;
end $$;
reset role;
select 'PASS: 48-hour deadlines, future pupils, no renewal, targeted automatic deletion, messages/audio/links removed' as result;
