alter table public.conversions_config
  add column if not exists show_inbox boolean not null default false;

comment on column public.conversions_config.show_inbox is
  'Define si el cliente puede ver la pestaña Inbox en Conversiones.';

update public.conversions_config
set show_inbox = false
where show_inbox is null;
