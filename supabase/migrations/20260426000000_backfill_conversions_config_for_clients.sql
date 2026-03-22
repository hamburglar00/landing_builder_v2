-- Crear conversions_config para clientes existentes que no tengan registro.
-- Hereda columnas visibles y umbral premium desde la config de admin más reciente;
-- si no existe, usa fallback seguro.

with defaults as (
  select
    coalesce(
      (
        select cc.visible_columns
        from public.conversions_config cc
        join public.profiles p on p.id = cc.user_id
        where p.role = 'admin'
          and coalesce(array_length(cc.visible_columns, 1), 0) > 0
        order by cc.updated_at desc
        limit 1
      ),
      array[
        'phone','email','fn','ln','ct','st','zip','country','fbp','fbc',
        'contact_event_id','contact_event_time','lead_event_id','lead_event_time',
        'purchase_event_id','purchase_event_time','timestamp','clientIP','agentuser',
        'estado','valor','purchase_type','contact_status_capi','lead_status_capi',
        'purchase_status_capi','observaciones','external_id','utm_campaign',
        'telefono_asignado','promo_code','device_type','geo_city','geo_region','geo_country'
      ]::text[]
    ) as visible_cols,
    coalesce(
      (
        select cc.funnel_premium_threshold
        from public.conversions_config cc
        join public.profiles p on p.id = cc.user_id
        where p.role = 'admin'
        order by cc.updated_at desc
        limit 1
      ),
      50000
    )::numeric as premium_threshold
)
insert into public.conversions_config (
  user_id,
  pixel_id,
  meta_access_token,
  meta_currency,
  meta_api_version,
  send_contact_capi,
  geo_use_ipapi,
  geo_fill_only_when_missing,
  test_event_code,
  funnel_premium_threshold,
  visible_columns
)
select
  p.id,
  '',
  '',
  'ARS',
  'v25.0',
  false,
  false,
  false,
  '',
  d.premium_threshold,
  d.visible_cols
from public.profiles p
cross join defaults d
where p.role = 'client'
  and not exists (
    select 1
    from public.conversions_config cc
    where cc.user_id = p.id
  );
