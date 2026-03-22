-- Corrige clientes que ya tienen conversions_config pero con visible_columns vacío.
-- Usa columnas visibles del admin más reciente con configuración válida, o fallback completo.

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
    ) as visible_cols
)
update public.conversions_config cc
set
  visible_columns = d.visible_cols,
  updated_at = now()
from defaults d
where coalesce(array_length(cc.visible_columns, 1), 0) = 0;
