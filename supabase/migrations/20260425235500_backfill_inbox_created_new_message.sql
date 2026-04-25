-- Armoniza mensajes historicos de LEAD created_new en conversion_inbox.response_body
-- al formato explicativo nuevo.

update public.conversion_inbox
set response_body = 'No se encontro un Contact previo para este LEAD (sin match por promo_code ni por fallback de tiempo+telefono asignado). Se creo una nueva fila LEAD y se proceso correctamente. match_mode:created_new'
where action = 'LEAD'
  and lower(coalesce(status, '')) = 'processed'
  and (
    response_body like 'LEAD sin match por promo_code: se creo una fila nueva y se proceso correctamente. match_mode:created_new%'
    or response_body like 'LEAD sin match por promo_code: se creo una fila nueva y se proceso correctamente%'
  );

update public.conversion_inbox
set response_body = 'No se encontro un Contact previo para este LEAD (sin match por promo_code ni por fallback de tiempo+telefono asignado). Se creo una nueva fila LEAD, pero fallo el envio a Meta CAPI (revisar token, pixel o pestana Logs). match_mode:created_new'
where action = 'LEAD'
  and (
    lower(coalesce(status, '')) = 'error'
    or coalesce(http_status, 0) >= 400
  )
  and (
    response_body like 'LEAD sin match por promo_code: se creo una fila nueva, pero fallo el envio a Meta CAPI (revisar token, pixel o pestana Logs). match_mode:created_new%'
    or response_body like 'LEAD sin match por promo_code: se creo una fila nueva, pero fallo el envio a Meta CAPI%'
  );