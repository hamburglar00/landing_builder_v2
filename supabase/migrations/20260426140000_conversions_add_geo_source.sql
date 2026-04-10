alter table public.conversions
  add column if not exists geo_source text not null default 'none';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'conversions_geo_source_check'
  ) then
    alter table public.conversions
      add constraint conversions_geo_source_check
      check (geo_source in ('payload', 'ip', 'phone_prefix', 'none'));
  end if;
end $$;

comment on column public.conversions.geo_source is
  'Fuente de geolocalizacion usada para la fila: payload, ip, phone_prefix o none.';

update public.conversions
set geo_source =
  case
    when coalesce(ct, '') <> '' or coalesce(st, '') <> '' or coalesce(country, '') <> '' or coalesce(zip, '') <> '' then 'payload'
    else 'none'
  end
where coalesce(geo_source, '') = '' or geo_source is null;

update public.conversions_config
set visible_columns = (
  select array_agg(x order by ord)
  from (
    select x, min(ord) as ord
    from (
      select x, ord
      from unnest(coalesce(visible_columns, array[]::text[])) with ordinality as t(x, ord)
      union all
      select 'geo_source'::text as x, 9999 as ord
    ) s
    group by x
  ) d
)
where not (coalesce(visible_columns, array[]::text[]) @> array['geo_source']);
