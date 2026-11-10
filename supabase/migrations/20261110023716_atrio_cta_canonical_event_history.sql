-- The CTA capture remains in contact_* for attribution and deduplication.
-- Canonical milestone/status fields describe the actual frozen Meta event.
alter table public.conversions drop constraint if exists conversions_estado_check;
alter table public.conversions add constraint conversions_estado_check
  check (estado in ('contact','lead','registration','purchase')) not valid;
alter table public.conversions validate constraint conversions_estado_check;

create schema if not exists private;
create table if not exists private.atrio_cta_event_corrections (
  conversion_id uuid primary key,
  event_name text not null check (event_name in ('Lead','CompleteRegistration')),
  previous_fields jsonb not null,
  corrected_at timestamptz not null default now()
);
alter table private.atrio_cta_event_corrections enable row level security;
revoke all on private.atrio_cta_event_corrections from public,anon,authenticated;
