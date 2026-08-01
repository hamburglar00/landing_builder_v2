alter table public.conversions_config
  add column if not exists send_complete_registration_capi boolean not null default false;

alter table public.conversions_pixel_configs
  add column if not exists send_complete_registration_capi boolean not null default false;

alter table public.conversions
  add column if not exists registration_status_capi text not null default '';

comment on column public.conversions_config.send_complete_registration_capi is
  'Si true, envia eventos CompleteRegistration por Meta CAPI. Default false para no alterar metricas hasta activarlo.';

comment on column public.conversions_pixel_configs.send_complete_registration_capi is
  'Switch por pixel para enviar CompleteRegistration por Meta CAPI. Default false.';

comment on column public.conversions.registration_status_capi is
  'Resultado del envio CAPI para CompleteRegistration.';

update public.conversions_config
set visible_columns = (
  select array(
    select x
    from (
      select distinct on (x) x, ord
      from unnest(coalesce(visible_columns, array[]::text[]) || array['registration_status_capi'])
        with ordinality as t(x, ord)
      order by x, ord
    ) dedup
    order by ord
  )
)
where coalesce(array_length(visible_columns, 1), 0) > 0
  and not coalesce(visible_columns, array[]::text[]) @> array['registration_status_capi'];
