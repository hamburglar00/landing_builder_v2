delete from public.conversion_journey_starts
where source_platform = 'landing';

comment on table public.conversion_journey_starts is
  'Inicios de recorrido anteriores al Contact: PageViews internos de landing y chats iniciados en WhatsApp Cloud API.';
comment on column public.conversion_journey_starts.start_identity_key is
  'Clave estable por usuario, origen y recorrido. Landing usa TTL movil de 5 minutos; WhatsApp Cloud API mantiene dedupe por chat.';

create or replace function public.record_conversion_journey_start(
  p_user_id uuid,
  p_source_platform text,
  p_start_identity_key text,
  p_landing_id uuid default null,
  p_landing_name text default '',
  p_workspace_currency text default 'ARS',
  p_external_id text default '',
  p_phone text default '',
  p_wa_id text default '',
  p_email text default '',
  p_utm_campaign text default '',
  p_fbp text default '',
  p_fbc text default '',
  p_from_meta_ads boolean default false,
  p_meta_pixel_id text default '',
  p_dataset_id text default '',
  p_ctwa_clid text default '',
  p_telefono_asignado text default '',
  p_assigned_gerencia_id integer default null,
  p_assigned_gerencia_external_id integer default null,
  p_assigned_gerencia_name text default null,
  p_assigned_gerencia_label text default null,
  p_device_type text default '',
  p_event_source_url text default '',
  p_client_ip text default '',
  p_agent_user text default '',
  p_first_seen_at timestamptz default null,
  p_last_seen_at timestamptz default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_source text := lower(btrim(coalesce(p_source_platform, '')));
  v_identity text := btrim(coalesce(p_start_identity_key, ''));
  v_workspace_currency text := upper(btrim(coalesce(p_workspace_currency, 'ARS')));
  v_external_id text := btrim(coalesce(p_external_id, ''));
  v_first_seen_at timestamptz := coalesce(p_first_seen_at, now());
  v_last_seen_at timestamptz := coalesce(p_last_seen_at, p_first_seen_at, now());
begin
  if p_user_id is null then
    raise exception 'p_user_id is required';
  end if;
  if v_source not in ('landing', 'whatsapp_cloud_api') then
    raise exception 'source_platform invalido: %', v_source;
  end if;
  if v_identity = '' then
    raise exception 'p_start_identity_key is required';
  end if;
  if v_workspace_currency not in ('ARS', 'PYG') then
    v_workspace_currency := 'ARS';
  end if;

  if v_source = 'landing' then
    if p_landing_id is null then
      raise exception 'p_landing_id is required for landing PageView';
    end if;
    if v_external_id = '' then
      raise exception 'p_external_id is required for landing PageView';
    end if;

    perform pg_advisory_xact_lock(
      hashtext('conversion_journey_starts_landing'),
      hashtext(p_user_id::text || ':' || p_landing_id::text || ':' || lower(v_external_id))
    );

    select id
      into v_id
    from public.conversion_journey_starts
    where user_id = p_user_id
      and source_platform = 'landing'
      and landing_id = p_landing_id
      and external_id = v_external_id
      and first_seen_at >= v_first_seen_at - interval '5 minutes'
      and first_seen_at <= v_first_seen_at + interval '5 minutes'
    order by first_seen_at desc
    limit 1
    for update;

    if v_id is not null then
      update public.conversion_journey_starts
      set
        landing_name = coalesce(nullif(btrim(coalesce(p_landing_name, '')), ''), landing_name),
        workspace_currency = coalesce(nullif(v_workspace_currency, ''), workspace_currency),
        phone = coalesce(nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), ''), phone),
        email = coalesce(nullif(lower(btrim(coalesce(p_email, ''))), ''), email),
        utm_campaign = coalesce(nullif(btrim(coalesce(p_utm_campaign, '')), ''), utm_campaign),
        fbp = coalesce(nullif(btrim(coalesce(p_fbp, '')), ''), fbp),
        fbc = coalesce(nullif(btrim(coalesce(p_fbc, '')), ''), fbc),
        from_meta_ads = conversion_journey_starts.from_meta_ads or coalesce(p_from_meta_ads, false),
        meta_pixel_id = coalesce(nullif(regexp_replace(coalesce(p_meta_pixel_id, ''), '\D', '', 'g'), ''), meta_pixel_id),
        telefono_asignado = coalesce(nullif(regexp_replace(coalesce(p_telefono_asignado, ''), '\D', '', 'g'), ''), telefono_asignado),
        assigned_gerencia_id = coalesce(p_assigned_gerencia_id, assigned_gerencia_id),
        assigned_gerencia_external_id = coalesce(p_assigned_gerencia_external_id, assigned_gerencia_external_id),
        assigned_gerencia_name = coalesce(nullif(btrim(coalesce(p_assigned_gerencia_name, '')), ''), assigned_gerencia_name),
        assigned_gerencia_label = coalesce(nullif(btrim(coalesce(p_assigned_gerencia_label, '')), ''), assigned_gerencia_label),
        device_type = coalesce(nullif(btrim(coalesce(p_device_type, '')), ''), device_type),
        event_source_url = coalesce(nullif(left(btrim(coalesce(p_event_source_url, '')), 2048), ''), event_source_url),
        client_ip = coalesce(nullif(btrim(coalesce(p_client_ip, '')), ''), client_ip),
        agent_user = coalesce(nullif(left(btrim(coalesce(p_agent_user, '')), 1024), ''), agent_user),
        last_seen_at = greatest(last_seen_at, v_last_seen_at),
        updated_at = now()
      where id = v_id;

      return v_id;
    end if;
  end if;

  insert into public.conversion_journey_starts (
    user_id,
    source_platform,
    start_identity_key,
    landing_id,
    landing_name,
    workspace_currency,
    external_id,
    phone,
    wa_id,
    email,
    utm_campaign,
    fbp,
    fbc,
    from_meta_ads,
    meta_pixel_id,
    dataset_id,
    ctwa_clid,
    telefono_asignado,
    assigned_gerencia_id,
    assigned_gerencia_external_id,
    assigned_gerencia_name,
    assigned_gerencia_label,
    device_type,
    event_source_url,
    client_ip,
    agent_user,
    first_seen_at,
    last_seen_at
  ) values (
    p_user_id,
    v_source,
    v_identity,
    p_landing_id,
    btrim(coalesce(p_landing_name, '')),
    v_workspace_currency,
    v_external_id,
    regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'),
    regexp_replace(coalesce(p_wa_id, ''), '\D', '', 'g'),
    lower(btrim(coalesce(p_email, ''))),
    btrim(coalesce(p_utm_campaign, '')),
    btrim(coalesce(p_fbp, '')),
    btrim(coalesce(p_fbc, '')),
    coalesce(p_from_meta_ads, false),
    regexp_replace(coalesce(p_meta_pixel_id, ''), '\D', '', 'g'),
    btrim(coalesce(p_dataset_id, '')),
    btrim(coalesce(p_ctwa_clid, '')),
    regexp_replace(coalesce(p_telefono_asignado, ''), '\D', '', 'g'),
    p_assigned_gerencia_id,
    p_assigned_gerencia_external_id,
    nullif(btrim(coalesce(p_assigned_gerencia_name, '')), ''),
    nullif(btrim(coalesce(p_assigned_gerencia_label, '')), ''),
    btrim(coalesce(p_device_type, '')),
    left(btrim(coalesce(p_event_source_url, '')), 2048),
    btrim(coalesce(p_client_ip, '')),
    left(btrim(coalesce(p_agent_user, '')), 1024),
    v_first_seen_at,
    v_last_seen_at
  )
  on conflict on constraint conversion_journey_starts_identity_unique do update
  set
    landing_id = coalesce(excluded.landing_id, conversion_journey_starts.landing_id),
    landing_name = coalesce(nullif(excluded.landing_name, ''), conversion_journey_starts.landing_name),
    workspace_currency = coalesce(nullif(excluded.workspace_currency, ''), conversion_journey_starts.workspace_currency),
    external_id = coalesce(nullif(excluded.external_id, ''), conversion_journey_starts.external_id),
    phone = coalesce(nullif(excluded.phone, ''), conversion_journey_starts.phone),
    wa_id = coalesce(nullif(excluded.wa_id, ''), conversion_journey_starts.wa_id),
    email = coalesce(nullif(excluded.email, ''), conversion_journey_starts.email),
    utm_campaign = coalesce(nullif(excluded.utm_campaign, ''), conversion_journey_starts.utm_campaign),
    fbp = coalesce(nullif(excluded.fbp, ''), conversion_journey_starts.fbp),
    fbc = coalesce(nullif(excluded.fbc, ''), conversion_journey_starts.fbc),
    from_meta_ads = conversion_journey_starts.from_meta_ads or excluded.from_meta_ads,
    meta_pixel_id = coalesce(nullif(excluded.meta_pixel_id, ''), conversion_journey_starts.meta_pixel_id),
    dataset_id = coalesce(nullif(excluded.dataset_id, ''), conversion_journey_starts.dataset_id),
    ctwa_clid = coalesce(nullif(excluded.ctwa_clid, ''), conversion_journey_starts.ctwa_clid),
    telefono_asignado = coalesce(nullif(excluded.telefono_asignado, ''), conversion_journey_starts.telefono_asignado),
    assigned_gerencia_id = coalesce(excluded.assigned_gerencia_id, conversion_journey_starts.assigned_gerencia_id),
    assigned_gerencia_external_id = coalesce(excluded.assigned_gerencia_external_id, conversion_journey_starts.assigned_gerencia_external_id),
    assigned_gerencia_name = coalesce(excluded.assigned_gerencia_name, conversion_journey_starts.assigned_gerencia_name),
    assigned_gerencia_label = coalesce(excluded.assigned_gerencia_label, conversion_journey_starts.assigned_gerencia_label),
    device_type = coalesce(nullif(excluded.device_type, ''), conversion_journey_starts.device_type),
    event_source_url = coalesce(nullif(excluded.event_source_url, ''), conversion_journey_starts.event_source_url),
    client_ip = coalesce(nullif(excluded.client_ip, ''), conversion_journey_starts.client_ip),
    agent_user = coalesce(nullif(excluded.agent_user, ''), conversion_journey_starts.agent_user),
    first_seen_at = least(conversion_journey_starts.first_seen_at, excluded.first_seen_at),
    last_seen_at = greatest(conversion_journey_starts.last_seen_at, excluded.last_seen_at),
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;
