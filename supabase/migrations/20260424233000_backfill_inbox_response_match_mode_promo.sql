-- Armoniza response_body de conversion_inbox para LEAD procesados por promo_code.
-- Solo toca respuestas legacy "Fila LEAD procesada" con promo_code valido.
-- No toca created_new ni bot_phone+dateTime.

update public.conversion_inbox i
set response_body = 'Fila LEAD procesada. match_mode:promo_code'
where i.action = 'LEAD'
  and lower(coalesce(i.status, '')) = 'processed'
  and coalesce(i.response_body, '') = 'Fila LEAD procesada'
  and coalesce(i.promo_code, '') ~ '^[A-Za-z0-9]+-[A-Za-z0-9]+$'
  and lower(coalesce(i.response_body, '')) not like '%match_mode:created_new%'
  and lower(coalesce(i.response_body, '')) not like '%sin match por promo_code%'
  and lower(coalesce(i.response_body, '')) not like '%match_mode:bot_phone+datetime%';