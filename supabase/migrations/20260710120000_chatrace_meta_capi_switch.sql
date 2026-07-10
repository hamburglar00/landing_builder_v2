alter table public.chatrace_client_configs
  add column if not exists send_meta_capi_events boolean not null default true;

comment on column public.chatrace_client_configs.send_meta_capi_events is
  'Controla si los eventos de Chatrace (Contact, Lead y Purchase) se envian a Meta Conversions API.';
