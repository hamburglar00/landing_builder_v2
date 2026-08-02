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
  select
    id,
    pg_temp.try_parse_conversion_payload(lead_payload_raw) as lead_payload
  from public.conversions
  where coalesce(lead_payload_raw, '') <> ''
    and (
      lead_bot_phone = ''
      or lead_agency_id = ''
      or lead_player_username = ''
      or lead_incoming_promo_code = ''
    )
)
update public.conversions c
set
  lead_bot_phone = coalesce(nullif(regexp_replace(coalesce(p.lead_payload ->> 'bot_phone', ''), '\D', '', 'g'), ''), c.lead_bot_phone, ''),
  lead_agency_id = coalesce(nullif(trim(coalesce(p.lead_payload ->> 'agency_id', '')), ''), c.lead_agency_id, ''),
  lead_player_username = coalesce(nullif(trim(coalesce(p.lead_payload ->> 'player_username', '')), ''), c.lead_player_username, ''),
  lead_incoming_promo_code = coalesce(
    nullif(trim(coalesce(p.lead_payload ->> 'promo_code', p.lead_payload ->> 'promoCode', '')), ''),
    nullif(c.lead_incoming_promo_code, ''),
    c.promo_code,
    ''
  )
from payloads p
where c.id = p.id;

with payloads as (
  select
    id,
    pg_temp.try_parse_conversion_payload(registration_payload_raw) as registration_payload
  from public.conversions
  where coalesce(registration_payload_raw, '') <> ''
    and (
      registration_bot_phone = ''
      or registration_agency_id = ''
      or registration_player_username = ''
      or registration_incoming_promo_code = ''
    )
)
update public.conversions c
set
  registration_bot_phone = coalesce(nullif(regexp_replace(coalesce(p.registration_payload ->> 'bot_phone', ''), '\D', '', 'g'), ''), c.registration_bot_phone, ''),
  registration_agency_id = coalesce(nullif(trim(coalesce(p.registration_payload ->> 'agency_id', '')), ''), c.registration_agency_id, ''),
  registration_player_username = coalesce(nullif(trim(coalesce(p.registration_payload ->> 'player_username', '')), ''), c.registration_player_username, ''),
  registration_incoming_promo_code = coalesce(
    nullif(trim(coalesce(p.registration_payload ->> 'promo_code', p.registration_payload ->> 'promoCode', '')), ''),
    nullif(c.registration_incoming_promo_code, ''),
    c.promo_code,
    ''
  )
from payloads p
where c.id = p.id;

with payloads as (
  select
    id,
    pg_temp.try_parse_conversion_payload(purchase_payload_raw) as purchase_payload
  from public.conversions
  where coalesce(purchase_payload_raw, '') <> ''
    and (
      purchase_bot_phone = ''
      or purchase_agency_id = ''
      or purchase_player_username = ''
      or purchase_incoming_promo_code = ''
    )
)
update public.conversions c
set
  purchase_bot_phone = coalesce(nullif(regexp_replace(coalesce(p.purchase_payload ->> 'bot_phone', ''), '\D', '', 'g'), ''), c.purchase_bot_phone, ''),
  purchase_agency_id = coalesce(nullif(trim(coalesce(p.purchase_payload ->> 'agency_id', '')), ''), c.purchase_agency_id, ''),
  purchase_player_username = coalesce(nullif(trim(coalesce(p.purchase_payload ->> 'player_username', '')), ''), c.purchase_player_username, ''),
  purchase_incoming_promo_code = coalesce(
    nullif(trim(coalesce(p.purchase_payload ->> 'promo_code', p.purchase_payload ->> 'promoCode', '')), ''),
    nullif(c.purchase_incoming_promo_code, ''),
    c.promo_code,
    ''
  )
from payloads p
where c.id = p.id;

with candidates as (
  select
    c.id as conversion_id,
    g.id as gerencia_internal_id,
    g.gerencia_id as gerencia_external_id,
    coalesce(nullif(trim(g.nombre), ''), format('Gerencia %s', coalesce(g.gerencia_id, g.id))) as gerencia_name,
    row_number() over (partition by c.id order by g.id) as rn
  from public.conversions c
  join public.gerencias g
    on g.user_id = c.user_id
   and g.gerencia_id::text = c.lead_agency_id
  where c.lead_event_id <> ''
    and c.lead_agency_id <> ''
)
update public.conversions c
set
  lead_gerencia_id = x.gerencia_internal_id,
  lead_gerencia_external_id = coalesce(x.gerencia_external_id, x.gerencia_internal_id),
  lead_gerencia_name = x.gerencia_name,
  lead_gerencia_label = format('%s (ID %s)', x.gerencia_name, coalesce(x.gerencia_external_id, x.gerencia_internal_id)),
  lead_attribution_status = case
    when c.lead_attribution_status = '' or c.lead_gerencia_id is distinct from x.gerencia_internal_id
      then 'backfill_agency_id'
    else c.lead_attribution_status
  end
from candidates x
where c.id = x.conversion_id
  and x.rn = 1
  and (
    c.lead_gerencia_id is distinct from x.gerencia_internal_id
    or c.lead_gerencia_label = ''
  );

with candidates as (
  select
    c.id as conversion_id,
    g.id as gerencia_internal_id,
    g.gerencia_id as gerencia_external_id,
    coalesce(nullif(trim(g.nombre), ''), format('Gerencia %s', coalesce(g.gerencia_id, g.id))) as gerencia_name,
    row_number() over (partition by c.id order by g.id) as rn
  from public.conversions c
  join public.gerencias g
    on g.user_id = c.user_id
   and g.gerencia_id::text = c.registration_agency_id
  where c.registration_event_id <> ''
    and c.registration_agency_id <> ''
)
update public.conversions c
set
  registration_gerencia_id = x.gerencia_internal_id,
  registration_gerencia_external_id = coalesce(x.gerencia_external_id, x.gerencia_internal_id),
  registration_gerencia_name = x.gerencia_name,
  registration_gerencia_label = format('%s (ID %s)', x.gerencia_name, coalesce(x.gerencia_external_id, x.gerencia_internal_id)),
  registration_attribution_status = case
    when c.registration_attribution_status = '' or c.registration_gerencia_id is distinct from x.gerencia_internal_id
      then 'backfill_agency_id'
    else c.registration_attribution_status
  end
from candidates x
where c.id = x.conversion_id
  and x.rn = 1
  and (
    c.registration_gerencia_id is distinct from x.gerencia_internal_id
    or c.registration_gerencia_label = ''
  );

with candidates as (
  select
    c.id as conversion_id,
    g.id as gerencia_internal_id,
    g.gerencia_id as gerencia_external_id,
    coalesce(nullif(trim(g.nombre), ''), format('Gerencia %s', coalesce(g.gerencia_id, g.id))) as gerencia_name,
    row_number() over (partition by c.id order by g.id) as rn
  from public.conversions c
  join public.gerencias g
    on g.user_id = c.user_id
   and g.gerencia_id::text = c.purchase_agency_id
  where c.purchase_event_id <> ''
    and c.purchase_agency_id <> ''
)
update public.conversions c
set
  purchase_gerencia_id = x.gerencia_internal_id,
  purchase_gerencia_external_id = coalesce(x.gerencia_external_id, x.gerencia_internal_id),
  purchase_gerencia_name = x.gerencia_name,
  purchase_gerencia_label = format('%s (ID %s)', x.gerencia_name, coalesce(x.gerencia_external_id, x.gerencia_internal_id)),
  purchase_attribution_status = case
    when c.purchase_attribution_status = '' or c.purchase_gerencia_id is distinct from x.gerencia_internal_id
      then 'backfill_agency_id'
    else c.purchase_attribution_status
  end
from candidates x
where c.id = x.conversion_id
  and x.rn = 1
  and (
    c.purchase_gerencia_id is distinct from x.gerencia_internal_id
    or c.purchase_gerencia_label = ''
  );

with unique_phone_matches as (
  select
    c.id as conversion_id,
    min(g.id) as gerencia_internal_id,
    min(g.gerencia_id) as gerencia_external_id,
    min(coalesce(nullif(trim(g.nombre), ''), format('Gerencia %s', coalesce(g.gerencia_id, g.id)))) as gerencia_name
  from public.conversions c
  join public.gerencia_phones gp
    on regexp_replace(coalesce(gp.phone, ''), '\D', '', 'g') = c.lead_bot_phone
  join public.gerencias g on g.id = gp.gerencia_id and g.user_id = c.user_id
  where c.lead_event_id <> ''
    and c.lead_gerencia_id is null
    and c.lead_bot_phone <> ''
  group by c.id
  having count(distinct g.id) = 1
)
update public.conversions c
set
  lead_gerencia_id = x.gerencia_internal_id,
  lead_gerencia_external_id = coalesce(x.gerencia_external_id, x.gerencia_internal_id),
  lead_gerencia_name = x.gerencia_name,
  lead_gerencia_label = format('%s (ID %s)', x.gerencia_name, coalesce(x.gerencia_external_id, x.gerencia_internal_id)),
  lead_attribution_status = coalesce(nullif(c.lead_attribution_status, ''), 'backfill_unique_bot_phone')
from unique_phone_matches x
where c.id = x.conversion_id;

with unique_phone_matches as (
  select
    c.id as conversion_id,
    min(g.id) as gerencia_internal_id,
    min(g.gerencia_id) as gerencia_external_id,
    min(coalesce(nullif(trim(g.nombre), ''), format('Gerencia %s', coalesce(g.gerencia_id, g.id)))) as gerencia_name
  from public.conversions c
  join public.gerencia_phones gp
    on regexp_replace(coalesce(gp.phone, ''), '\D', '', 'g') = c.registration_bot_phone
  join public.gerencias g on g.id = gp.gerencia_id and g.user_id = c.user_id
  where c.registration_event_id <> ''
    and c.registration_gerencia_id is null
    and c.registration_bot_phone <> ''
  group by c.id
  having count(distinct g.id) = 1
)
update public.conversions c
set
  registration_gerencia_id = x.gerencia_internal_id,
  registration_gerencia_external_id = coalesce(x.gerencia_external_id, x.gerencia_internal_id),
  registration_gerencia_name = x.gerencia_name,
  registration_gerencia_label = format('%s (ID %s)', x.gerencia_name, coalesce(x.gerencia_external_id, x.gerencia_internal_id)),
  registration_attribution_status = coalesce(nullif(c.registration_attribution_status, ''), 'backfill_unique_bot_phone')
from unique_phone_matches x
where c.id = x.conversion_id;

with unique_phone_matches as (
  select
    c.id as conversion_id,
    min(g.id) as gerencia_internal_id,
    min(g.gerencia_id) as gerencia_external_id,
    min(coalesce(nullif(trim(g.nombre), ''), format('Gerencia %s', coalesce(g.gerencia_id, g.id)))) as gerencia_name
  from public.conversions c
  join public.gerencia_phones gp
    on regexp_replace(coalesce(gp.phone, ''), '\D', '', 'g') = c.purchase_bot_phone
  join public.gerencias g on g.id = gp.gerencia_id and g.user_id = c.user_id
  where c.purchase_event_id <> ''
    and c.purchase_gerencia_id is null
    and c.purchase_bot_phone <> ''
  group by c.id
  having count(distinct g.id) = 1
)
update public.conversions c
set
  purchase_gerencia_id = x.gerencia_internal_id,
  purchase_gerencia_external_id = coalesce(x.gerencia_external_id, x.gerencia_internal_id),
  purchase_gerencia_name = x.gerencia_name,
  purchase_gerencia_label = format('%s (ID %s)', x.gerencia_name, coalesce(x.gerencia_external_id, x.gerencia_internal_id)),
  purchase_attribution_status = coalesce(nullif(c.purchase_attribution_status, ''), 'backfill_unique_bot_phone')
from unique_phone_matches x
where c.id = x.conversion_id;

update public.conversions
set lead_attribution_status = 'backfill_unresolved'
where lead_event_id <> '' and lead_attribution_status = '';

update public.conversions
set registration_attribution_status = 'backfill_unresolved'
where registration_event_id <> '' and registration_attribution_status = '';

update public.conversions
set purchase_attribution_status = 'backfill_unresolved'
where purchase_event_id <> '' and purchase_attribution_status = '';
