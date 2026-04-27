-- Hardening dedupe keys for CONTACT idempotency.
-- 1) Normalize and clean historical duplicates that would violate new unique indexes.
-- 2) Add DB-level unique indexes to avoid race-condition duplicates on concurrent inserts.

-- Normalize keys (trim whitespace only).
update public.conversions
set contact_event_id = btrim(contact_event_id)
where contact_event_id <> btrim(contact_event_id);

update public.conversions
set promo_code = btrim(promo_code)
where promo_code <> btrim(promo_code);

-- Clear duplicate contact_event_id values on non-canonical rows.
with ranked as (
  select
    c.id,
    row_number() over (
      partition by c.user_id, c.contact_event_id
      order by
        case c.estado
          when 'purchase' then 3
          when 'lead' then 2
          when 'contact' then 1
          else 0
        end desc,
        case when coalesce(c.purchase_event_id, '') <> '' then 1 else 0 end desc,
        case when coalesce(c.lead_event_id, '') <> '' then 1 else 0 end desc,
        c.created_at asc,
        c.id asc
    ) as rn
  from public.conversions c
  where coalesce(c.contact_event_id, '') <> ''
),
to_clear as (
  select id
  from ranked
  where rn > 1
)
update public.conversions c
set
  contact_event_id = '',
  contact_event_time = null,
  observaciones = case
    when coalesce(c.observaciones, '') = '' then 'dedupe:contact_event_id'
    when c.observaciones like '%dedupe:contact_event_id%' then c.observaciones
    else c.observaciones || '|dedupe:contact_event_id'
  end
from to_clear d
where c.id = d.id
  and coalesce(c.contact_event_id, '') <> '';

-- Clear duplicate promo_code values among CONTACT rows only.
-- (We intentionally allow repeated promo_code on purchase_type='repeat' rows.)
with ranked as (
  select
    c.id,
    row_number() over (
      partition by c.user_id, c.promo_code
      order by
        c.created_at asc,
        c.id asc
    ) as rn
  from public.conversions c
  where coalesce(c.promo_code, '') <> ''
    and c.estado = 'contact'
),
to_clear as (
  select id
  from ranked
  where rn > 1
)
update public.conversions c
set
  promo_code = '',
  observaciones = case
    when coalesce(c.observaciones, '') = '' then 'dedupe:promo_code'
    when c.observaciones like '%dedupe:promo_code%' then c.observaciones
    else c.observaciones || '|dedupe:promo_code'
  end
from to_clear d
where c.id = d.id
  and coalesce(c.promo_code, '') <> ''
  and c.estado = 'contact';

create unique index if not exists conversions_user_contact_event_id_uidx
  on public.conversions (user_id, contact_event_id)
  where contact_event_id <> '';

create unique index if not exists conversions_user_promo_code_contact_uidx
  on public.conversions (user_id, promo_code)
  where promo_code <> ''
    and estado = 'contact';

