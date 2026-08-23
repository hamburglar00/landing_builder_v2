create or replace function public.claim_whatsapp_cloud_api_retarget_candidates(
  p_limit integer default 25,
  p_max_age_minutes integer default 1440,
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
  promo_code text
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
      and coalesce(wc.last_inbound_at, wc.first_message_at) >= now() - make_interval(mins => greatest(1440, p_max_age_minutes))
      and coalesce(wc.last_inbound_at, wc.first_message_at) <= now() - make_interval(mins => greatest(30, p_min_age_minutes))
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
    c.promo_code
  from claimed cl
  join candidates c
    on c.contact_id = cl.contact_id;
$$;

comment on function public.claim_whatsapp_cloud_api_retarget_candidates(integer, integer, integer) is
  'Reclama candidatos de retarget WCA desde 30 minutos despues del ultimo inbound y hasta al menos 24 horas, aun si un caller viejo envia una ventana menor.';

revoke all on function public.claim_whatsapp_cloud_api_retarget_candidates(integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.claim_whatsapp_cloud_api_retarget_candidates(integer, integer, integer)
  to service_role;
