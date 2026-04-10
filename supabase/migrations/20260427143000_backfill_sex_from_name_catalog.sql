-- Backfill seguro: solo filas sin inferencia previa.
-- No toca filas ya inferidas por cuit_cuil ni por name_catalog.

with candidates as (
  select
    c.id,
    n.inferred_sex
  from public.conversions c
  join public.ar_name_inferred_sex n
    on n.name_key = regexp_replace(
      upper(split_part(coalesce(c.fn, ''), ' ', 1)),
      '[^A-Z''-]',
      '',
      'g'
    )
  where coalesce(c.inferred_sex, 'unknown') = 'unknown'
    and coalesce(c.sex_source, 'unknown') = 'unknown'
    and coalesce(trim(c.fn), '') <> ''
)
update public.conversions c
set
  inferred_sex = case
    when candidates.inferred_sex = 'm' then 'male'
    when candidates.inferred_sex = 'f' then 'female'
    else 'unknown'
  end,
  sex_source = case
    when candidates.inferred_sex in ('m', 'f') then 'name_catalog'
    else 'unknown'
  end
from candidates
where c.id = candidates.id;
