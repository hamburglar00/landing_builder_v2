alter table public.conversions
  add column if not exists purchase_transaction_id text not null default '';

comment on column public.conversions.purchase_transaction_id is
  'Identificador de transaccion recibido en action=PURCHASE. Equivale a coelsa_id para deduplicar pagos por cliente.';

create or replace function pg_temp.extract_purchase_transaction_id(raw text)
returns text
language plpgsql
as $$
declare
  parsed jsonb;
  value text;
begin
  if coalesce(raw, '') = '' then
    return '';
  end if;
  parsed := raw::jsonb;
  value := coalesce(parsed ->> 'transaction_id', '');
  return upper(left(regexp_replace(value, '\s+', '', 'g'), 120));
exception when others then
  return '';
end;
$$;

update public.conversions
set purchase_transaction_id = pg_temp.extract_purchase_transaction_id(purchase_payload_raw)
where coalesce(purchase_transaction_id, '') = ''
  and coalesce(purchase_payload_raw, '') <> '';

with ranked as (
  select
    id,
    row_number() over (
      partition by user_id, purchase_transaction_id
      order by created_at asc, id asc
    ) as rn
  from public.conversions
  where coalesce(purchase_transaction_id, '') <> ''
)
update public.conversions c
set purchase_transaction_id = ''
from ranked r
where c.id = r.id
  and r.rn > 1;

create unique index if not exists conversions_purchase_transaction_id_uidx
  on public.conversions (user_id, purchase_transaction_id)
  where coalesce(purchase_transaction_id, '') <> '';

alter table public.conversion_inbox
  add column if not exists transaction_id text not null default '';

comment on column public.conversion_inbox.transaction_id is
  'Identificador de transaccion recibido en action=PURCHASE para trazabilidad y deduplicacion.';

update public.conversion_inbox
set transaction_id = pg_temp.extract_purchase_transaction_id(payload_raw)
where action = 'PURCHASE'
  and coalesce(transaction_id, '') = ''
  and coalesce(payload_raw, '') <> '';

create index if not exists conversion_inbox_transaction_id_idx
  on public.conversion_inbox (user_id, action, transaction_id, created_at desc)
  where coalesce(transaction_id, '') <> '';
