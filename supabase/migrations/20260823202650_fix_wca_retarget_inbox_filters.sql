drop function if exists public.record_whatsapp_cloud_api_redirect_click(text, text, text);

create or replace function public.record_whatsapp_cloud_api_redirect_click(
  p_token text,
  p_ip text default '',
  p_user_agent text default ''
)
returns table (
  wa_link text,
  redirect_id uuid,
  config_id uuid,
  user_id uuid,
  contact_id uuid,
  assignment_id uuid,
  conversion_id uuid,
  phone_number_id text,
  config_name text,
  workspace_currency text,
  meta_messaging_dataset_id text,
  assigned_phone text,
  assigned_gerencia_id integer,
  assigned_gerencia_external_id integer,
  assigned_gerencia_label text,
  promo_code text,
  wa_id text,
  profile_name text,
  first_message_id text,
  first_message_at timestamptz,
  ctwa_clid text,
  referral jsonb,
  first_click boolean
)
language sql
security definer
set search_path = public, pg_temp
as $$
  with matched as (
    select
      r.*,
      r.first_clicked_at is null as first_click
    from public.whatsapp_cloud_api_redirects r
    where r.token = btrim(coalesce(p_token, ''))
    for update
  ),
  updated as (
    update public.whatsapp_cloud_api_redirects r
    set
      status = 'clicked',
      click_count = r.click_count + 1,
      first_clicked_at = coalesce(r.first_clicked_at, now()),
      last_clicked_at = now(),
      last_click_ip = left(coalesce(p_ip, ''), 128),
      last_click_user_agent = left(coalesce(p_user_agent, ''), 500)
    from matched m
    where r.id = m.id
    returning r.*, m.first_click
  )
  select
    u.wa_link,
    u.id as redirect_id,
    u.config_id,
    u.user_id,
    u.contact_id,
    u.assignment_id,
    a.conversion_id,
    cfg.phone_number_id,
    cfg.name as config_name,
    coalesce(nullif(cfg.workspace_currency, ''), 'ARS') as workspace_currency,
    cfg.meta_messaging_dataset_id,
    u.assigned_phone,
    u.assigned_gerencia_id,
    g.gerencia_id as assigned_gerencia_external_id,
    coalesce(
      case
        when g.nombre is not null and g.gerencia_id is not null then g.nombre || ' (' || g.gerencia_id::text || ')'
        when g.nombre is not null then g.nombre || ' (' || g.id::text || ')'
        else null
      end,
      ''
    ) as assigned_gerencia_label,
    u.promo_code,
    c.wa_id,
    c.profile_name,
    a.first_message_id,
    c.first_message_at,
    coalesce(s.ctwa_clid, '') as ctwa_clid,
    coalesce(s.referral, '{}'::jsonb) as referral,
    u.first_click
  from updated u
  join public.whatsapp_cloud_api_configs cfg on cfg.id = u.config_id
  join public.whatsapp_cloud_api_contacts c on c.id = u.contact_id
  join public.whatsapp_cloud_api_assignments a on a.id = u.assignment_id
  left join public.gerencias g on g.id = u.assigned_gerencia_id
  left join public.whatsapp_cloud_api_attribution_sessions s
    on s.id = u.attribution_session_id;
$$;

revoke all on function public.record_whatsapp_cloud_api_redirect_click(text, text, text)
  from public, anon, authenticated;
grant execute on function public.record_whatsapp_cloud_api_redirect_click(text, text, text)
  to service_role;

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
      and coalesce(wc.last_inbound_at, wc.first_message_at) >= now() - make_interval(mins => greatest(1, p_max_age_minutes))
      and coalesce(wc.last_inbound_at, wc.first_message_at) <= now() - make_interval(mins => greatest(0, p_min_age_minutes))
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
  'Reclama candidatos de retarget WCA desde 30 minutos despues del ultimo inbound y dentro de la ventana activa, sin lead/purchase, sin retarget previo y con retargeting habilitado.';

revoke all on function public.claim_whatsapp_cloud_api_retarget_candidates(integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.claim_whatsapp_cloud_api_retarget_candidates(integer, integer, integer)
  to service_role;

create or replace function public.get_whatsapp_cloud_api_inbox_threads_page(
  p_limit integer default 20,
  p_offset integer default 0,
  p_workspace_currency text default null,
  p_tag_filter text default 'all',
  p_unread_only boolean default false
)
returns table (
  contact_id uuid,
  config_id uuid,
  config_name text,
  user_id uuid,
  wa_id text,
  phone text,
  profile_name text,
  first_message_at timestamptz,
  last_message_at timestamptz,
  last_message_text text,
  last_message_direction text,
  last_message_status text,
  assigned_phone text,
  assigned_gerencia_id integer,
  assigned_gerencia_label text,
  promo_code text,
  ctwa_clid text,
  source_url text,
  source_type text,
  headline text,
  conversion_id uuid,
  lead_count integer,
  purchase_count integer,
  repeat_purchase_count integer,
  total_loaded numeric,
  last_purchase_at timestamptz,
  tag text,
  redirect_clicked boolean,
  redirect_click_count integer,
  redirect_last_clicked_at timestamptz,
  unread_count integer,
  unread_last_message_at timestamptz,
  messages jsonb,
  total_threads bigint
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
  requested_scope as (
    select case
      when upper(coalesce(nullif(btrim(p_workspace_currency), ''), '')) in ('ARS', 'PYG')
        then upper(btrim(p_workspace_currency))
      else null
    end as workspace_currency
  ),
  requested_filter as (
    select case
      when lower(coalesce(nullif(btrim(p_tag_filter), ''), 'all')) in
        ('all', 'nuevo', 'contacto', 'lead', 'cargo', 'recompra', 'premium')
        then lower(coalesce(nullif(btrim(p_tag_filter), ''), 'all'))
      else 'all'
    end as tag_filter
  ),
  visible_contacts as (
    select
      wc.id,
      wc.config_id,
      wc.user_id,
      wc.wa_id,
      wc.phone,
      coalesce(wc.profile_name, '') as profile_name,
      wc.first_message_at,
      wc.last_message_at,
      wc.created_at,
      coalesce(wc.external_id, '') as external_id,
      cfg.name as config_name,
      coalesce(nullif(cfg.workspace_currency, ''), 'ARS') as workspace_currency
    from public.whatsapp_cloud_api_contacts wc
    join public.whatsapp_cloud_api_configs cfg on cfg.id = wc.config_id
    cross join viewer v
    cross join requested_scope rs
    where v.uid is not null
      and (v.is_admin or wc.user_id = v.uid)
      and (
        rs.workspace_currency is null
        or coalesce(nullif(cfg.workspace_currency, ''), 'ARS') = rs.workspace_currency
      )
  ),
  latest_assignment as (
    select distinct on (a.contact_id)
      a.contact_id,
      a.id,
      a.config_id,
      a.webhook_event_id,
      coalesce(a.assigned_phone, '') as assigned_phone,
      a.assigned_gerencia_id,
      coalesce(
        case
          when g.nombre is not null and g.gerencia_id is not null then g.nombre || ' (' || g.gerencia_id::text || ')'
          when g.nombre is not null then g.nombre || ' (' || g.id::text || ')'
          else null
        end,
        a.assigned_gerencia_label,
        ''
      ) as assigned_gerencia_label,
      coalesce(a.promo_code, '') as promo_code,
      a.conversion_id,
      a.status,
      a.created_at
    from public.whatsapp_cloud_api_assignments a
    join visible_contacts vc on vc.id = a.contact_id
    left join public.gerencias g
      on g.id = a.assigned_gerencia_id
     and g.workspace_currency = vc.workspace_currency
    order by a.contact_id, a.created_at desc
  ),
  redirect_metrics as (
    select
      r.contact_id,
      coalesce(sum(r.click_count), 0)::integer as click_count,
      max(r.last_clicked_at) as last_clicked_at
    from public.whatsapp_cloud_api_redirects r
    join visible_contacts vc on vc.id = r.contact_id
    group by r.contact_id
  ),
  conversion_matches as (
    select
      vc.id as contact_id,
      c.id,
      c.lead_event_id,
      c.purchase_event_id,
      c.estado,
      c.purchase_type,
      c.valor,
      c.purchase_event_time,
      c.created_at
    from visible_contacts vc
    join public.conversions c
      on c.user_id = vc.user_id
     and coalesce(c.currency, 'ARS') = vc.workspace_currency
     and vc.external_id <> ''
     and c.external_id = vc.external_id
     and coalesce(c.test_event_code, '') = ''

    union

    select
      vc.id as contact_id,
      c.id,
      c.lead_event_id,
      c.purchase_event_id,
      c.estado,
      c.purchase_type,
      c.valor,
      c.purchase_event_time,
      c.created_at
    from visible_contacts vc
    join latest_assignment la on la.contact_id = vc.id
    join public.conversions c
      on c.user_id = vc.user_id
     and coalesce(c.currency, 'ARS') = vc.workspace_currency
     and la.promo_code <> ''
     and c.promo_code = la.promo_code
     and coalesce(c.test_event_code, '') = ''

    union

    select
      vc.id as contact_id,
      c.id,
      c.lead_event_id,
      c.purchase_event_id,
      c.estado,
      c.purchase_type,
      c.valor,
      c.purchase_event_time,
      c.created_at
    from visible_contacts vc
    join latest_assignment la on la.contact_id = vc.id
    join public.conversions c
      on c.id = la.conversion_id
     and c.user_id = vc.user_id
     and coalesce(c.currency, 'ARS') = vc.workspace_currency
     and coalesce(c.test_event_code, '') = ''
  ),
  conversion_metrics as (
    select
      cm.contact_id,
      count(*) filter (where coalesce(cm.lead_event_id, '') <> '')::integer as lead_count,
      count(*) filter (
        where coalesce(cm.purchase_event_id, '') <> ''
           or cm.estado = 'purchase'
      )::integer as purchase_count,
      count(*) filter (
        where cm.purchase_type = 'repeat'
          and (
            coalesce(cm.purchase_event_id, '') <> ''
            or cm.estado = 'purchase'
          )
      )::integer as repeat_purchase_count,
      coalesce(sum(cm.valor) filter (
        where coalesce(cm.purchase_event_id, '') <> ''
           or cm.estado = 'purchase'
      ), 0)::numeric as total_loaded,
      max(coalesce(to_timestamp(nullif(cm.purchase_event_time, 0)), cm.created_at)) filter (
        where coalesce(cm.purchase_event_id, '') <> ''
           or cm.estado = 'purchase'
      ) as last_purchase_at
    from conversion_matches cm
    group by cm.contact_id
  ),
  thresholds as (
    select
      vc.id as contact_id,
      coalesce(
        case
          when (cc.funnel_premium_thresholds ->> vc.workspace_currency) ~ '^[0-9]+([.][0-9]+)?$'
            then (cc.funnel_premium_thresholds ->> vc.workspace_currency)::numeric
          else null
        end,
        cc.funnel_premium_threshold,
        50000
      ) as premium_threshold
    from visible_contacts vc
    left join public.conversions_config cc on cc.user_id = vc.user_id
  ),
  read_state as (
    select
      vc.id as contact_id,
      coalesce(r.last_read_at, 'epoch'::timestamptz) as last_read_at
    from visible_contacts vc
    cross join viewer v
    left join public.whatsapp_cloud_api_thread_reads r
      on r.contact_id = vc.id
     and r.reader_user_id = v.uid
  ),
  unread_metrics as (
    select
      vc.id as contact_id,
      coalesce(u.unread_count, 0)::integer as unread_count,
      u.unread_last_message_at
    from visible_contacts vc
    join read_state rs on rs.contact_id = vc.id
    left join lateral (
      select
        count(*)::integer as unread_count,
        max(e.received_at) as unread_last_message_at
      from public.whatsapp_cloud_api_webhook_events e
      where e.config_id = vc.config_id
        and e.event_type = 'message'
        and coalesce(
          e.payload #>> '{message,from}',
          e.payload #>> '{entry,0,changes,0,value,messages,0,from}',
          ''
        ) = vc.wa_id
        and e.received_at > rs.last_read_at
    ) u on true
  ),
  tagged_contacts as (
    select
      vc.*,
      coalesce(la.assigned_phone, '') as assigned_phone,
      la.assigned_gerencia_id,
      coalesce(la.assigned_gerencia_label, '') as assigned_gerencia_label,
      coalesce(la.promo_code, '') as promo_code,
      la.conversion_id,
      coalesce(cm.lead_count, 0) as lead_count,
      coalesce(cm.purchase_count, 0) as purchase_count,
      coalesce(cm.repeat_purchase_count, 0) as repeat_purchase_count,
      coalesce(cm.total_loaded, 0) as total_loaded,
      cm.last_purchase_at,
      coalesce(rm.click_count, 0) as redirect_click_count,
      rm.last_clicked_at as redirect_last_clicked_at,
      coalesce(um.unread_count, 0) as unread_count,
      um.unread_last_message_at,
      case
        when coalesce(cm.total_loaded, 0) >= coalesce(t.premium_threshold, 50000) then 'premium'
        when coalesce(cm.repeat_purchase_count, 0) > 0 or coalesce(cm.purchase_count, 0) > 1 then 'recompra'
        when coalesce(cm.purchase_count, 0) > 0 then 'cargo'
        when coalesce(cm.lead_count, 0) > 0 then 'lead'
        when coalesce(rm.click_count, 0) > 0 then 'contacto'
        else 'nuevo'
      end as tag
    from visible_contacts vc
    left join latest_assignment la on la.contact_id = vc.id
    left join redirect_metrics rm on rm.contact_id = vc.id
    left join conversion_metrics cm on cm.contact_id = vc.id
    left join thresholds t on t.contact_id = vc.id
    left join unread_metrics um on um.contact_id = vc.id
  ),
  filtered_contacts as (
    select tc.*
    from tagged_contacts tc
    cross join requested_filter rf
    where (rf.tag_filter = 'all' or tc.tag = rf.tag_filter)
      and (coalesce(p_unread_only, false) = false or tc.unread_count > 0)
  ),
  total_count as (
    select count(*)::bigint as total_threads from filtered_contacts
  ),
  limited_contacts as (
    select *
    from filtered_contacts
    order by coalesce(last_message_at, created_at) desc
    limit greatest(1, least(coalesce(p_limit, 20), 20))
    offset greatest(0, coalesce(p_offset, 0))
  ),
  latest_session as (
    select distinct on (s.contact_id)
      s.contact_id,
      s.ctwa_clid,
      s.source_url,
      s.source_type,
      s.headline,
      s.started_at
    from public.whatsapp_cloud_api_attribution_sessions s
    join limited_contacts lc on lc.id = s.contact_id
    order by s.contact_id, s.started_at desc
  ),
  inbound_messages as (
    select
      lc.id as contact_id,
      e.received_at as created_at,
      'inbound'::text as direction,
      coalesce(
        e.payload #>> '{message,text,body}',
        e.payload #>> '{message,button,text}',
        e.payload #>> '{message,interactive,button_reply,title}',
        e.payload #>> '{entry,0,changes,0,value,messages,0,text,body}',
        e.payload #>> '{entry,0,changes,0,value,messages,0,button,text}',
        e.payload #>> '{entry,0,changes,0,value,messages,0,interactive,button_reply,title}',
        e.event_type
      ) as body,
      'text'::text as message_type,
      null::text as button_title,
      null::text as button_url,
      e.status,
      e.meta_message_id,
      null::text as error
    from limited_contacts lc
    join lateral (
      select e.*
      from public.whatsapp_cloud_api_webhook_events e
      where e.config_id = lc.config_id
        and e.event_type = 'message'
        and coalesce(
          e.payload #>> '{message,from}',
          e.payload #>> '{entry,0,changes,0,value,messages,0,from}',
          ''
        ) = lc.wa_id
      order by e.received_at desc
      limit 50
    ) e on true
  ),
  outbound_messages as (
    select
      lc.id as contact_id,
      o.created_at,
      'outbound'::text as direction,
      coalesce(
        o.payload #>> '{text,body}',
        o.payload #>> '{interactive,body,text}',
        o.message_type
      ) as body,
      coalesce(o.message_type, o.payload #>> '{type}', 'text') as message_type,
      coalesce(o.payload #>> '{interactive,action,parameters,display_text}', '') as button_title,
      coalesce(o.payload #>> '{interactive,action,parameters,url}', '') as button_url,
      o.status,
      o.meta_message_id,
      o.last_error as error
    from limited_contacts lc
    join lateral (
      select o.*
      from public.whatsapp_cloud_api_outbound_messages o
      where o.config_id = lc.config_id
        and o.recipient_wa_id = lc.wa_id
      order by o.created_at desc
      limit 50
    ) o on true
  ),
  all_messages as (
    select * from inbound_messages
    union all
    select * from outbound_messages
  ),
  ranked_messages as (
    select
      m.*,
      row_number() over (
        partition by m.contact_id
        order by m.created_at desc
      ) as rn
    from all_messages m
  ),
  last_message as (
    select
      m.contact_id,
      m.body,
      m.direction,
      m.status,
      m.created_at
    from ranked_messages m
    where m.rn = 1
  ),
  message_json as (
    select
      x.contact_id,
      jsonb_agg(
        jsonb_build_object(
          'created_at', x.created_at,
          'direction', x.direction,
          'body', x.body,
          'message_type', x.message_type,
          'button_title', x.button_title,
          'button_url', x.button_url,
          'status', x.status,
          'meta_message_id', x.meta_message_id,
          'error', x.error
        )
        order by x.created_at asc
      ) as messages
    from ranked_messages x
    where x.rn <= 50
    group by x.contact_id
  )
  select
    lc.id as contact_id,
    lc.config_id,
    lc.config_name,
    lc.user_id,
    lc.wa_id,
    lc.phone,
    lc.profile_name,
    lc.first_message_at,
    lc.last_message_at,
    coalesce(lm.body, '') as last_message_text,
    coalesce(lm.direction, '') as last_message_direction,
    coalesce(lm.status, '') as last_message_status,
    lc.assigned_phone,
    lc.assigned_gerencia_id,
    lc.assigned_gerencia_label,
    lc.promo_code,
    coalesce(ls.ctwa_clid, '') as ctwa_clid,
    coalesce(ls.source_url, '') as source_url,
    coalesce(ls.source_type, '') as source_type,
    coalesce(ls.headline, '') as headline,
    lc.conversion_id,
    lc.lead_count,
    lc.purchase_count,
    lc.repeat_purchase_count,
    lc.total_loaded,
    lc.last_purchase_at,
    lc.tag,
    lc.redirect_click_count > 0 as redirect_clicked,
    lc.redirect_click_count,
    lc.redirect_last_clicked_at,
    lc.unread_count,
    lc.unread_last_message_at,
    coalesce(mj.messages, '[]'::jsonb) as messages,
    tc.total_threads
  from limited_contacts lc
  cross join total_count tc
  left join latest_session ls on ls.contact_id = lc.id
  left join last_message lm on lm.contact_id = lc.id
  left join message_json mj on mj.contact_id = lc.id
  order by coalesce(lm.created_at, lc.last_message_at, lc.first_message_at) desc;
$$;

comment on function public.get_whatsapp_cloud_api_inbox_threads_page(integer, integer, text, text, boolean) is
  'Devuelve una pagina filtrada de threads del Inbox WCA y el total del filtro activo.';

revoke all on function public.get_whatsapp_cloud_api_inbox_threads_page(integer, integer, text, text, boolean)
  from public, anon;
grant execute on function public.get_whatsapp_cloud_api_inbox_threads_page(integer, integer, text, text, boolean)
  to authenticated;

create or replace function public.mark_whatsapp_cloud_api_threads_read(
  p_workspace_currency text default null,
  p_tag_filter text default 'all'
)
returns integer
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
  requested_scope as (
    select case
      when upper(coalesce(nullif(btrim(p_workspace_currency), ''), '')) in ('ARS', 'PYG')
        then upper(btrim(p_workspace_currency))
      else null
    end as workspace_currency
  ),
  requested_filter as (
    select case
      when lower(coalesce(nullif(btrim(p_tag_filter), ''), 'all')) in
        ('all', 'nuevo', 'contacto', 'lead', 'cargo', 'recompra', 'premium')
        then lower(coalesce(nullif(btrim(p_tag_filter), ''), 'all'))
      else 'all'
    end as tag_filter
  ),
  visible_contacts as (
    select
      wc.id,
      wc.config_id,
      wc.user_id,
      wc.wa_id,
      wc.external_id,
      coalesce(nullif(cfg.workspace_currency, ''), 'ARS') as workspace_currency
    from public.whatsapp_cloud_api_contacts wc
    join public.whatsapp_cloud_api_configs cfg on cfg.id = wc.config_id
    cross join viewer v
    cross join requested_scope rs
    where v.uid is not null
      and (v.is_admin or wc.user_id = v.uid)
      and (
        rs.workspace_currency is null
        or coalesce(nullif(cfg.workspace_currency, ''), 'ARS') = rs.workspace_currency
      )
  ),
  latest_assignment as (
    select distinct on (a.contact_id)
      a.contact_id,
      coalesce(a.promo_code, '') as promo_code,
      a.conversion_id
    from public.whatsapp_cloud_api_assignments a
    join visible_contacts vc on vc.id = a.contact_id
    order by a.contact_id, a.created_at desc
  ),
  redirect_metrics as (
    select
      r.contact_id,
      coalesce(sum(r.click_count), 0)::integer as click_count
    from public.whatsapp_cloud_api_redirects r
    join visible_contacts vc on vc.id = r.contact_id
    group by r.contact_id
  ),
  conversion_matches as (
    select
      vc.id as contact_id,
      c.id,
      c.lead_event_id,
      c.purchase_event_id,
      c.estado,
      c.purchase_type,
      c.valor
    from visible_contacts vc
    join public.conversions c
      on c.user_id = vc.user_id
     and coalesce(c.currency, 'ARS') = vc.workspace_currency
     and vc.external_id <> ''
     and c.external_id = vc.external_id
     and coalesce(c.test_event_code, '') = ''

    union

    select
      vc.id as contact_id,
      c.id,
      c.lead_event_id,
      c.purchase_event_id,
      c.estado,
      c.purchase_type,
      c.valor
    from visible_contacts vc
    join latest_assignment la on la.contact_id = vc.id
    join public.conversions c
      on c.user_id = vc.user_id
     and coalesce(c.currency, 'ARS') = vc.workspace_currency
     and la.promo_code <> ''
     and c.promo_code = la.promo_code
     and coalesce(c.test_event_code, '') = ''

    union

    select
      vc.id as contact_id,
      c.id,
      c.lead_event_id,
      c.purchase_event_id,
      c.estado,
      c.purchase_type,
      c.valor
    from visible_contacts vc
    join latest_assignment la on la.contact_id = vc.id
    join public.conversions c
      on c.id = la.conversion_id
     and c.user_id = vc.user_id
     and coalesce(c.currency, 'ARS') = vc.workspace_currency
     and coalesce(c.test_event_code, '') = ''
  ),
  conversion_metrics as (
    select
      cm.contact_id,
      count(*) filter (where coalesce(cm.lead_event_id, '') <> '')::integer as lead_count,
      count(*) filter (
        where coalesce(cm.purchase_event_id, '') <> ''
           or cm.estado = 'purchase'
      )::integer as purchase_count,
      count(*) filter (
        where cm.purchase_type = 'repeat'
          and (
            coalesce(cm.purchase_event_id, '') <> ''
            or cm.estado = 'purchase'
          )
      )::integer as repeat_purchase_count,
      coalesce(sum(cm.valor) filter (
        where coalesce(cm.purchase_event_id, '') <> ''
           or cm.estado = 'purchase'
      ), 0)::numeric as total_loaded
    from conversion_matches cm
    group by cm.contact_id
  ),
  thresholds as (
    select
      vc.id as contact_id,
      coalesce(
        case
          when (cc.funnel_premium_thresholds ->> vc.workspace_currency) ~ '^[0-9]+([.][0-9]+)?$'
            then (cc.funnel_premium_thresholds ->> vc.workspace_currency)::numeric
          else null
        end,
        cc.funnel_premium_threshold,
        50000
      ) as premium_threshold
    from visible_contacts vc
    left join public.conversions_config cc on cc.user_id = vc.user_id
  ),
  read_state as (
    select
      vc.id as contact_id,
      coalesce(r.last_read_at, 'epoch'::timestamptz) as last_read_at
    from visible_contacts vc
    cross join viewer v
    left join public.whatsapp_cloud_api_thread_reads r
      on r.contact_id = vc.id
     and r.reader_user_id = v.uid
  ),
  unread_metrics as (
    select
      vc.id as contact_id,
      coalesce(u.unread_count, 0)::integer as unread_count,
      u.unread_last_message_at,
      u.last_read_message_id
    from visible_contacts vc
    join read_state rs on rs.contact_id = vc.id
    left join lateral (
      select
        count(*)::integer as unread_count,
        max(e.received_at) as unread_last_message_at,
        (array_agg(coalesce(e.meta_message_id, '') order by e.received_at desc))[1] as last_read_message_id
      from public.whatsapp_cloud_api_webhook_events e
      where e.config_id = vc.config_id
        and e.event_type = 'message'
        and coalesce(
          e.payload #>> '{message,from}',
          e.payload #>> '{entry,0,changes,0,value,messages,0,from}',
          ''
        ) = vc.wa_id
        and e.received_at > rs.last_read_at
    ) u on true
  ),
  tagged_contacts as (
    select
      vc.*,
      coalesce(um.unread_count, 0) as unread_count,
      um.unread_last_message_at,
      coalesce(um.last_read_message_id, '') as last_read_message_id,
      case
        when coalesce(cm.total_loaded, 0) >= coalesce(t.premium_threshold, 50000) then 'premium'
        when coalesce(cm.repeat_purchase_count, 0) > 0 or coalesce(cm.purchase_count, 0) > 1 then 'recompra'
        when coalesce(cm.purchase_count, 0) > 0 then 'cargo'
        when coalesce(cm.lead_count, 0) > 0 then 'lead'
        when coalesce(rm.click_count, 0) > 0 then 'contacto'
        else 'nuevo'
      end as tag
    from visible_contacts vc
    left join redirect_metrics rm on rm.contact_id = vc.id
    left join conversion_metrics cm on cm.contact_id = vc.id
    left join thresholds t on t.contact_id = vc.id
    left join unread_metrics um on um.contact_id = vc.id
  ),
  target_contacts as (
    select tc.*
    from tagged_contacts tc
    cross join requested_filter rf
    where tc.unread_count > 0
      and (rf.tag_filter = 'all' or tc.tag = rf.tag_filter)
  ),
  upserted as (
    insert into public.whatsapp_cloud_api_thread_reads (
      reader_user_id,
      contact_id,
      config_id,
      last_read_at,
      last_read_message_id
    )
    select
      v.uid,
      tc.id,
      tc.config_id,
      coalesce(tc.unread_last_message_at, now()),
      tc.last_read_message_id
    from target_contacts tc
    cross join viewer v
    where v.uid is not null
    on conflict (reader_user_id, contact_id) do update set
      config_id = excluded.config_id,
      last_read_at = excluded.last_read_at,
      last_read_message_id = excluded.last_read_message_id,
      updated_at = now()
    returning contact_id
  )
  select count(*)::integer from upserted;
$$;

comment on function public.mark_whatsapp_cloud_api_threads_read(text, text) is
  'Marca como leidos todos los threads WCA visibles para el usuario en el workspace y chip solicitados.';

revoke all on function public.mark_whatsapp_cloud_api_threads_read(text, text)
  from public, anon;
grant execute on function public.mark_whatsapp_cloud_api_threads_read(text, text)
  to authenticated;
