-- The API2 durable intent serializes creation. Permit bounded recovery of that same
-- identity instead of treating every failed request as a 45-second creation lock.
do $$
declare target regprocedure; definition text; revised text; changed integer:=0;
begin
 for target in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname in ('resolve_template7_start_context','resolve_template8_start_context')
 loop
   definition:=pg_get_functiondef(target);
   revised:=replace(definition, ', 1, 45)', ', 4, 10)');
   if revised=definition then raise exception 'Expected entry rate limit not found in %',target;end if;
   execute revised;
   changed:=changed+1;
 end loop;
 if changed<>2 then raise exception 'Expected exactly two entry context functions, found %',changed;end if;
end $$;
