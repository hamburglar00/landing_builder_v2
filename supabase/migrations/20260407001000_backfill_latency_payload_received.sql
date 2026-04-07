-- Normaliza logs historicos de latency para que payload_received no duplique
-- el payload completo de Contact y muestre solo la key de latency.
update public.conversion_logs
set payload_received = detail
where function_name = 'handleContact'
  and message = 'CTA tap->redirect latency'
  and coalesce(trim(detail), '') <> '';

