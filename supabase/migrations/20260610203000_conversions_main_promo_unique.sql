-- Enforce one primary conversion row per valid promo_code and client.
-- Repeat purchases may keep the same promo_code; CONTACT/LEAD/FIRST PURCHASE must not.

with ranked as (
  select
    c.id,
    first_value(c.id) over (
      partition by c.user_id, c.promo_code
      order by
        case when coalesce(c.contact_event_id, '') <> '' then 1 else 0 end desc,
        case when coalesce(c.lead_event_id, '') <> '' then 1 else 0 end desc,
        case when coalesce(c.purchase_event_id, '') <> '' then 1 else 0 end desc,
        case c.estado
          when 'purchase' then 3
          when 'lead' then 2
          when 'contact' then 1
          else 0
        end desc,
        c.created_at asc,
        c.id asc
    ) as keeper_id,
    row_number() over (
      partition by c.user_id, c.promo_code
      order by
        case when coalesce(c.contact_event_id, '') <> '' then 1 else 0 end desc,
        case when coalesce(c.lead_event_id, '') <> '' then 1 else 0 end desc,
        case when coalesce(c.purchase_event_id, '') <> '' then 1 else 0 end desc,
        case c.estado
          when 'purchase' then 3
          when 'lead' then 2
          when 'contact' then 1
          else 0
        end desc,
        c.created_at asc,
        c.id asc
    ) as rn
  from public.conversions c
  where coalesce(c.promo_code, '') ~ '^[A-Za-z0-9]+-[A-Za-z0-9]+$'
    and coalesce(c.purchase_type, '') <> 'repeat'
),
duplicates as (
  select id, keeper_id
  from ranked
  where rn > 1
)
update public.conversion_inbox ci
set
  conversion_id = d.keeper_id,
  status = case when ci.action = 'LEAD' then 'deduplicated' else ci.status end,
  response_body = case
    when ci.action = 'LEAD' then 'Duplicado LEAD ignorado (promo_code ya procesado)'
    else ci.response_body
  end,
  processed_at = coalesce(ci.processed_at, now())
from duplicates d
where ci.conversion_id = d.id;

with ranked as (
  select
    c.id,
    row_number() over (
      partition by c.user_id, c.promo_code
      order by
        case when coalesce(c.contact_event_id, '') <> '' then 1 else 0 end desc,
        case when coalesce(c.lead_event_id, '') <> '' then 1 else 0 end desc,
        case when coalesce(c.purchase_event_id, '') <> '' then 1 else 0 end desc,
        case c.estado
          when 'purchase' then 3
          when 'lead' then 2
          when 'contact' then 1
          else 0
        end desc,
        c.created_at asc,
        c.id asc
    ) as rn
  from public.conversions c
  where coalesce(c.promo_code, '') ~ '^[A-Za-z0-9]+-[A-Za-z0-9]+$'
    and coalesce(c.purchase_type, '') <> 'repeat'
),
duplicates as (
  select id
  from ranked
  where rn > 1
)
update public.conversions c
set
  promo_code = '',
  observaciones = case
    when coalesce(c.observaciones, '') = '' then 'dedupe:main_promo_code'
    when c.observaciones like '%dedupe:main_promo_code%' then c.observaciones
    else c.observaciones || ' | dedupe:main_promo_code'
  end
from duplicates d
where c.id = d.id
  and coalesce(c.promo_code, '') <> '';

create unique index if not exists conversions_user_main_promo_code_uidx
  on public.conversions (user_id, promo_code)
  where coalesce(promo_code, '') ~ '^[A-Za-z0-9]+-[A-Za-z0-9]+$'
    and coalesce(purchase_type, '') <> 'repeat';
