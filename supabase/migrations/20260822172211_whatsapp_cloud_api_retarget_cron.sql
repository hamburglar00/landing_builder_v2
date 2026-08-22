create table if not exists public.whatsapp_cloud_api_retarget_messages (
  id uuid primary key default gen_random_uuid(),
  config_id uuid not null references public.whatsapp_cloud_api_configs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  contact_id uuid not null references public.whatsapp_cloud_api_contacts(id) on delete cascade,
  assignment_id uuid null references public.whatsapp_cloud_api_assignments(id) on delete set null,
  redirect_id uuid null references public.whatsapp_cloud_api_redirects(id) on delete set null,
  retarget_kind text not null check (retarget_kind in ('new', 'contact')),
  last_inbound_at timestamptz not null,
  status text not null default 'processing'
    check (status in ('processing', 'sent', 'failed', 'skipped')),
  meta_message_id text not null default '',
  outbound_message_id uuid null references public.whatsapp_cloud_api_outbound_messages(id) on delete set null,
  last_error text not null default '',
  created_at timestamptz not null default now(),
  sent_at timestamptz null,
  updated_at timestamptz not null default now(),
  unique (contact_id, retarget_kind)
);

comment on table public.whatsapp_cloud_api_retarget_messages is
  'Controla el envio unico de retargeting automatico para chats WhatsApp Cloud API en estados nuevo/contacto.';

create index if not exists whatsapp_cloud_api_retarget_config_created_idx
  on public.whatsapp_cloud_api_retarget_messages (config_id, created_at desc);

create index if not exists whatsapp_cloud_api_retarget_status_idx
  on public.whatsapp_cloud_api_retarget_messages (status, created_at desc);

drop trigger if exists whatsapp_cloud_api_retarget_updated_at
  on public.whatsapp_cloud_api_retarget_messages;
create trigger whatsapp_cloud_api_retarget_updated_at
before update on public.whatsapp_cloud_api_retarget_messages
for each row execute function public.set_whatsapp_cloud_api_updated_at();

alter table public.whatsapp_cloud_api_retarget_messages enable row level security;

drop policy if exists "whatsapp_cloud_api_retarget_owner_read"
  on public.whatsapp_cloud_api_retarget_messages;
create policy "whatsapp_cloud_api_retarget_owner_read"
on public.whatsapp_cloud_api_retarget_messages
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "whatsapp_cloud_api_retarget_admin_read"
  on public.whatsapp_cloud_api_retarget_messages;
create policy "whatsapp_cloud_api_retarget_admin_read"
on public.whatsapp_cloud_api_retarget_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
  )
);

revoke all on public.whatsapp_cloud_api_retarget_messages from anon, authenticated;
grant select on public.whatsapp_cloud_api_retarget_messages to authenticated;
grant all on public.whatsapp_cloud_api_retarget_messages to service_role;

create or replace function public.claim_whatsapp_cloud_api_retarget_candidates(
  p_limit integer default 25,
  p_max_age_minutes integer default 30,
  p_min_age_minutes integer default 5
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
      wc.last_inbound_at,
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
      and coalesce(cfg.meta_access_token, '') <> ''
      and coalesce(wc.last_inbound_at, wc.first_message_at) is not null
      and wc.last_inbound_at >= now() - make_interval(mins => greatest(1, p_max_age_minutes))
      and wc.last_inbound_at <= now() - make_interval(mins => greatest(0, p_min_age_minutes))
      and wc.last_inbound_at <= now() + interval '5 minutes'
      and coalesce(cm.lead_count, 0) = 0
      and coalesce(cm.purchase_count, 0) = 0
      and not exists (
        select 1
        from public.whatsapp_cloud_api_retarget_messages rt
        where rt.contact_id = wc.id
          and rt.retarget_kind = case
            when coalesce(rm.clicked_redirects, 0) > 0 then 'contact'
            else 'new'
          end
      )
    order by wc.last_inbound_at asc
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
    on conflict (contact_id, retarget_kind) do nothing
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
    on c.contact_id = cl.contact_id
   and c.retarget_kind = cl.retarget_kind;
$$;

comment on function public.claim_whatsapp_cloud_api_retarget_candidates(integer, integer, integer) is
  'Reclama candidatos de retarget WCA con inbound reciente, sin lead/purchase y sin retarget previo.';

revoke all on function public.claim_whatsapp_cloud_api_retarget_candidates(integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.claim_whatsapp_cloud_api_retarget_candidates(integer, integer, integer)
  to service_role;

create or replace function public.cron_whatsapp_cloud_api_retarget()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  base_url text;
  retarget_url text;
  secret text;
begin
  select value into base_url from public.cron_config where key = 'sync_phones_url';
  if base_url is null or base_url like '%REPLACE_%' then
    return;
  end if;

  select value into secret from public.cron_config where key = 'sync_phones_cron_secret';
  if secret is null then
    return;
  end if;

  retarget_url := regexp_replace(base_url, '/functions/v1/[^/]+$', '/functions/v1/whatsapp-cloud-retarget');

  perform net.http_post(
    url := retarget_url,
    body := jsonb_build_object('cron_secret', secret, 'reason', 'cron'),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 30000
  );
end;
$$;

do $$
begin
  perform cron.unschedule('whatsapp-cloud-api-retarget');
exception when others then
  null;
end $$;

select cron.schedule(
  'whatsapp-cloud-api-retarget',
  '*/15 * * * *',
  $$select public.cron_whatsapp_cloud_api_retarget()$$
);
