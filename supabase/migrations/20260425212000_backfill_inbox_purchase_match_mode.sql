-- Harmonize historical PURCHASE inbox responses to the new match_mode format.
-- Only updates PURCHASE rows that are already processed and still don't include match_mode.

with purchase_modes as (
  select
    ci.id,
    lower(coalesce(ci.response_body, '')) as response_lc,
    case
      when coalesce(c.purchase_type, '') = 'repeat'
        or coalesce(c.observaciones, '') ilike '%REPEAT%' then 'created_repeat'
      when coalesce(c.lead_event_id, '') <> '' then
        case
          when coalesce(ci.promo_code, '') ~ '^[A-Za-z0-9]+-[A-Za-z0-9]+$' then 'promo_code'
          else 'phone_lead'
        end
      else 'created_first'
    end as match_mode
  from public.conversion_inbox ci
  left join public.conversions c on c.id = ci.conversion_id
  where ci.action = 'PURCHASE'
    and ci.status = 'processed'
    and coalesce(ci.response_body, '') not ilike '%match_mode:%'
    and coalesce(ci.response_body, '') not ilike '%no procesado%'
)
update public.conversion_inbox ci
set response_body = case
  when pm.response_lc like '%error al enviar%' then
    case
      when pm.match_mode = 'created_first' then
        'No se encontro una fila previa para este PURCHASE (sin match por promo_code ni por fallback phone->lead). Se creo una nueva fila PURCHASE, pero fallo el envio a Meta CAPI (revisar token, pixel o Logs). match_mode:created_first'
      else
        'PURCHASE procesado. Error al enviar a Meta CAPI (revisar token, pixel o Logs). match_mode:' || pm.match_mode
    end
  else
    case
      when pm.match_mode = 'created_first' then
        'No se encontro una fila previa para este PURCHASE (sin match por promo_code ni por fallback phone->lead). Se creo una nueva fila PURCHASE y se proceso correctamente. match_mode:created_first'
      else
        'Fila PURCHASE procesada. match_mode:' || pm.match_mode
    end
end
from purchase_modes pm
where ci.id = pm.id;

