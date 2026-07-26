alter table public.chatrace_client_configs
  add column if not exists send_business_messaging_purchase_capi boolean not null default false,
  add column if not exists whatsapp_business_account_id text not null default '',
  add column if not exists meta_messaging_dataset_id text not null default '',
  add column if not exists meta_messaging_access_token text not null default '';

comment on column public.chatrace_client_configs.send_business_messaging_purchase_capi is
  'Envia Purchase originados en Chatrace con ctwa_clid mediante Conversions API for Business Messaging. Opt-in y desactivado por defecto.';
comment on column public.chatrace_client_configs.whatsapp_business_account_id is
  'WhatsApp Business Account ID usado en user_data.whatsapp_business_account_id para eventos CTWA.';
comment on column public.chatrace_client_configs.meta_messaging_dataset_id is
  'Dataset de Meta asociado al WABA para Conversions API for Business Messaging.';
comment on column public.chatrace_client_configs.meta_messaging_access_token is
  'Token de Meta con permisos whatsapp_business_management y whatsapp_business_manage_events.';

alter table public.conversions
  add column if not exists ctwa_clid text not null default '',
  add column if not exists purchase_capi_route text not null default '',
  add column if not exists purchase_capi_route_reason text not null default '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'conversions_purchase_capi_route_check'
  ) then
    alter table public.conversions
      add constraint conversions_purchase_capi_route_check
      check (purchase_capi_route in ('', 'website', 'business_messaging'));
  end if;
end
$$;

comment on column public.conversions.ctwa_clid is
  'Click-to-WhatsApp Click ID crudo, exclusivo del origen Chatrace; no se hashea ni se acepta desde landing.';
comment on column public.conversions.purchase_capi_route is
  'Ruta fijada antes del primer intento de Purchase CAPI: website o business_messaging.';
comment on column public.conversions.purchase_capi_route_reason is
  'Motivo auditable por el que se selecciono la ruta de Purchase CAPI.';

update public.conversions_config
set visible_columns = (
  select array_agg(x order by first_ord)
  from (
    select x, min(ord) as first_ord
    from unnest(
      coalesce(visible_columns, array[]::text[]) ||
      array['ctwa_clid', 'purchase_capi_route', 'purchase_capi_route_reason']
    ) with ordinality as t(x, ord)
    group by x
  ) deduped
)
where not (
  coalesce(visible_columns, array[]::text[]) @>
  array['ctwa_clid', 'purchase_capi_route', 'purchase_capi_route_reason']
);
