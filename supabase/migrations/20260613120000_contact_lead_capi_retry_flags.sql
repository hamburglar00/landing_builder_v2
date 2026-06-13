alter table public.conversions
  add column if not exists contact_capi_retryable boolean not null default false,
  add column if not exists lead_capi_retryable boolean not null default false,
  add column if not exists contact_capi_retry_count integer not null default 0,
  add column if not exists lead_capi_retry_count integer not null default 0,
  add column if not exists contact_capi_last_retry_at timestamptz,
  add column if not exists lead_capi_last_retry_at timestamptz;

create index if not exists idx_conversions_contact_capi_retry
  on public.conversions (created_at asc)
  where contact_capi_retryable = true
    and contact_status_capi = 'error';

create index if not exists idx_conversions_lead_capi_retry
  on public.conversions (created_at asc)
  where lead_capi_retryable = true
    and lead_status_capi = 'error';

comment on column public.conversions.contact_capi_retryable is
  'Marca forward-only para que el cron reintente Contact CAPI solo cuando el fallo fue transitorio.';

comment on column public.conversions.lead_capi_retryable is
  'Marca forward-only para que el cron reintente Lead CAPI solo cuando el fallo fue transitorio.';
