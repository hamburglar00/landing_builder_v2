update public.whatsapp_cloud_api_configs
set pixel_id = ''
where coalesce(pixel_id, '') <> '';

drop function if exists public.get_whatsapp_cloud_api_config(uuid);

drop function if exists public.upsert_whatsapp_cloud_api_config_secure(
  uuid, uuid, text, boolean, text, text, text, text, text, text, text, text,
  text, text, text, text, text, text, text, boolean, text
);

create or replace function public.get_whatsapp_cloud_api_config(
  p_user_id uuid default null
)
returns table (
  id uuid,
  user_id uuid,
  name text,
  active boolean,
  workspace_currency text,
  phone_number_id text,
  whatsapp_business_account_id text,
  display_phone_number text,
  meta_access_token text,
  meta_app_secret text,
  has_meta_access_token boolean,
  has_meta_app_secret boolean,
  meta_api_version text,
  webhook_verify_token text,
  meta_messaging_dataset_id text,
  landing_tag text,
  gerencia_selection_mode text,
  gerencia_fair_criterion text,
  send_contact_capi boolean,
  redirect_message_template text,
  fallback_message_template text,
  redirect_use_cta_button boolean,
  redirect_cta_button_title text,
  phone_number_status text,
  quality_rating text,
  messaging_limit_tier text,
  health_checked_at timestamptz,
  health_last_error text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public, pg_temp
as $$
  with viewer as (
    select
      (select auth.uid()) as uid,
      exists (
        select 1
        from public.profiles p
        where p.id = (select auth.uid())
          and p.role = 'admin'
      ) as is_admin
  ),
  target as (
    select coalesce(p_user_id, (select uid from viewer)) as uid
  )
  select
    c.id,
    c.user_id,
    c.name,
    c.active,
    c.workspace_currency,
    c.phone_number_id,
    c.whatsapp_business_account_id,
    c.display_phone_number,
    ''::text as meta_access_token,
    ''::text as meta_app_secret,
    length(btrim(coalesce(c.meta_access_token, ''))) > 0 as has_meta_access_token,
    length(btrim(coalesce(c.meta_app_secret, ''))) > 0 as has_meta_app_secret,
    c.meta_api_version,
    c.webhook_verify_token,
    c.meta_messaging_dataset_id,
    c.landing_tag,
    c.gerencia_selection_mode,
    c.gerencia_fair_criterion,
    c.send_contact_capi,
    c.redirect_message_template,
    c.fallback_message_template,
    c.redirect_use_cta_button,
    c.redirect_cta_button_title,
    c.phone_number_status,
    c.quality_rating,
    c.messaging_limit_tier,
    c.health_checked_at,
    c.health_last_error,
    c.created_at,
    c.updated_at
  from public.whatsapp_cloud_api_configs c
  cross join viewer v
  cross join target t
  where v.uid is not null
    and t.uid is not null
    and c.user_id = t.uid
    and (v.is_admin or c.user_id = v.uid)
  order by c.created_at desc
  limit 1;
$$;

create or replace function public.upsert_whatsapp_cloud_api_config_secure(
  p_id uuid,
  p_user_id uuid,
  p_name text,
  p_active boolean,
  p_workspace_currency text,
  p_phone_number_id text,
  p_whatsapp_business_account_id text,
  p_display_phone_number text,
  p_meta_access_token text,
  p_meta_app_secret text,
  p_meta_api_version text,
  p_webhook_verify_token text,
  p_meta_messaging_dataset_id text,
  p_landing_tag text,
  p_gerencia_selection_mode text,
  p_gerencia_fair_criterion text,
  p_redirect_message_template text,
  p_fallback_message_template text,
  p_redirect_use_cta_button boolean,
  p_redirect_cta_button_title text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_viewer uuid := (select auth.uid());
  v_is_admin boolean;
  v_target_user_id uuid := coalesce(p_user_id, v_viewer);
  v_existing public.whatsapp_cloud_api_configs%rowtype;
  v_meta_access_token text;
  v_meta_app_secret text;
  v_saved_id uuid;
begin
  if v_viewer is null then
    raise exception 'Sesion requerida';
  end if;

  select exists (
    select 1 from public.profiles p where p.id = v_viewer and p.role = 'admin'
  ) into v_is_admin;

  if not v_is_admin and v_target_user_id <> v_viewer then
    raise exception 'No autorizado';
  end if;

  if p_id is not null then
    select *
      into v_existing
    from public.whatsapp_cloud_api_configs c
    where c.id = p_id
      and c.user_id = v_target_user_id;
  end if;

  v_meta_access_token := coalesce(nullif(btrim(p_meta_access_token), ''), v_existing.meta_access_token, '');
  v_meta_app_secret := coalesce(nullif(btrim(p_meta_app_secret), ''), v_existing.meta_app_secret, '');

  if length(btrim(coalesce(p_name, ''))) = 0 then
    raise exception 'Nombre interno requerido';
  end if;
  if length(p_name) > 120 then
    raise exception 'Nombre interno demasiado largo';
  end if;
  if coalesce(p_phone_number_id, '') !~ '^[0-9]+$' then
    raise exception 'Phone Number ID debe ser numerico';
  end if;
  if coalesce(p_whatsapp_business_account_id, '') !~ '^[0-9]+$' then
    raise exception 'WABA ID debe ser numerico';
  end if;
  if length(btrim(coalesce(p_display_phone_number, ''))) > 0
    and p_display_phone_number !~ '^[0-9]+$' then
    raise exception 'Telefono visible debe ser numerico';
  end if;
  if length(btrim(v_meta_access_token)) = 0 then
    raise exception 'Meta access token requerido';
  end if;
  if length(btrim(v_meta_app_secret)) = 0 then
    raise exception 'App Secret requerido';
  end if;
  if length(btrim(coalesce(p_webhook_verify_token, ''))) = 0 then
    raise exception 'Verify token requerido';
  end if;
  if coalesce(p_meta_messaging_dataset_id, '') !~ '^[0-9]+$' then
    raise exception 'Dataset Business Messaging ID requerido';
  end if;
  if length(btrim(coalesce(p_landing_tag, ''))) = 0
    or p_landing_tag !~ '^[A-Za-z0-9]+$' then
    raise exception 'Tag requerido';
  end if;
  if coalesce(p_gerencia_selection_mode, '') not in ('weighted_random', 'fair') then
    raise exception 'Modo de seleccion invalido';
  end if;
  if coalesce(p_gerencia_fair_criterion, '') not in ('usage_count', 'messages_received') then
    raise exception 'Criterio equitativo invalido';
  end if;
  if length(btrim(coalesce(p_redirect_message_template, ''))) = 0 then
    raise exception 'Mensaje de derivacion requerido';
  end if;
  if length(btrim(coalesce(p_fallback_message_template, ''))) = 0 then
    raise exception 'Mensaje fallback requerido';
  end if;
  if char_length(btrim(coalesce(p_redirect_cta_button_title, ''))) not between 1 and 20 then
    raise exception 'Titulo del boton: maximo 20 caracteres';
  end if;

  if p_id is null then
    insert into public.whatsapp_cloud_api_configs (
      user_id,
      name,
      active,
      workspace_currency,
      phone_number_id,
      whatsapp_business_account_id,
      display_phone_number,
      meta_access_token,
      meta_app_secret,
      meta_api_version,
      webhook_verify_token,
      pixel_id,
      meta_messaging_dataset_id,
      landing_tag,
      gerencia_selection_mode,
      gerencia_fair_criterion,
      send_contact_capi,
      redirect_message_template,
      fallback_message_template,
      redirect_use_cta_button,
      redirect_cta_button_title,
      updated_at
    )
    values (
      v_target_user_id,
      btrim(p_name),
      coalesce(p_active, false),
      coalesce(nullif(btrim(p_workspace_currency), ''), 'ARS'),
      btrim(p_phone_number_id),
      btrim(p_whatsapp_business_account_id),
      btrim(coalesce(p_display_phone_number, '')),
      btrim(v_meta_access_token),
      btrim(v_meta_app_secret),
      coalesce(nullif(btrim(p_meta_api_version), ''), 'v25.0'),
      btrim(p_webhook_verify_token),
      '',
      btrim(p_meta_messaging_dataset_id),
      btrim(p_landing_tag),
      p_gerencia_selection_mode,
      p_gerencia_fair_criterion,
      false,
      p_redirect_message_template,
      p_fallback_message_template,
      coalesce(p_redirect_use_cta_button, false),
      btrim(p_redirect_cta_button_title),
      now()
    )
    returning id into v_saved_id;
  else
    update public.whatsapp_cloud_api_configs
    set
      name = btrim(p_name),
      active = coalesce(p_active, false),
      workspace_currency = coalesce(nullif(btrim(p_workspace_currency), ''), 'ARS'),
      phone_number_id = btrim(p_phone_number_id),
      whatsapp_business_account_id = btrim(p_whatsapp_business_account_id),
      display_phone_number = btrim(coalesce(p_display_phone_number, '')),
      meta_access_token = btrim(v_meta_access_token),
      meta_app_secret = btrim(v_meta_app_secret),
      meta_api_version = coalesce(nullif(btrim(p_meta_api_version), ''), 'v25.0'),
      webhook_verify_token = btrim(p_webhook_verify_token),
      pixel_id = '',
      meta_messaging_dataset_id = btrim(p_meta_messaging_dataset_id),
      landing_tag = btrim(p_landing_tag),
      gerencia_selection_mode = p_gerencia_selection_mode,
      gerencia_fair_criterion = p_gerencia_fair_criterion,
      send_contact_capi = false,
      redirect_message_template = p_redirect_message_template,
      fallback_message_template = p_fallback_message_template,
      redirect_use_cta_button = coalesce(p_redirect_use_cta_button, false),
      redirect_cta_button_title = btrim(p_redirect_cta_button_title),
      updated_at = now()
    where id = p_id
      and user_id = v_target_user_id
    returning id into v_saved_id;

    if v_saved_id is null then
      raise exception 'Configuracion no encontrada';
    end if;
  end if;

  return v_saved_id;
end;
$$;

revoke all on function public.get_whatsapp_cloud_api_config(uuid) from public, anon;
grant execute on function public.get_whatsapp_cloud_api_config(uuid) to authenticated;

revoke all on function public.upsert_whatsapp_cloud_api_config_secure(
  uuid, uuid, text, boolean, text, text, text, text, text, text, text, text,
  text, text, text, text, text, text, boolean, text
) from public, anon;
grant execute on function public.upsert_whatsapp_cloud_api_config_secure(
  uuid, uuid, text, boolean, text, text, text, text, text, text, text, text,
  text, text, text, text, text, text, boolean, text
) to authenticated;
