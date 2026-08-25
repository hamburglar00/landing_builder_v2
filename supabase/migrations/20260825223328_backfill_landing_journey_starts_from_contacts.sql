insert into public.conversion_journey_starts (
  user_id,
  source_platform,
  start_identity_key,
  landing_id,
  landing_name,
  workspace_currency,
  external_id,
  phone,
  email,
  utm_campaign,
  fbp,
  fbc,
  from_meta_ads,
  meta_pixel_id,
  telefono_asignado,
  assigned_gerencia_id,
  assigned_gerencia_external_id,
  assigned_gerencia_name,
  assigned_gerencia_label,
  device_type,
  event_source_url,
  client_ip,
  agent_user,
  first_seen_at,
  last_seen_at
)
select distinct on ('landing:' || resolved_landing.id::text || ':' || btrim(c.external_id))
  c.user_id,
  'landing' as source_platform,
  'landing:' || resolved_landing.id::text || ':' || btrim(c.external_id) as start_identity_key,
  resolved_landing.id as landing_id,
  coalesce(nullif(btrim(c.landing_name), ''), resolved_landing.name, '') as landing_name,
  case
    when upper(btrim(coalesce(resolved_landing.workspace_currency, ''))) in ('ARS', 'PYG')
      then upper(btrim(resolved_landing.workspace_currency))
    when upper(btrim(coalesce(c.currency, ''))) in ('ARS', 'PYG')
      then upper(btrim(c.currency))
    else 'ARS'
  end as workspace_currency,
  btrim(c.external_id) as external_id,
  regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') as phone,
  lower(btrim(coalesce(c.email, ''))) as email,
  btrim(coalesce(c.utm_campaign, '')) as utm_campaign,
  btrim(coalesce(c.fbp, '')) as fbp,
  btrim(coalesce(c.fbc, '')) as fbc,
  coalesce(c.from_meta_ads, false) or btrim(coalesce(c.fbc, '')) <> '' as from_meta_ads,
  regexp_replace(coalesce(nullif(c.meta_pixel_id, ''), nullif(c.pixel_id, ''), resolved_landing.pixel_id, ''), '\D', '', 'g') as meta_pixel_id,
  regexp_replace(coalesce(c.telefono_asignado, ''), '\D', '', 'g') as telefono_asignado,
  null as assigned_gerencia_id,
  c.assigned_gerencia_external_id,
  nullif(btrim(coalesce(c.assigned_gerencia_name, '')), '') as assigned_gerencia_name,
  nullif(btrim(coalesce(c.assigned_gerencia_label, '')), '') as assigned_gerencia_label,
  btrim(coalesce(c.device_type, '')) as device_type,
  left(btrim(coalesce(c.event_source_url, '')), 2048) as event_source_url,
  btrim(coalesce(c.client_ip, '')) as client_ip,
  left(btrim(coalesce(c.agent_user, '')), 1024) as agent_user,
  c.created_at as first_seen_at,
  c.created_at as last_seen_at
from public.conversions c
join lateral (
  select l.id, l.name, l.workspace_currency, l.pixel_id
  from public.landings l
  where
    (c.landing_id is not null and l.id = c.landing_id)
    or (
      c.landing_id is null
      and l.user_id = c.user_id
      and l.name = c.landing_name
    )
  order by case when c.landing_id is not null and l.id = c.landing_id then 0 else 1 end
  limit 1
) resolved_landing on true
where lower(btrim(coalesce(c.source_platform, ''))) = 'landing'
  and btrim(coalesce(c.contact_event_id, '')) <> ''
  and btrim(coalesce(c.external_id, '')) <> ''
  and btrim(coalesce(c.test_event_code, '')) = ''
order by
  'landing:' || resolved_landing.id::text || ':' || btrim(c.external_id),
  c.created_at asc
on conflict on constraint conversion_journey_starts_identity_unique do update
set
  landing_id = coalesce(excluded.landing_id, conversion_journey_starts.landing_id),
  landing_name = coalesce(nullif(excluded.landing_name, ''), conversion_journey_starts.landing_name),
  workspace_currency = coalesce(nullif(excluded.workspace_currency, ''), conversion_journey_starts.workspace_currency),
  external_id = coalesce(nullif(excluded.external_id, ''), conversion_journey_starts.external_id),
  phone = coalesce(nullif(excluded.phone, ''), conversion_journey_starts.phone),
  email = coalesce(nullif(excluded.email, ''), conversion_journey_starts.email),
  utm_campaign = coalesce(nullif(excluded.utm_campaign, ''), conversion_journey_starts.utm_campaign),
  fbp = coalesce(nullif(excluded.fbp, ''), conversion_journey_starts.fbp),
  fbc = coalesce(nullif(excluded.fbc, ''), conversion_journey_starts.fbc),
  from_meta_ads = conversion_journey_starts.from_meta_ads or excluded.from_meta_ads,
  meta_pixel_id = coalesce(nullif(excluded.meta_pixel_id, ''), conversion_journey_starts.meta_pixel_id),
  telefono_asignado = coalesce(nullif(excluded.telefono_asignado, ''), conversion_journey_starts.telefono_asignado),
  assigned_gerencia_id = coalesce(excluded.assigned_gerencia_id, conversion_journey_starts.assigned_gerencia_id),
  assigned_gerencia_external_id = coalesce(excluded.assigned_gerencia_external_id, conversion_journey_starts.assigned_gerencia_external_id),
  assigned_gerencia_name = coalesce(excluded.assigned_gerencia_name, conversion_journey_starts.assigned_gerencia_name),
  assigned_gerencia_label = coalesce(excluded.assigned_gerencia_label, conversion_journey_starts.assigned_gerencia_label),
  device_type = coalesce(nullif(excluded.device_type, ''), conversion_journey_starts.device_type),
  event_source_url = coalesce(nullif(excluded.event_source_url, ''), conversion_journey_starts.event_source_url),
  client_ip = coalesce(nullif(excluded.client_ip, ''), conversion_journey_starts.client_ip),
  agent_user = coalesce(nullif(excluded.agent_user, ''), conversion_journey_starts.agent_user),
  first_seen_at = least(conversion_journey_starts.first_seen_at, excluded.first_seen_at),
  last_seen_at = greatest(conversion_journey_starts.last_seen_at, excluded.last_seen_at),
  updated_at = now();
