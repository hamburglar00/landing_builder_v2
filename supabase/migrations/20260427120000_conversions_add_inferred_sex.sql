alter table public.conversions
  add column if not exists inferred_sex text not null default 'unknown';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'conversions_inferred_sex_check'
  ) then
    alter table public.conversions
      add constraint conversions_inferred_sex_check
      check (inferred_sex in ('male', 'female', 'unknown'));
  end if;
end $$;

comment on column public.conversions.inferred_sex is
  'Sexo inferido desde cuit_cuil: 20/23 => male, 27 => female, resto => unknown.';

create or replace function public.set_conversions_inferred_sex()
returns trigger
language plpgsql
as $$
declare
  prefix text;
begin
  prefix := substring(regexp_replace(coalesce(new.cuit_cuil, ''), '\D', '', 'g') from 1 for 2);
  new.inferred_sex := case
    when prefix in ('20', '23') then 'male'
    when prefix = '27' then 'female'
    else 'unknown'
  end;
  return new;
end;
$$;

drop trigger if exists trg_set_conversions_inferred_sex on public.conversions;
create trigger trg_set_conversions_inferred_sex
before insert or update of cuit_cuil on public.conversions
for each row
execute function public.set_conversions_inferred_sex();

update public.conversions
set inferred_sex = case
  when substring(regexp_replace(coalesce(cuit_cuil, ''), '\D', '', 'g') from 1 for 2) in ('20', '23') then 'male'
  when substring(regexp_replace(coalesce(cuit_cuil, ''), '\D', '', 'g') from 1 for 2) = '27' then 'female'
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
      select 'inferred_sex'::text as x, 9999 as ord
    ) s
    group by x
  ) dedup
)
where not (coalesce(visible_columns, array[]::text[]) @> array['inferred_sex']);
