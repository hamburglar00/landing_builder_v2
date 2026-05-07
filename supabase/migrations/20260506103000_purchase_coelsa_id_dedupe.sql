alter table public.conversions
  add column if not exists purchase_coelsa_id text not null default '';

comment on column public.conversions.purchase_coelsa_id is
  'Identificador Coelsa recibido en action=PURCHASE. Se usa para deduplicar pagos por cliente.';

create unique index if not exists conversions_purchase_coelsa_id_uidx
  on public.conversions (user_id, purchase_coelsa_id)
  where coalesce(purchase_coelsa_id, '') <> '';

alter table public.conversion_inbox
  add column if not exists coelsa_id text not null default '';

comment on column public.conversion_inbox.coelsa_id is
  'Identificador Coelsa recibido en action=PURCHASE para trazabilidad y deduplicacion.';

create index if not exists conversion_inbox_coelsa_id_idx
  on public.conversion_inbox (user_id, action, coelsa_id, created_at desc)
  where coalesce(coelsa_id, '') <> '';

alter table public.conversion_inbox
  drop constraint if exists conversion_inbox_status_check;

alter table public.conversion_inbox
  add constraint conversion_inbox_status_check
  check (status in ('received', 'deferred', 'processed', 'deduplicated', 'error'));