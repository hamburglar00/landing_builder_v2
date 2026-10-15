begin;
set local statement_timeout = '30s';
insert into auth.users(id,email,raw_app_meta_data) values
 ('91000000-0000-4000-8000-000000000001','url-owner@example.invalid','{"panelbot_admin_created":true}'),
 ('91000000-0000-4000-8000-000000000002','url-other@example.invalid','{"panelbot_admin_created":true}');
insert into public.profiles(id,role,nombre) values
 ('91000000-0000-4000-8000-000000000001','client','goldencajeros'),
 ('91000000-0000-4000-8000-000000000002','client','other')
 on conflict (id) do update set nombre=excluded.nombre;
insert into public.gerencias(id,user_id,nombre,gerencia_id) values
 (9101,'91000000-0000-4000-8000-000000000001','Synthetic',9101);
insert into public.gerencia_phones(id,gerencia_id,phone,status,kind,assignment_role)
 values (9101,9101,'5491100000001','active','carga','acquisition');
insert into public.landings(id,user_id,name,landing_config,config,publish_target) values
 ('91000000-0000-4000-8000-000000000011','91000000-0000-4000-8000-000000000001','url-a','{}','{}','classic'),
 ('91000000-0000-4000-8000-000000000012','91000000-0000-4000-8000-000000000001','url-b','{}','{}','classic'),
 ('91000000-0000-4000-8000-000000000013','91000000-0000-4000-8000-000000000002','url-foreign','{}','{}','classic'),
 ('91000000-0000-4000-8000-000000000014','91000000-0000-4000-8000-000000000001','url-draft',null,'{}','classic'),
 ('91000000-0000-4000-8000-000000000015','91000000-0000-4000-8000-000000000001','url-constructor','{}','{}','constructor'),
 ('91000000-0000-4000-8000-000000000016','91000000-0000-4000-8000-000000000001','url-atrio','{}','{"ctaDestination":"atrio"}','classic');
insert into public.landings_gerencias(landing_id,gerencia_id,weight,phone_kind)
 select id,9101,100,'carga' from public.landings where name like 'url-%';

do $$
declare selected text; seen text[] := '{}'; i integer;
begin
  for i in 1..100 loop
    selected := public.get_random_active_landing('goldencajeros');
    if selected is null or selected not in ('url-a','url-b') then raise exception 'Fallback escaped scope'; end if;
    if not selected = any(seen) then seen := seen || selected; end if;
  end loop;
  if cardinality(seen) <> 2 then raise exception 'Fallback is not distributed'; end if;
  if public.get_random_active_landing('missing') is not null or public.get_random_active_landing('') is not null then
    raise exception 'Unknown client must have no fallback';
  end if;
  if has_function_privilege('anon','public.get_random_active_landing(text)','execute')
    or has_function_privilege('authenticated','public.get_random_active_landing(text)','execute')
    or not has_function_privilege('service_role','public.get_random_active_landing(text)','execute') then
    raise exception 'Invalid fallback ACL';
  end if;
end $$;

update public.gerencia_phones set status='inactive' where id=9101;
do $$ begin
 if public.get_random_active_landing('goldencajeros') is not null then raise exception 'Inactive phone selected'; end if;
end $$;
update public.gerencia_phones set status='active',assignment_role='follow_up' where id=9101;
do $$ begin
 if public.get_random_active_landing('goldencajeros') is not null then raise exception 'Sales phone selected'; end if;
end $$;
update public.gerencia_phones set assignment_role='acquisition',kind='ads' where id=9101;
do $$ begin
 if public.get_random_active_landing('goldencajeros') is not null then raise exception 'Wrong phone kind selected'; end if;
end $$;
update public.gerencia_phones set kind='carga' where id=9101;
update public.landings_gerencias set weight=0;
do $$ begin
 if public.get_random_active_landing('goldencajeros') is not null then raise exception 'Zero weighted assignment selected'; end if;
end $$;
update public.landings_gerencias set weight=100,
 interval_start_hour=(extract(hour from now() at time zone 'America/Argentina/Buenos_Aires')::int+1)%24,
 interval_end_hour=(extract(hour from now() at time zone 'America/Argentina/Buenos_Aires')::int+2)%24;
do $$ begin
 if public.get_random_active_landing('goldencajeros') is not null then raise exception 'Closed schedule selected'; end if;
end $$;
update public.landings_gerencias set interval_start_hour=null,interval_end_hour=null;

insert into public.conversions(user_id,landing_id,landing_name,landing,campana,conjunto,anuncio,utm_campaign,phone,contact_event_id)
 values ('91000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000011','url-a','url-a','October campaign','set-A','ad-A','legacy','5491100000002','url-test-contact');
insert into public.conversions(user_id,landing,campana)
 values ('91000000-0000-4000-8000-000000000002','foreign','October campaign');

set local role authenticated;
set local request.jwt.claim.sub = '91000000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated"}';
do $$
declare report jsonb; row_data jsonb; kind text; needle text;
begin
  foreach kind in array array['table','export'] loop
    foreach needle in array array['url-a','October campaign','set-A','ad-A'] loop
      report := public.get_conversion_report(jsonb_build_object('view',kind,'options',
        jsonb_build_object('search',needle,'columns',jsonb_build_array('landing','campana','conjunto','anuncio','utm_campaign'))));
      if (report#>>'{table,total}')::int is distinct from 1 then raise exception 'Report search/RLS failed: %, %',kind,needle; end if;
      row_data := report#>'{table,rows,0}';
      if row_data->>'landing' is distinct from 'url-a' or row_data->>'campana' is distinct from 'October campaign'
         or row_data->>'conjunto' is distinct from 'set-A' or row_data->>'anuncio' is distinct from 'ad-A'
         or row_data->>'utm_campaign' is distinct from 'legacy' then raise exception 'Report lost attribution'; end if;
    end loop;
  end loop;
end $$;
reset role;
select 'ATTRIBUTION_TESTS_OK';
rollback;
