alter table public.conversions
  add column if not exists cuit_cuil text not null default '';

comment on column public.conversions.cuit_cuil is
  'CUIT/CUIL recibido por payload (keys: cuit_cuil, cuitCuil, cuit, cuil, cuit/cuil), normalizado a digitos.';

update public.conversions_config
set visible_columns = (
  select array_agg(x order by min_ord)
  from (
    select x, min(ord) as min_ord
    from (
      select x, ord
      from unnest(coalesce(visible_columns, array[]::text[])) with ordinality as t(x, ord)
      union all
      select 'cuit_cuil'::text as x, 9999 as ord
    ) s
    group by x
  ) dedup
)
where not (coalesce(visible_columns, array[]::text[]) @> array['cuit_cuil']);
