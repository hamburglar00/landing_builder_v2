set statement_timeout = '10min';

create or replace function pg_temp.try_parse_conversion_payload(value text)
returns jsonb
language plpgsql
as $$
begin
  if nullif(trim(coalesce(value, '')), '') is null then
    return '{}'::jsonb;
  end if;
  return value::jsonb;
exception when others then
  return '{}'::jsonb;
end;
$$;

with payloads as (
  select id, pg_temp.try_parse_conversion_payload(lead_payload_raw) as payload
  from public.conversions
  where lead_payload_raw <> ''
    and (lead_bot_phone = '' or lead_agency_id = '' or lead_player_username = '' or lead_incoming_promo_code = '')
)
update public.conversions c
set
  lead_bot_phone = coalesce(nullif(regexp_replace(coalesce(p.payload ->> 'bot_phone', ''), '\D', '', 'g'), ''), c.lead_bot_phone),
  lead_agency_id = coalesce(nullif(trim(coalesce(p.payload ->> 'agency_id', '')), ''), c.lead_agency_id),
  lead_player_username = coalesce(nullif(trim(coalesce(p.payload ->> 'player_username', '')), ''), c.lead_player_username),
  lead_incoming_promo_code = coalesce(
    nullif(trim(coalesce(p.payload ->> 'promo_code', p.payload ->> 'promoCode', '')), ''),
    nullif(c.lead_incoming_promo_code, ''),
    c.promo_code,
    ''
  )
from payloads p
where c.id = p.id;

with payloads as (
  select id, pg_temp.try_parse_conversion_payload(registration_payload_raw) as payload
  from public.conversions
  where registration_payload_raw <> ''
    and (registration_bot_phone = '' or registration_agency_id = '' or registration_player_username = '' or registration_incoming_promo_code = '')
)
update public.conversions c
set
  registration_bot_phone = coalesce(nullif(regexp_replace(coalesce(p.payload ->> 'bot_phone', ''), '\D', '', 'g'), ''), c.registration_bot_phone),
  registration_agency_id = coalesce(nullif(trim(coalesce(p.payload ->> 'agency_id', '')), ''), c.registration_agency_id),
  registration_player_username = coalesce(nullif(trim(coalesce(p.payload ->> 'player_username', '')), ''), c.registration_player_username),
  registration_incoming_promo_code = coalesce(
    nullif(trim(coalesce(p.payload ->> 'promo_code', p.payload ->> 'promoCode', '')), ''),
    nullif(c.registration_incoming_promo_code, ''),
    c.promo_code,
    ''
  )
from payloads p
where c.id = p.id;

with payloads as (
  select id, pg_temp.try_parse_conversion_payload(purchase_payload_raw) as payload
  from public.conversions
  where purchase_payload_raw <> ''
    and (purchase_bot_phone = '' or purchase_agency_id = '' or purchase_player_username = '' or purchase_incoming_promo_code = '')
)
update public.conversions c
set
  purchase_bot_phone = coalesce(nullif(regexp_replace(coalesce(p.payload ->> 'bot_phone', ''), '\D', '', 'g'), ''), c.purchase_bot_phone),
  purchase_agency_id = coalesce(nullif(trim(coalesce(p.payload ->> 'agency_id', '')), ''), c.purchase_agency_id),
  purchase_player_username = coalesce(nullif(trim(coalesce(p.payload ->> 'player_username', '')), ''), c.purchase_player_username),
  purchase_incoming_promo_code = coalesce(
    nullif(trim(coalesce(p.payload ->> 'promo_code', p.payload ->> 'promoCode', '')), ''),
    nullif(c.purchase_incoming_promo_code, ''),
    c.promo_code,
    ''
  )
from payloads p
where c.id = p.id;

with resolved as (
  select
    c.id as conversion_id,
    g.id as internal_id,
    g.gerencia_id as external_id,
    coalesce(nullif(trim(g.nombre), ''), format('Gerencia %s', coalesce(g.gerencia_id, g.id))) as name,
    row_number() over (partition by c.id order by g.id) as rn
  from public.conversions c
  join public.gerencias g on g.user_id = c.user_id and g.gerencia_id::text = c.lead_agency_id
  where c.lead_event_id <> '' and c.lead_agency_id <> ''
)
update public.conversions c
set
  lead_gerencia_id = r.internal_id,
  lead_gerencia_external_id = coalesce(r.external_id, r.internal_id),
  lead_gerencia_name = r.name,
  lead_gerencia_label = format('%s (ID %s)', r.name, coalesce(r.external_id, r.internal_id)),
  lead_attribution_status = case
    when c.lead_attribution_status = '' or c.lead_gerencia_id is distinct from r.internal_id then 'ensure_backfill_agency_id'
    else c.lead_attribution_status
  end
from resolved r
where c.id = r.conversion_id
  and r.rn = 1
  and (c.lead_gerencia_id is distinct from r.internal_id or c.lead_gerencia_label = '');

with resolved as (
  select
    c.id as conversion_id,
    g.id as internal_id,
    g.gerencia_id as external_id,
    coalesce(nullif(trim(g.nombre), ''), format('Gerencia %s', coalesce(g.gerencia_id, g.id))) as name,
    row_number() over (partition by c.id order by g.id) as rn
  from public.conversions c
  join public.gerencias g on g.user_id = c.user_id and g.gerencia_id::text = c.registration_agency_id
  where c.registration_event_id <> '' and c.registration_agency_id <> ''
)
update public.conversions c
set
  registration_gerencia_id = r.internal_id,
  registration_gerencia_external_id = coalesce(r.external_id, r.internal_id),
  registration_gerencia_name = r.name,
  registration_gerencia_label = format('%s (ID %s)', r.name, coalesce(r.external_id, r.internal_id)),
  registration_attribution_status = case
    when c.registration_attribution_status = '' or c.registration_gerencia_id is distinct from r.internal_id then 'ensure_backfill_agency_id'
    else c.registration_attribution_status
  end
from resolved r
where c.id = r.conversion_id
  and r.rn = 1
  and (c.registration_gerencia_id is distinct from r.internal_id or c.registration_gerencia_label = '');

with resolved as (
  select
    c.id as conversion_id,
    g.id as internal_id,
    g.gerencia_id as external_id,
    coalesce(nullif(trim(g.nombre), ''), format('Gerencia %s', coalesce(g.gerencia_id, g.id))) as name,
    row_number() over (partition by c.id order by g.id) as rn
  from public.conversions c
  join public.gerencias g on g.user_id = c.user_id and g.gerencia_id::text = c.purchase_agency_id
  where c.purchase_event_id <> '' and c.purchase_agency_id <> ''
)
update public.conversions c
set
  purchase_gerencia_id = r.internal_id,
  purchase_gerencia_external_id = coalesce(r.external_id, r.internal_id),
  purchase_gerencia_name = r.name,
  purchase_gerencia_label = format('%s (ID %s)', r.name, coalesce(r.external_id, r.internal_id)),
  purchase_attribution_status = case
    when c.purchase_attribution_status = '' or c.purchase_gerencia_id is distinct from r.internal_id then 'ensure_backfill_agency_id'
    else c.purchase_attribution_status
  end
from resolved r
where c.id = r.conversion_id
  and r.rn = 1
  and (c.purchase_gerencia_id is distinct from r.internal_id or c.purchase_gerencia_label = '');

update public.conversions
set lead_attribution_status = 'ensure_backfill_unresolved'
where lead_event_id <> '' and lead_attribution_status = '';

update public.conversions
set registration_attribution_status = 'ensure_backfill_unresolved'
where registration_event_id <> '' and registration_attribution_status = '';

update public.conversions
set purchase_attribution_status = 'ensure_backfill_unresolved'
where purchase_event_id <> '' and purchase_attribution_status = '';
