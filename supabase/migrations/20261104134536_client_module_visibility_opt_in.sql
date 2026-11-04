-- Optional sections start hidden. Preserve every previously saved choice.
alter table public.client_module_permissions
  add column show_notifications boolean not null default false,
  alter column show_followups set default false,
  alter column show_whatsapp_api set default false,
  alter column show_atrio set default false,
  alter column show_kommo set default false,
  alter column show_chatrace set default false;

alter table public.conversions_config
  alter column show_logs set default false;

comment on table public.client_module_permissions is
  'Admin-controlled dashboard visibility. Optional sections require explicit enablement. Hiding a module does not stop its integrations or background jobs.';

notify pgrst, 'reload schema';
