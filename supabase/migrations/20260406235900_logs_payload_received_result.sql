alter table if exists public.conversion_logs
  add column if not exists payload_received text not null default '',
  add column if not exists result text not null default '';

update public.conversion_logs
set result = case
  when coalesce(nullif(trim(detail), ''), '') <> '' then detail
  else message
end
where coalesce(trim(result), '') = '';

-- Backfill best-effort del payload recibido para logs de handlers.
-- Se toma el JSON que ya estaba en detail cuando aplica.
update public.conversion_logs
set payload_received = detail
where coalesce(trim(payload_received), '') = ''
  and function_name in ('handleContact', 'handleLead', 'handlePurchase', 'handleSimplePurchase')
  and detail like '{%';

