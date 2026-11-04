-- Presentation snapshot only. Routing continues to use gerencia_phones and
-- its existing availability, counters and assignment controls.
alter table public.gerencias
  add column pbadmin_bots jsonb not null default '[]'::jsonb
    check (jsonb_typeof(pbadmin_bots) = 'array' and jsonb_array_length(pbadmin_bots) <= 1000),
  add column pbadmin_bots_synced_at timestamptz;

comment on column public.gerencias.pbadmin_bots is
  'Display inventory for the unified Bots screen. Not an authority for phone routing, credentials, account access or financial operations.';

alter table public.atrio_clients
  add column pbadmin_bots jsonb not null default '[]'::jsonb
    check (jsonb_typeof(pbadmin_bots) = 'array' and jsonb_array_length(pbadmin_bots) <= 1000),
  add column pbadmin_bots_synced_at timestamptz;

comment on column public.atrio_clients.pbadmin_bots is
  'Display-only PBAdmin inventory. Missing live connections are shown as pending; this snapshot never authorizes chat entry or financial operations.';

notify pgrst, 'reload schema';
