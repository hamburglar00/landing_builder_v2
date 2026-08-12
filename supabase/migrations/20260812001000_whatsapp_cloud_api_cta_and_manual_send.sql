alter table public.whatsapp_cloud_api_configs
  add column if not exists redirect_use_cta_button boolean not null default false,
  add column if not exists redirect_cta_button_title text not null default 'Ir al asesor';

alter table public.whatsapp_cloud_api_configs
  drop constraint if exists whatsapp_cloud_api_cta_title_length;

alter table public.whatsapp_cloud_api_configs
  add constraint whatsapp_cloud_api_cta_title_length
  check (
    char_length(btrim(coalesce(redirect_cta_button_title, ''))) between 1 and 20
  );

comment on column public.whatsapp_cloud_api_configs.redirect_use_cta_button is
  'Si esta activo, la derivacion automatica usa un mensaje interactivo CTA URL en lugar de mostrar el wa_link en texto.';

comment on column public.whatsapp_cloud_api_configs.redirect_cta_button_title is
  'Texto del boton CTA URL de derivacion. Meta limita el titulo a 20 caracteres.';

do $$
declare
  v_function text;
begin
  select pg_get_functiondef('public.get_whatsapp_cloud_api_inbox_threads(integer)'::regprocedure)
    into v_function;

  if v_function is not null then
    v_function := replace(
      v_function,
      'coalesce(o.payload #>> ''{text,body}'', o.message_type) as body',
      'coalesce(o.payload #>> ''{text,body}'', o.payload #>> ''{interactive,body,text}'', o.message_type) as body'
    );
    execute v_function;
  end if;
end $$;
