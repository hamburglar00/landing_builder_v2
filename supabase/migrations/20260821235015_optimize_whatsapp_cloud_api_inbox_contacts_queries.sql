create index if not exists whatsapp_cloud_api_contacts_scope_activity_idx
  on public.whatsapp_cloud_api_contacts (user_id, config_id, last_message_at desc, created_at desc);

create index if not exists whatsapp_cloud_api_configs_workspace_idx
  on public.whatsapp_cloud_api_configs (workspace_currency, id, user_id);

create index if not exists whatsapp_cloud_api_assignments_contact_latest_cover_idx
  on public.whatsapp_cloud_api_assignments (contact_id, created_at desc)
  include (
    id,
    config_id,
    webhook_event_id,
    assigned_phone,
    assigned_gerencia_id,
    assigned_gerencia_label,
    promo_code,
    conversion_id,
    status
  );

create index if not exists whatsapp_cloud_api_redirects_contact_metrics_idx
  on public.whatsapp_cloud_api_redirects (contact_id)
  include (click_count, last_clicked_at);

create index if not exists whatsapp_cloud_api_attr_contact_latest_cover_idx
  on public.whatsapp_cloud_api_attribution_sessions (contact_id, started_at desc)
  include (ctwa_clid, source_url, source_type, headline);

create index if not exists whatsapp_cloud_api_outbound_contact_created_idx
  on public.whatsapp_cloud_api_outbound_messages (config_id, recipient_wa_id, created_at desc);

create index if not exists whatsapp_cloud_api_webhook_message_sender_created_idx
  on public.whatsapp_cloud_api_webhook_events (
    config_id,
    event_type,
    (
      coalesce(
        payload #>> '{message,from}',
        payload #>> '{entry,0,changes,0,value,messages,0,from}',
        ''
      )
    ),
    received_at desc
  );

create index if not exists conversions_wca_external_match_idx
  on public.conversions (user_id, currency, external_id)
  where external_id <> ''
    and coalesce(test_event_code, '') = '';

create index if not exists conversions_wca_promo_match_idx
  on public.conversions (user_id, currency, promo_code)
  where promo_code <> ''
    and coalesce(test_event_code, '') = '';

create or replace function public.get_whatsapp_cloud_api_inbox_threads_page(
  p_limit integer default 20,
  p_offset integer default 0,
  p_workspace_currency text default null
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
  messages jsonb
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
  limited_contacts as (
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
    order by coalesce(wc.last_message_at, wc.created_at) desc
    limit greatest(1, least(coalesce(p_limit, 20), 20))
    offset greatest(0, coalesce(p_offset, 0))
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
    join limited_contacts lc on lc.id = a.contact_id
    left join public.gerencias g
      on g.id = a.assigned_gerencia_id
     and g.workspace_currency = lc.workspace_currency
    order by a.contact_id, a.created_at desc
  ),
  redirect_metrics as (
    select
      r.contact_id,
      coalesce(sum(r.click_count), 0)::integer as click_count,
      max(r.last_clicked_at) as last_clicked_at
    from public.whatsapp_cloud_api_redirects r
    join limited_contacts lc on lc.id = r.contact_id
    group by r.contact_id
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
  conversion_matches as (
    select
      lc.id as contact_id,
      c.id,
      c.lead_event_id,
      c.purchase_event_id,
      c.estado,
      c.purchase_type,
      c.valor,
      c.purchase_event_time,
      c.created_at
    from limited_contacts lc
    join public.conversions c
      on c.user_id = lc.user_id
     and coalesce(c.currency, 'ARS') = lc.workspace_currency
     and lc.external_id <> ''
     and c.external_id = lc.external_id
     and coalesce(c.test_event_code, '') = ''

    union

    select
      lc.id as contact_id,
      c.id,
      c.lead_event_id,
      c.purchase_event_id,
      c.estado,
      c.purchase_type,
      c.valor,
      c.purchase_event_time,
      c.created_at
    from limited_contacts lc
    join latest_assignment la on la.contact_id = lc.id
    join public.conversions c
      on c.user_id = lc.user_id
     and coalesce(c.currency, 'ARS') = lc.workspace_currency
     and la.promo_code <> ''
     and c.promo_code = la.promo_code
     and coalesce(c.test_event_code, '') = ''

    union

    select
      lc.id as contact_id,
      c.id,
      c.lead_event_id,
      c.purchase_event_id,
      c.estado,
      c.purchase_type,
      c.valor,
      c.purchase_event_time,
      c.created_at
    from limited_contacts lc
    join latest_assignment la on la.contact_id = lc.id
    join public.conversions c
      on c.id = la.conversion_id
     and c.user_id = lc.user_id
     and coalesce(c.currency, 'ARS') = lc.workspace_currency
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
      lc.id as contact_id,
      coalesce(
        case
          when (cc.funnel_premium_thresholds ->> lc.workspace_currency) ~ '^[0-9]+([.][0-9]+)?$'
            then (cc.funnel_premium_thresholds ->> lc.workspace_currency)::numeric
          else null
        end,
        cc.funnel_premium_threshold,
        50000
      ) as premium_threshold
    from limited_contacts lc
    left join public.conversions_config cc on cc.user_id = lc.user_id
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
  read_state as (
    select
      lc.id as contact_id,
      coalesce(r.last_read_at, 'epoch'::timestamptz) as last_read_at
    from limited_contacts lc
    cross join viewer v
    left join public.whatsapp_cloud_api_thread_reads r
      on r.contact_id = lc.id
     and r.reader_user_id = v.uid
  ),
  unread_metrics as (
    select
      lc.id as contact_id,
      coalesce(u.unread_count, 0)::integer as unread_count,
      u.unread_last_message_at
    from limited_contacts lc
    join read_state rs on rs.contact_id = lc.id
    left join lateral (
      select
        count(*)::integer as unread_count,
        max(e.received_at) as unread_last_message_at
      from public.whatsapp_cloud_api_webhook_events e
      where e.config_id = lc.config_id
        and e.event_type = 'message'
        and coalesce(
          e.payload #>> '{message,from}',
          e.payload #>> '{entry,0,changes,0,value,messages,0,from}',
          ''
        ) = lc.wa_id
        and e.received_at > rs.last_read_at
    ) u on true
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
    coalesce(la.assigned_phone, '') as assigned_phone,
    la.assigned_gerencia_id,
    coalesce(la.assigned_gerencia_label, '') as assigned_gerencia_label,
    coalesce(la.promo_code, '') as promo_code,
    coalesce(ls.ctwa_clid, '') as ctwa_clid,
    coalesce(ls.source_url, '') as source_url,
    coalesce(ls.source_type, '') as source_type,
    coalesce(ls.headline, '') as headline,
    la.conversion_id,
    coalesce(cm.lead_count, 0) as lead_count,
    coalesce(cm.purchase_count, 0) as purchase_count,
    coalesce(cm.repeat_purchase_count, 0) as repeat_purchase_count,
    coalesce(cm.total_loaded, 0) as total_loaded,
    cm.last_purchase_at,
    case
      when coalesce(cm.total_loaded, 0) >= coalesce(t.premium_threshold, 50000) then 'premium'
      when coalesce(cm.repeat_purchase_count, 0) > 0 or coalesce(cm.purchase_count, 0) > 1 then 'recompra'
      when coalesce(cm.purchase_count, 0) > 0 then 'cargo'
      when coalesce(cm.lead_count, 0) > 0 then 'lead'
      when coalesce(rm.click_count, 0) > 0 then 'contacto'
      else 'nuevo'
    end as tag,
    coalesce(rm.click_count, 0) > 0 as redirect_clicked,
    coalesce(rm.click_count, 0) as redirect_click_count,
    rm.last_clicked_at as redirect_last_clicked_at,
    coalesce(um.unread_count, 0) as unread_count,
    um.unread_last_message_at,
    coalesce(mj.messages, '[]'::jsonb) as messages
  from limited_contacts lc
  left join latest_assignment la on la.contact_id = lc.id
  left join redirect_metrics rm on rm.contact_id = lc.id
  left join latest_session ls on ls.contact_id = lc.id
  left join conversion_metrics cm on cm.contact_id = lc.id
  left join thresholds t on t.contact_id = lc.id
  left join unread_metrics um on um.contact_id = lc.id
  left join last_message lm on lm.contact_id = lc.id
  left join message_json mj on mj.contact_id = lc.id
  order by coalesce(lm.created_at, lc.last_message_at, lc.first_message_at) desc;
$$;

comment on function public.get_whatsapp_cloud_api_inbox_threads_page(integer, integer, text) is
  'Devuelve una pagina de threads del Inbox de WhatsApp Cloud API. Optimizada para leer mensajes y conversiones solo de la pagina solicitada.';

revoke all on function public.get_whatsapp_cloud_api_inbox_threads_page(integer, integer, text) from public, anon;
grant execute on function public.get_whatsapp_cloud_api_inbox_threads_page(integer, integer, text) to authenticated;

create or replace function public.get_whatsapp_cloud_api_contacts_page(
  p_limit integer default 20,
  p_offset integer default 0,
  p_workspace_currency text default null
)
returns table (
  contact_id uuid,
  config_id uuid,
  config_name text,
  wa_id text,
  phone text,
  profile_name text,
  last_message_at timestamptz,
  tag text,
  total_contacts bigint
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
  visible_contacts as (
    select
      wc.id,
      wc.config_id,
      wc.user_id,
      wc.wa_id,
      wc.phone,
      coalesce(wc.profile_name, '') as profile_name,
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
  paged_contacts as (
    select *
    from visible_contacts
    order by coalesce(last_message_at, created_at) desc
    limit greatest(1, least(coalesce(p_limit, 20), 20))
    offset greatest(0, coalesce(p_offset, 0))
  ),
  latest_assignment as (
    select distinct on (a.contact_id)
      a.contact_id,
      coalesce(a.promo_code, '') as promo_code,
      a.conversion_id
    from public.whatsapp_cloud_api_assignments a
    join paged_contacts pc on pc.id = a.contact_id
    order by a.contact_id, a.created_at desc
  ),
  redirect_metrics as (
    select
      r.contact_id,
      coalesce(sum(r.click_count), 0)::integer as click_count
    from public.whatsapp_cloud_api_redirects r
    join paged_contacts pc on pc.id = r.contact_id
    group by r.contact_id
  ),
  conversion_matches as (
    select
      pc.id as contact_id,
      c.id,
      c.lead_event_id,
      c.purchase_event_id,
      c.estado,
      c.purchase_type,
      c.valor
    from paged_contacts pc
    join public.conversions c
      on c.user_id = pc.user_id
     and coalesce(c.currency, 'ARS') = pc.workspace_currency
     and pc.external_id <> ''
     and c.external_id = pc.external_id
     and coalesce(c.test_event_code, '') = ''

    union

    select
      pc.id as contact_id,
      c.id,
      c.lead_event_id,
      c.purchase_event_id,
      c.estado,
      c.purchase_type,
      c.valor
    from paged_contacts pc
    join latest_assignment la on la.contact_id = pc.id
    join public.conversions c
      on c.user_id = pc.user_id
     and coalesce(c.currency, 'ARS') = pc.workspace_currency
     and la.promo_code <> ''
     and c.promo_code = la.promo_code
     and coalesce(c.test_event_code, '') = ''

    union

    select
      pc.id as contact_id,
      c.id,
      c.lead_event_id,
      c.purchase_event_id,
      c.estado,
      c.purchase_type,
      c.valor
    from paged_contacts pc
    join latest_assignment la on la.contact_id = pc.id
    join public.conversions c
      on c.id = la.conversion_id
     and c.user_id = pc.user_id
     and coalesce(c.currency, 'ARS') = pc.workspace_currency
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
      pc.id as contact_id,
      coalesce(
        case
          when (cc.funnel_premium_thresholds ->> pc.workspace_currency) ~ '^[0-9]+([.][0-9]+)?$'
            then (cc.funnel_premium_thresholds ->> pc.workspace_currency)::numeric
          else null
        end,
        cc.funnel_premium_threshold,
        50000
      ) as premium_threshold
    from paged_contacts pc
    left join public.conversions_config cc on cc.user_id = pc.user_id
  ),
  totals as (
    select count(*)::bigint as total_contacts from visible_contacts
  )
  select
    pc.id as contact_id,
    pc.config_id,
    pc.config_name,
    pc.wa_id,
    pc.phone,
    pc.profile_name,
    pc.last_message_at,
    case
      when coalesce(cm.total_loaded, 0) >= coalesce(t.premium_threshold, 50000) then 'premium'
      when coalesce(cm.repeat_purchase_count, 0) > 0 or coalesce(cm.purchase_count, 0) > 1 then 'recompra'
      when coalesce(cm.purchase_count, 0) > 0 then 'cargo'
      when coalesce(cm.lead_count, 0) > 0 then 'lead'
      when coalesce(rm.click_count, 0) > 0 then 'contacto'
      else 'nuevo'
    end as tag,
    totals.total_contacts
  from paged_contacts pc
  cross join totals
  left join latest_assignment la on la.contact_id = pc.id
  left join redirect_metrics rm on rm.contact_id = pc.id
  left join conversion_metrics cm on cm.contact_id = pc.id
  left join thresholds t on t.contact_id = pc.id
  order by coalesce(pc.last_message_at, pc.created_at) desc;
$$;

comment on function public.get_whatsapp_cloud_api_contacts_page(integer, integer, text) is
  'Devuelve contactos de WhatsApp Cloud API paginados con estado comercial derivado. Optimizada para conversiones indexables.';

revoke all on function public.get_whatsapp_cloud_api_contacts_page(integer, integer, text) from public, anon;
grant execute on function public.get_whatsapp_cloud_api_contacts_page(integer, integer, text) to authenticated;
