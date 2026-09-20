-- A newly invited demo teacher starts with no class, and creates their own.
begin;
do $$
declare definition text;
begin
 select pg_get_functiondef('public.quran_demo(text,jsonb,text)'::regprocedure) into definition;
 if strpos(definition,'jsonb_array_length(classes) not between 1 and 10')>0 then
  definition:=replace(definition,'jsonb_array_length(classes) not between 1 and 10','jsonb_array_length(classes) not between 0 and 10');
  definition:=replace(definition,'Choisissez de 1 à 10 classes de démonstration.','Choisissez au maximum 10 classes de démonstration.');
  execute definition;
 elsif strpos(definition,'jsonb_array_length(classes) not between 0 and 10')=0 then
  raise exception 'Version inattendue de quran_demo : migration annulée.';
 end if;
end $$;
commit;
