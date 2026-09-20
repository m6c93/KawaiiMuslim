-- Fix login/admin reads without replacing later authorization or write fixes.
-- Apply after quran-classroom-reliability.sql. No account/data/grant changes.
begin;
do $patch$
declare
 definition text := pg_get_functiondef('public.quran_portal(text,jsonb)'::regprocedure);
 first_at integer; last_at integer; original text; corrected text;
begin
 first_at := strpos(definition, ' if action=''context'' then');
 last_at := strpos(definition, ' if action in (''request_access'',''create_organization'') then');
 if first_at=0 or last_at<=first_at then
  raise exception 'Unexpected quran_portal layout; no changes applied.';
 end if;
 original := substring(definition from first_at for last_at-first_at);
 -- o/l/c/s are also declared row variables in quran_portal. A SELECT alias
 -- sharing their name is ambiguous (and may read the uninitialized variable).
 corrected := regexp_replace(original, '\mo\M', 'context_org', 'g');
 corrected := regexp_replace(corrected, '\ml\M', 'context_license', 'g');
 corrected := regexp_replace(corrected, '\mc\M', 'context_class', 'g');
 corrected := regexp_replace(corrected, '\ms\M', 'context_student', 'g');
 if corrected not like '%public.quran_organizations context_org%'
   or corrected not like '%public.quran_platform_students context_student%'
   or corrected not like '%not admin then raise exception ''Accès administrateur et double vérification requis.''%' then
  raise exception 'Unexpected context or admin query; no changes applied.';
 end if;
 if original<>corrected then
  execute overlay(definition placing corrected from first_at for last_at-first_at);
 end if;
end $patch$;
commit;
