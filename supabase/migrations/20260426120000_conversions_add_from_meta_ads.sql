alter table public.conversions
  add column if not exists from_meta_ads boolean not null default false;

comment on column public.conversions.from_meta_ads is
  'True cuando la conversion tiene fbc (senial fuerte de origen en Meta Ads).';

update public.conversions
set from_meta_ads = coalesce(fbc, '') <> '';

create or replace function public.set_conversions_from_meta_ads()
returns trigger
language plpgsql
as $$
begin
  new.from_meta_ads := coalesce(new.fbc, '') <> '';
  return new;
end;
$$;

drop trigger if exists trg_set_conversions_from_meta_ads on public.conversions;
create trigger trg_set_conversions_from_meta_ads
before insert or update on public.conversions
for each row
execute function public.set_conversions_from_meta_ads();

update public.conversions_config
set visible_columns = (
  select array_agg(x order by ord)
  from (
    select x, min(ord) as ord
    from (
      select x, ord
      from unnest(coalesce(visible_columns, array[]::text[])) with ordinality as t(x, ord)
      union all
      select 'from_meta_ads'::text as x, 9999 as ord
    ) s
    group by x
  ) d
)
where not (coalesce(visible_columns, array[]::text[]) @> array['from_meta_ads']);
