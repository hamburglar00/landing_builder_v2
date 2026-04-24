-- Backfill de conversion_id en conversion_inbox para LEAD procesados historicos.
-- Prioridad de enlace:
-- 1) promo_code (si existe)
-- 2) action_event_id encontrado en lead_payload_raw
-- 3) fallback visual: match_mode bot_phone+dateTime por telefono_asignado + ventana temporal

-- 1) Match por promo_code
update public.conversion_inbox i
set conversion_id = (
  select c.id
  from public.conversions c
  where c.user_id = i.user_id
    and c.promo_code = i.promo_code
  order by abs(extract(epoch from (c.created_at - i.created_at))) asc
  limit 1
)
where i.action = 'LEAD'
  and i.status = 'processed'
  and i.conversion_id is null
  and coalesce(i.promo_code, '') <> '';

-- 2) Match por action_event_id dentro de lead_payload_raw
update public.conversion_inbox i
set conversion_id = (
  select c.id
  from public.conversions c
  where c.user_id = i.user_id
    and coalesce(i.action_event_id, '') <> ''
    and (
      c.lead_payload_raw like ('%"action_event_id":"' || i.action_event_id || '"%')
      or c.lead_payload_raw like ('%"action_event_id":' || i.action_event_id || '%')
    )
  order by abs(extract(epoch from (c.created_at - i.created_at))) asc
  limit 1
)
where i.action = 'LEAD'
  and i.status = 'processed'
  and i.conversion_id is null
  and coalesce(i.action_event_id, '') <> '';

-- 3) Match por fallback bot_phone + dateTime para filas marcadas en response_body
with inbox_candidates as (
  select
    i.id,
    i.user_id,
    regexp_replace(coalesce(i.payload_raw::jsonb->>'bot_phone', ''), '\\D', '', 'g') as bot_phone,
    coalesce(
      nullif(i.payload_raw::jsonb->>'dateTime', ''),
      nullif(i.payload_raw::jsonb->>'datetime', '')
    ) as dt_iso,
    i.created_at
  from public.conversion_inbox i
  where i.action = 'LEAD'
    and i.status = 'processed'
    and i.conversion_id is null
    and lower(coalesce(i.response_body, '')) like '%match_mode:bot_phone+datetime%'
), matched as (
  select
    ic.id as inbox_id,
    (
      select c.id
      from public.conversions c
      where c.user_id = ic.user_id
        and c.telefono_asignado = ic.bot_phone
        and c.created_at between ((ic.dt_iso)::timestamptz - interval '90 seconds') and ((ic.dt_iso)::timestamptz + interval '90 seconds')
      order by abs(extract(epoch from (c.created_at - (ic.dt_iso)::timestamptz))) asc
      limit 1
    ) as conversion_id
  from inbox_candidates ic
  where ic.bot_phone <> ''
    and ic.dt_iso is not null
)
update public.conversion_inbox i
set conversion_id = m.conversion_id
from matched m
where i.id = m.inbox_id
  and m.conversion_id is not null
  and i.conversion_id is null;
