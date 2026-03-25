create sequence if not exists public.conversions_internal_id_seq;

alter table if exists public.conversions
  add column if not exists internal_id bigint;

alter table if exists public.conversions
  alter column internal_id set default nextval('public.conversions_internal_id_seq');

with base as (
  select coalesce(max(internal_id), 0) as max_id
  from public.conversions
),
ranked as (
  select c.id, row_number() over (order by c.created_at, c.id) as rn
  from public.conversions c
  where c.internal_id is null
)
update public.conversions c
set internal_id = b.max_id + r.rn
from ranked r
cross join base b
where c.id = r.id;

select setval(
  'public.conversions_internal_id_seq',
  coalesce((select max(internal_id) from public.conversions), 0),
  true
);

create unique index if not exists conversions_internal_id_key
  on public.conversions(internal_id);

