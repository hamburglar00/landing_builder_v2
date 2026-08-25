alter table public.whatsapp_cloud_api_configs
  add column if not exists retarget_message_template text not null default
    $$👋 ¡Hola! Tu asesor ya está listo para atenderte 🙋‍♂️💬

👇 Tocá el botón de abajo y enviale el mensaje para comenzar ahora. Te va a guiar paso a paso y brindarte atención personalizada. 🚀✨$$,
  add column if not exists retarget_delay_minutes integer not null default 30;

update public.whatsapp_cloud_api_configs
set
  retarget_message_template = coalesce(nullif(btrim(retarget_message_template), ''), $$👋 ¡Hola! Tu asesor ya está listo para atenderte 🙋‍♂️💬

👇 Tocá el botón de abajo y enviale el mensaje para comenzar ahora. Te va a guiar paso a paso y brindarte atención personalizada. 🚀✨$$),
  retarget_delay_minutes = least(1380, greatest(1, coalesce(retarget_delay_minutes, 30)));

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'whatsapp_cloud_api_configs_retarget_delay_minutes_chk'
      and conrelid = 'public.whatsapp_cloud_api_configs'::regclass
  ) then
    alter table public.whatsapp_cloud_api_configs
      add constraint whatsapp_cloud_api_configs_retarget_delay_minutes_chk
      check (retarget_delay_minutes between 1 and 1380);
  end if;
end $$;

comment on column public.whatsapp_cloud_api_configs.retarget_message_template is
  'Mensaje editable que envia el retargeting automatico de WhatsApp Cloud API.';

comment on column public.whatsapp_cloud_api_configs.retarget_delay_minutes is
  'Minutos desde el ultimo inbound para enviar retargeting automatico. Maximo 1380 minutos para mantenerse dentro de 23 horas.';

drop function if exists public.get_whatsapp_cloud_api_config(uuid);
drop function if exists public.get_whatsapp_cloud_api_config(uuid, text);

create or replace function public.get_whatsapp_cloud_api_config(
  p_user_id uuid default null,
  p_workspace_currency text default null
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
  enrich_business_messaging_user_data boolean,
  send_business_messaging_purchase_type_capi boolean,
  retargeting_enabled boolean,
  retarget_message_template text,
  retarget_delay_minutes integer,
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
  request_scope as (
    select
      coalesce(p_user_id, (select uid from viewer)) as uid,
      case
        when upper(coalesce(nullif(btrim(p_workspace_currency), ''), '')) in ('ARS', 'PYG')
          then upper(btrim(p_workspace_currency))
        else 'ARS'
      end as workspace_currency
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
    c.meta_access_token,
    c.meta_app_secret,
    length(btrim(coalesce(c.meta_access_token, ''))) > 0 as has_meta_access_token,
    length(btrim(coalesce(c.meta_app_secret, ''))) > 0 as has_meta_app_secret,
    c.meta_api_version,
    c.webhook_verify_token,
    c.meta_messaging_dataset_id,
    c.enrich_business_messaging_user_data,
    c.send_business_messaging_purchase_type_capi,
    c.retargeting_enabled,
    c.retarget_message_template,
    c.retarget_delay_minutes,
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
  cross join request_scope rs
  where v.uid is not null
    and rs.uid is not null
    and c.user_id = rs.uid
    and c.workspace_currency = rs.workspace_currency
    and (v.is_admin or c.user_id = v.uid)
  order by c.created_at desc
  limit 1;
$$;

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
  enrich_business_messaging_user_data boolean,
  send_business_messaging_purchase_type_capi boolean,
  retargeting_enabled boolean,
  retarget_message_template text,
  retarget_delay_minutes integer,
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
  select *
  from public.get_whatsapp_cloud_api_config(p_user_id, 'ARS');
$$;

revoke all on function public.get_whatsapp_cloud_api_config(uuid, text) from public, anon;
grant execute on function public.get_whatsapp_cloud_api_config(uuid, text) to authenticated;

revoke all on function public.get_whatsapp_cloud_api_config(uuid) from public, anon;
grant execute on function public.get_whatsapp_cloud_api_config(uuid) to authenticated;

drop function if exists public.upsert_whatsapp_cloud_api_config_secure(
  uuid, uuid, text, boolean, text, text, text, text, text, text, text, text,
  text, text, text, text, text, text, boolean, text, boolean, boolean, boolean
);

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
  p_redirect_cta_button_title text,
  p_enrich_business_messaging_user_data boolean default false,
  p_send_business_messaging_purchase_type_capi boolean default false,
  p_retargeting_enabled boolean default true,
  p_retarget_message_template text default null,
  p_retarget_delay_minutes integer default 30
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
  v_retarget_message_template text;
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
  v_retarget_message_template := coalesce(
    nullif(btrim(p_retarget_message_template), ''),
    nullif(btrim(v_existing.retarget_message_template), ''),
    $retarget_default$👋 ¡Hola! Tu asesor ya está listo para atenderte 🙋‍♂️💬

👇 Tocá el botón de abajo y enviale el mensaje para comenzar ahora. Te va a guiar paso a paso y brindarte atención personalizada. 🚀✨$retarget_default$
  );

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
  if coalesce(p_retarget_delay_minutes, 30) not between 1 and 1380 then
    raise exception 'Retargeting permite entre 1 y 1380 minutos';
  end if;
  if coalesce(p_retargeting_enabled, true) and length(btrim(v_retarget_message_template)) = 0 then
    raise exception 'Mensaje de retargeting requerido';
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
      enrich_business_messaging_user_data,
      send_business_messaging_purchase_type_capi,
      retargeting_enabled,
      retarget_message_template,
      retarget_delay_minutes,
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
      coalesce(p_enrich_business_messaging_user_data, false),
      coalesce(p_send_business_messaging_purchase_type_capi, false),
      coalesce(p_retargeting_enabled, true),
      v_retarget_message_template,
      coalesce(p_retarget_delay_minutes, 30),
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
      enrich_business_messaging_user_data = coalesce(p_enrich_business_messaging_user_data, false),
      send_business_messaging_purchase_type_capi = coalesce(p_send_business_messaging_purchase_type_capi, false),
      retargeting_enabled = coalesce(p_retargeting_enabled, true),
      retarget_message_template = v_retarget_message_template,
      retarget_delay_minutes = coalesce(p_retarget_delay_minutes, 30),
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

revoke all on function public.upsert_whatsapp_cloud_api_config_secure(
  uuid, uuid, text, boolean, text, text, text, text, text, text, text, text,
  text, text, text, text, text, text, boolean, text, boolean, boolean, boolean,
  text, integer
) from public, anon;
grant execute on function public.upsert_whatsapp_cloud_api_config_secure(
  uuid, uuid, text, boolean, text, text, text, text, text, text, text, text,
  text, text, text, text, text, text, boolean, text, boolean, boolean, boolean,
  text, integer
) to authenticated;

drop function if exists public.claim_whatsapp_cloud_api_retarget_candidates(integer, integer, integer);

create or replace function public.claim_whatsapp_cloud_api_retarget_candidates(
  p_limit integer default 25,
  p_max_age_minutes integer default 1380,
  p_min_age_minutes integer default 30
)
returns table (
  retarget_id uuid,
  retarget_kind text,
  contact_id uuid,
  config_id uuid,
  user_id uuid,
  assignment_id uuid,
  wa_id text,
  profile_name text,
  last_inbound_at timestamptz,
  phone_number_id text,
  meta_access_token text,
  meta_api_version text,
  redirect_token text,
  promo_code text,
  retarget_message_template text
)
language sql
security definer
set search_path = public, pg_temp
as $$
  with latest_assignment as (
    select distinct on (a.contact_id)
      a.contact_id,
      a.id as assignment_id,
      a.promo_code,
      a.conversion_id
    from public.whatsapp_cloud_api_assignments a
    where a.status <> 'failed'
    order by a.contact_id, a.created_at desc
  ),
  latest_redirect as (
    select distinct on (r.contact_id)
      r.contact_id,
      r.id as redirect_id,
      r.assignment_id,
      r.token,
      r.promo_code
    from public.whatsapp_cloud_api_redirects r
    order by r.contact_id, r.created_at desc
  ),
  redirect_metrics as (
    select
      r.contact_id,
      count(*) filter (where coalesce(r.click_count, 0) > 0)::integer as clicked_redirects
    from public.whatsapp_cloud_api_redirects r
    group by r.contact_id
  ),
  conversion_matches as (
    select
      wc.id as contact_id,
      c.id,
      c.lead_event_id,
      c.purchase_event_id,
      c.estado
    from public.whatsapp_cloud_api_contacts wc
    join latest_assignment la on la.contact_id = wc.id
    join public.whatsapp_cloud_api_configs cfg on cfg.id = wc.config_id
    join public.conversions c
      on c.user_id = wc.user_id
     and coalesce(c.currency, 'ARS') = coalesce(nullif(cfg.workspace_currency, ''), 'ARS')
     and la.promo_code <> ''
     and c.promo_code = la.promo_code
     and coalesce(c.test_event_code, '') = ''

    union

    select
      wc.id as contact_id,
      c.id,
      c.lead_event_id,
      c.purchase_event_id,
      c.estado
    from public.whatsapp_cloud_api_contacts wc
    join latest_assignment la on la.contact_id = wc.id
    join public.whatsapp_cloud_api_configs cfg on cfg.id = wc.config_id
    join public.conversions c
      on c.id = la.conversion_id
     and c.user_id = wc.user_id
     and coalesce(c.currency, 'ARS') = coalesce(nullif(cfg.workspace_currency, ''), 'ARS')
     and coalesce(c.test_event_code, '') = ''

    union

    select
      wc.id as contact_id,
      c.id,
      c.lead_event_id,
      c.purchase_event_id,
      c.estado
    from public.whatsapp_cloud_api_contacts wc
    join public.whatsapp_cloud_api_configs cfg on cfg.id = wc.config_id
    join public.conversions c
      on c.user_id = wc.user_id
     and coalesce(c.currency, 'ARS') = coalesce(nullif(cfg.workspace_currency, ''), 'ARS')
     and wc.external_id <> ''
     and c.external_id = wc.external_id
     and coalesce(c.test_event_code, '') = ''
  ),
  conversion_metrics as (
    select
      cm.contact_id,
      count(*) filter (where coalesce(cm.lead_event_id, '') <> '')::integer as lead_count,
      count(*) filter (
        where coalesce(cm.purchase_event_id, '') <> ''
           or cm.estado = 'purchase'
      )::integer as purchase_count
    from conversion_matches cm
    group by cm.contact_id
  ),
  candidates as (
    select
      wc.id as contact_id,
      wc.config_id,
      wc.user_id,
      wc.wa_id,
      wc.profile_name,
      coalesce(wc.last_inbound_at, wc.first_message_at) as last_inbound_at,
      cfg.phone_number_id,
      cfg.meta_access_token,
      cfg.meta_api_version,
      cfg.retarget_message_template,
      la.assignment_id,
      lr.redirect_id,
      lr.token,
      coalesce(lr.promo_code, la.promo_code, '') as promo_code,
      case
        when coalesce(rm.clicked_redirects, 0) > 0 then 'contact'
        else 'new'
      end as retarget_kind
    from public.whatsapp_cloud_api_contacts wc
    join public.whatsapp_cloud_api_configs cfg on cfg.id = wc.config_id
    join latest_assignment la on la.contact_id = wc.id
    join latest_redirect lr on lr.contact_id = wc.id
    left join redirect_metrics rm on rm.contact_id = wc.id
    left join conversion_metrics cm on cm.contact_id = wc.id
    where cfg.active = true
      and cfg.retargeting_enabled = true
      and coalesce(cfg.meta_access_token, '') <> ''
      and coalesce(wc.last_inbound_at, wc.first_message_at) is not null
      and coalesce(wc.last_inbound_at, wc.first_message_at) >= now() - make_interval(mins => least(1380, greatest(1, coalesce(p_max_age_minutes, 1380))))
      and coalesce(wc.last_inbound_at, wc.first_message_at) <= now() - make_interval(mins => least(1380, greatest(1, coalesce(cfg.retarget_delay_minutes, p_min_age_minutes, 30))))
      and coalesce(wc.last_inbound_at, wc.first_message_at) <= now() + interval '5 minutes'
      and coalesce(cm.lead_count, 0) = 0
      and coalesce(cm.purchase_count, 0) = 0
      and not exists (
        select 1
        from public.whatsapp_cloud_api_retarget_messages rt
        where rt.contact_id = wc.id
      )
    order by coalesce(wc.last_inbound_at, wc.first_message_at) asc
    limit greatest(1, least(coalesce(p_limit, 25), 100))
  ),
  claimed as (
    insert into public.whatsapp_cloud_api_retarget_messages (
      config_id,
      user_id,
      contact_id,
      assignment_id,
      redirect_id,
      retarget_kind,
      last_inbound_at,
      status
    )
    select
      c.config_id,
      c.user_id,
      c.contact_id,
      c.assignment_id,
      c.redirect_id,
      c.retarget_kind,
      c.last_inbound_at,
      'processing'
    from candidates c
    on conflict (contact_id) do nothing
    returning *
  )
  select
    cl.id as retarget_id,
    cl.retarget_kind,
    c.contact_id,
    c.config_id,
    c.user_id,
    c.assignment_id,
    c.wa_id,
    c.profile_name,
    c.last_inbound_at,
    c.phone_number_id,
    c.meta_access_token,
    c.meta_api_version,
    c.token as redirect_token,
    c.promo_code,
    c.retarget_message_template
  from claimed cl
  join candidates c
    on c.contact_id = cl.contact_id;
$$;

comment on function public.claim_whatsapp_cloud_api_retarget_candidates(integer, integer, integer) is
  'Reclama candidatos de retarget WCA usando el delay configurable por config y una ventana maxima de 23 horas.';

revoke all on function public.claim_whatsapp_cloud_api_retarget_candidates(integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.claim_whatsapp_cloud_api_retarget_candidates(integer, integer, integer)
  to service_role;
