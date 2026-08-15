create table if not exists public.whatsapp_cloud_api_webhook_request_logs (
  id uuid primary key default gen_random_uuid(),
  config_id uuid null references public.whatsapp_cloud_api_configs (id) on delete set null,
  user_id uuid null references auth.users (id) on delete set null,
  workspace_currency text null check (workspace_currency in ('ARS', 'PYG')),
  object text not null default '',
  phone_number_id text not null default '',
  whatsapp_business_account_id text not null default '',
  request_status text not null default 'received'
    check (
      request_status in (
        'received',
        'accepted',
        'rejected',
        'failed'
      )
    ),
  reason text not null default '',
  http_status integer null,
  signature_checked boolean not null default false,
  signature_valid boolean null,
  payload jsonb not null default '{}'::jsonb,
  error text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_cloud_api_request_logs_config_created_idx
  on public.whatsapp_cloud_api_webhook_request_logs (config_id, created_at desc);

create index if not exists whatsapp_cloud_api_request_logs_workspace_created_idx
  on public.whatsapp_cloud_api_webhook_request_logs (workspace_currency, created_at desc);

create index if not exists whatsapp_cloud_api_request_logs_reason_created_idx
  on public.whatsapp_cloud_api_webhook_request_logs (reason, created_at desc);

alter table public.whatsapp_cloud_api_webhook_request_logs enable row level security;

create policy "whatsapp_cloud_api_request_logs_owner_read"
on public.whatsapp_cloud_api_webhook_request_logs for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "whatsapp_cloud_api_request_logs_admin_read"
on public.whatsapp_cloud_api_webhook_request_logs for select
to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

revoke all on table public.whatsapp_cloud_api_webhook_request_logs from anon, authenticated;
grant select on table public.whatsapp_cloud_api_webhook_request_logs to authenticated;
grant all on table public.whatsapp_cloud_api_webhook_request_logs to service_role;

comment on table public.whatsapp_cloud_api_webhook_request_logs is
  'Auditoria de requests recibidos por whatsapp-cloud-webhook, incluyendo rechazos previos al procesamiento.';
