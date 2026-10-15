-- Campaign metadata is independent of legacy utm_campaign. NULL means unknown.
alter table public.conversions
  add column landing text,
  add column campana text,
  add column conjunto text,
  add column anuncio text;

comment on column public.conversions.landing is 'Resolved public landing slug for this journey.';
comment on column public.conversions.campana is 'URL campana value, preserved across journey events.';
comment on column public.conversions.conjunto is 'URL conjunto value (ad set), preserved across journey events.';
comment on column public.conversions.anuncio is 'URL anuncio value, preserved across journey events.';

-- Preserve the deployed report implementation and its RLS/ACLs. Fail on drift.
do $$
declare definition text; original text;
begin
  select pg_get_functiondef('public.get_conversion_report(jsonb)'::regprocedure) into original;
  definition := replace(original, '''external_id'',''utm_campaign''',
    '''external_id'',''landing'',''campana'',''conjunto'',''anuncio'',''utm_campaign''');
  definition := replace(definition, 'nullif(c.utm_campaign,'''') AS utm_campaign,',
    'c.landing,c.campana,c.conjunto,c.anuncio,nullif(c.utm_campaign,'''') AS utm_campaign,');
  if definition = original or position('c.campana' in definition) = 0
    or position('''campana''' in definition) = 0 then
    raise exception 'Unexpected get_conversion_report definition';
  end if;
  execute definition;

  select pg_get_functiondef('conversions_read.table_search(jsonb,text)'::regprocedure) into original;
  definition := replace(original, '''external_id'',''utm_campaign''',
    '''external_id'',''landing'',''campana'',''conjunto'',''anuncio'',''utm_campaign''');
  if definition = original then raise exception 'Unexpected table_search definition'; end if;
  execute definition;
end $$;

-- Existing customized column selections get the new fields once, and remain editable.
update public.conversions_config
set visible_columns = visible_columns || array(
  select key from unnest(array['landing','campana','conjunto','anuncio']) key
  where not key = any(visible_columns)
)
where coalesce(cardinality(visible_columns), 0) > 0;

-- Server-only read. No phone reservation, counter update, public table grants or RLS bypass.
-- A unique client name is mandatory: ambiguous/missing names produce no fallback.
create function public.get_random_active_landing(p_client_name text)
returns text language sql volatile security invoker set search_path = '' as $$
  with owner as (
    select p.id from public.profiles p
    where lower(btrim(p.nombre)) = lower(btrim(p_client_name))
      and nullif(btrim(p_client_name), '') is not null
  ), eligible as (
    select l.name
    from public.landings l
    where l.user_id in (select id from owner)
      and (select count(*) from owner) = 1
      and coalesce(l.landing_type, 'internal') = 'internal'
      and coalesce(l.publish_target, 'classic') = 'classic'
      and nullif(btrim(l.name), '') is not null
      and l.landing_config is not null
      and coalesce(l.config->>'template', 'template1') <> 'template7'
      and coalesce(l.config->>'ctaDestination', 'whatsapp') <> 'atrio'
      and exists (
        select 1 from public.landings_gerencias lg
        join public.gerencias g on g.id = lg.gerencia_id
        join public.gerencia_phones gp on gp.gerencia_id = g.id
        where lg.landing_id = l.id
          and (coalesce(l.gerencia_selection_mode, 'weighted_random') = 'fair' or lg.weight > 0)
          and gp.status = 'active' and gp.assignment_role = 'acquisition'
          and gp.kind = lg.phone_kind and nullif(btrim(gp.phone), '') is not null
          and (
            lg.interval_start_hour is null or lg.interval_end_hour is null
            or lg.interval_start_hour = lg.interval_end_hour
            or (lg.interval_start_hour < lg.interval_end_hour
                and extract(hour from now() at time zone 'America/Argentina/Buenos_Aires') >= lg.interval_start_hour
                and extract(hour from now() at time zone 'America/Argentina/Buenos_Aires') < lg.interval_end_hour)
            or (lg.interval_start_hour > lg.interval_end_hour
                and (extract(hour from now() at time zone 'America/Argentina/Buenos_Aires') >= lg.interval_start_hour
                  or extract(hour from now() at time zone 'America/Argentina/Buenos_Aires') < lg.interval_end_hour))
          )
      )
  )
  select name from eligible order by random() limit 1;
$$;
revoke all on function public.get_random_active_landing(text) from public, anon, authenticated;
grant execute on function public.get_random_active_landing(text) to service_role;

notify pgrst, 'reload schema';
