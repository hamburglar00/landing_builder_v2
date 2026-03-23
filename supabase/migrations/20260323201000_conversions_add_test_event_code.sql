alter table if exists public.conversions
  add column if not exists test_event_code text not null default '';

comment on column public.conversions.test_event_code is 'Meta Test Event Code recibido por payload para trazabilidad de eventos de prueba.';
