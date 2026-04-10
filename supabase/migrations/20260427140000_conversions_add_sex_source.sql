alter table public.conversions
  add column if not exists sex_source text not null default 'unknown';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'conversions_sex_source_check'
  ) then
    alter table public.conversions
      add constraint conversions_sex_source_check
      check (sex_source in ('cuit_cuil', 'name_catalog', 'unknown'));
  end if;
end $$;

comment on column public.conversions.sex_source is
  'Fuente del sexo inferido: cuit_cuil, name_catalog o unknown.';

create or replace function public.set_conversions_sex_fields()
returns trigger
language plpgsql
as $$
declare
  prefix text;
begin
  prefix := substring(regexp_replace(coalesce(new.cuit_cuil, ''), '\D', '', 'g') from 1 for 2);
  if prefix in ('20', '23') then
    new.inferred_sex := 'male';
    new.sex_source := 'cuit_cuil';
  elsif prefix = '27' then
    new.inferred_sex := 'female';
    new.sex_source := 'cuit_cuil';
  else
    new.inferred_sex := 'unknown';
    new.sex_source := 'unknown';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_conversions_inferred_sex on public.conversions;
drop trigger if exists trg_set_conversions_sex_fields on public.conversions;
create trigger trg_set_conversions_sex_fields
before insert or update of cuit_cuil on public.conversions
for each row
execute function public.set_conversions_sex_fields();

update public.conversions
set
  inferred_sex = case
    when substring(regexp_replace(coalesce(cuit_cuil, ''), '\D', '', 'g') from 1 for 2) in ('20', '23') then 'male'
    when substring(regexp_replace(coalesce(cuit_cuil, ''), '\D', '', 'g') from 1 for 2) = '27' then 'female'
    else inferred_sex
  end,
  sex_source = case
    when substring(regexp_replace(coalesce(cuit_cuil, ''), '\D', '', 'g') from 1 for 2) in ('20', '23', '27') then 'cuit_cuil'
    when coalesce(sex_source, '') in ('cuit_cuil', 'name_catalog') then sex_source
    else 'unknown'
  end;

update public.conversions_config
set visible_columns = (
  select array_agg(x order by min_ord)
  from (
    select x, min(ord) as min_ord
    from (
      select x, ord
      from unnest(coalesce(visible_columns, array[]::text[])) with ordinality as t(x, ord)
      union all
      select 'sex_source'::text as x, 9999 as ord
    ) s
    group by x
  ) dedup
)
where not (coalesce(visible_columns, array[]::text[]) @> array['sex_source']);
