-- WhatsApp Cloud API conversational landing module.
-- This stores the raw Meta webhook payloads separately from conversion_inbox so
-- we keep full JSONB auditability and idempotency around Meta message ids.

create table if not exists public.whatsapp_cloud_api_configs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  active boolean not null default false,
  workspace_currency text not null default 'ARS'
    check (workspace_currency in ('ARS', 'PYG')),
  phone_number_id text not null default '',
  whatsapp_business_account_id text not null default '',
  display_phone_number text not null default '',
  meta_access_token text not null default '',
  meta_api_version text not null default 'v25.0',
  webhook_verify_token text not null default '',
  pixel_id text not null default '',
  landing_tag text not null default '',
  gerencia_selection_mode text not null default 'weighted_random'
    check (gerencia_selection_mode in ('weighted_random', 'fair')),
  gerencia_fair_criterion text not null default 'usage_count'
    check (gerencia_fair_criterion in ('usage_count', 'messages_received')),
  send_contact_capi boolean not null default false,
  redirect_message_template text not null default
    'Hola, gracias por comunicarte con {{name}}.\n\nPara continuar escribile a tu asesor: {{wa_link}}\n\nTu codigo es: {{promo_code}}',
  fallback_message_template text not null default
    'Hola, gracias por comunicarte. En este momento no hay un asesor disponible. Por favor intenta nuevamente en unos minutos.',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatsapp_cloud_api_configs_user_name_unique unique (user_id, name),
  constraint whatsapp_cloud_api_configs_name_format check (name ~ '^[a-z0-9-]+$'),
  constraint whatsapp_cloud_api_configs_landing_tag_format check (
    landing_tag = '' or landing_tag ~ '^[A-Za-z0-9]+$'
  )
);

create unique index if not exists whatsapp_cloud_api_configs_phone_number_uidx
  on public.whatsapp_cloud_api_configs (phone_number_id)
  where phone_number_id <> '';

comment on table public.whatsapp_cloud_api_configs is
  'Configuracion de landing conversacional con WhatsApp Cloud API oficial.';
comment on column public.whatsapp_cloud_api_configs.send_contact_capi is
  'Default false: el primer mensaje crea Contact interno, pero no envia Contact CAPI a Meta salvo opt-in.';

create table if not exists public.whatsapp_cloud_api_gerencias (
  config_id uuid not null references public.whatsapp_cloud_api_configs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  gerencia_id integer not null references public.gerencias (id) on delete cascade,
  weight integer not null default 1,
  phone_mode text not null default 'random'
    check (phone_mode in ('random', 'fair')),
  phone_kind text not null default 'carga'
    check (phone_kind in ('carga', 'ads', 'mkt', 'assistant')),
  interval_start_hour integer null check (interval_start_hour between 0 and 23),
  interval_end_hour integer null check (interval_end_hour between 0 and 23),
  created_at timestamptz not null default now(),
  primary key (config_id, gerencia_id)
);

create index if not exists whatsapp_cloud_api_gerencias_user_idx
  on public.whatsapp_cloud_api_gerencias (user_id);
create index if not exists whatsapp_cloud_api_gerencias_gerencia_idx
  on public.whatsapp_cloud_api_gerencias (gerencia_id);

create table if not exists public.whatsapp_cloud_api_webhook_events (
  id uuid primary key default gen_random_uuid(),
  config_id uuid null references public.whatsapp_cloud_api_configs (id) on delete set null,
  user_id uuid null references auth.users (id) on delete set null,
  correlation_id uuid not null default gen_random_uuid(),
  object text not null default '',
  phone_number_id text not null default '',
  meta_message_id text not null default '',
  meta_status_id text not null default '',
  event_type text not null default 'unknown'
    check (event_type in ('message', 'status', 'error', 'unknown')),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'processed', 'deduplicated', 'failed')),
  attempts integer not null default 0,
  received_at timestamptz not null default now(),
  processing_started_at timestamptz null,
  processed_at timestamptz null,
  last_error text not null default ''
);

create unique index if not exists whatsapp_cloud_api_webhook_message_uidx
  on public.whatsapp_cloud_api_webhook_events (meta_message_id)
  where meta_message_id <> '';
create index if not exists whatsapp_cloud_api_webhook_status_created_idx
  on public.whatsapp_cloud_api_webhook_events (status, received_at);
create index if not exists whatsapp_cloud_api_webhook_config_created_idx
  on public.whatsapp_cloud_api_webhook_events (config_id, received_at desc);

create table if not exists public.whatsapp_cloud_api_contacts (
  id uuid primary key default gen_random_uuid(),
  config_id uuid not null references public.whatsapp_cloud_api_configs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  wa_id text not null,
  phone text not null default '',
  profile_name text not null default '',
  first_message_id text not null default '',
  first_message_at timestamptz null,
  last_message_at timestamptz null,
  external_id text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatsapp_cloud_api_contacts_config_wa_unique unique (config_id, wa_id)
);

create index if not exists whatsapp_cloud_api_contacts_user_created_idx
  on public.whatsapp_cloud_api_contacts (user_id, created_at desc);

create table if not exists public.whatsapp_cloud_api_attribution_sessions (
  id uuid primary key default gen_random_uuid(),
  config_id uuid not null references public.whatsapp_cloud_api_configs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  contact_id uuid not null references public.whatsapp_cloud_api_contacts (id) on delete cascade,
  ctwa_clid text not null default '',
  source_id text not null default '',
  source_url text not null default '',
  source_type text not null default '',
  headline text not null default '',
  referral jsonb not null default '{}'::jsonb,
  first_message_id text not null default '',
  started_at timestamptz not null default now(),
  last_message_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint whatsapp_cloud_api_attr_first_message_unique unique (first_message_id)
);

create index if not exists whatsapp_cloud_api_attr_contact_started_idx
  on public.whatsapp_cloud_api_attribution_sessions (contact_id, started_at desc);
create index if not exists whatsapp_cloud_api_attr_ctwa_idx
  on public.whatsapp_cloud_api_attribution_sessions (ctwa_clid)
  where ctwa_clid <> '';

create table if not exists public.whatsapp_cloud_api_assignments (
  id uuid primary key default gen_random_uuid(),
  config_id uuid not null references public.whatsapp_cloud_api_configs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  contact_id uuid not null references public.whatsapp_cloud_api_contacts (id) on delete cascade,
  attribution_session_id uuid null references public.whatsapp_cloud_api_attribution_sessions (id) on delete set null,
  webhook_event_id uuid null references public.whatsapp_cloud_api_webhook_events (id) on delete set null,
  first_message_id text not null default '',
  assigned_phone text not null default '',
  assigned_phone_id bigint null references public.gerencia_phones (id) on delete set null,
  assigned_gerencia_id integer null references public.gerencias (id) on delete set null,
  assigned_gerencia_external_id integer null,
  assigned_gerencia_label text not null default '',
  promo_code text not null default '',
  conversion_id uuid null references public.conversions (id) on delete set null,
  redirect_message_id text not null default '',
  redirect_sent_at timestamptz null,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed', 'skipped')),
  last_error text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatsapp_cloud_api_assignments_first_message_unique unique (first_message_id)
);

create index if not exists whatsapp_cloud_api_assignments_config_created_idx
  on public.whatsapp_cloud_api_assignments (config_id, created_at desc);
create index if not exists whatsapp_cloud_api_assignments_contact_created_idx
  on public.whatsapp_cloud_api_assignments (contact_id, created_at desc);
create unique index if not exists whatsapp_cloud_api_assignments_promo_uidx
  on public.whatsapp_cloud_api_assignments (promo_code)
  where promo_code <> '';

create table if not exists public.whatsapp_cloud_api_outbound_messages (
  id uuid primary key default gen_random_uuid(),
  config_id uuid not null references public.whatsapp_cloud_api_configs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  assignment_id uuid null references public.whatsapp_cloud_api_assignments (id) on delete set null,
  meta_message_id text not null default '',
  recipient_wa_id text not null default '',
  message_type text not null default 'text',
  payload jsonb not null default '{}'::jsonb,
  response jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'sent', 'delivered', 'read', 'failed')),
  last_error text not null default '',
  created_at timestamptz not null default now(),
  sent_at timestamptz null,
  updated_at timestamptz not null default now()
);

create unique index if not exists whatsapp_cloud_api_outbound_meta_message_uidx
  on public.whatsapp_cloud_api_outbound_messages (meta_message_id)
  where meta_message_id <> '';
create index if not exists whatsapp_cloud_api_outbound_config_created_idx
  on public.whatsapp_cloud_api_outbound_messages (config_id, created_at desc);

create or replace function public.set_whatsapp_cloud_api_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists whatsapp_cloud_api_configs_updated_at on public.whatsapp_cloud_api_configs;
create trigger whatsapp_cloud_api_configs_updated_at
before update on public.whatsapp_cloud_api_configs
for each row execute function public.set_whatsapp_cloud_api_updated_at();

drop trigger if exists whatsapp_cloud_api_contacts_updated_at on public.whatsapp_cloud_api_contacts;
create trigger whatsapp_cloud_api_contacts_updated_at
before update on public.whatsapp_cloud_api_contacts
for each row execute function public.set_whatsapp_cloud_api_updated_at();

drop trigger if exists whatsapp_cloud_api_assignments_updated_at on public.whatsapp_cloud_api_assignments;
create trigger whatsapp_cloud_api_assignments_updated_at
before update on public.whatsapp_cloud_api_assignments
for each row execute function public.set_whatsapp_cloud_api_updated_at();

drop trigger if exists whatsapp_cloud_api_outbound_updated_at on public.whatsapp_cloud_api_outbound_messages;
create trigger whatsapp_cloud_api_outbound_updated_at
before update on public.whatsapp_cloud_api_outbound_messages
for each row execute function public.set_whatsapp_cloud_api_updated_at();

alter table public.whatsapp_cloud_api_configs enable row level security;
alter table public.whatsapp_cloud_api_gerencias enable row level security;
alter table public.whatsapp_cloud_api_webhook_events enable row level security;
alter table public.whatsapp_cloud_api_contacts enable row level security;
alter table public.whatsapp_cloud_api_attribution_sessions enable row level security;
alter table public.whatsapp_cloud_api_assignments enable row level security;
alter table public.whatsapp_cloud_api_outbound_messages enable row level security;

create policy "whatsapp_cloud_api_configs_owner"
on public.whatsapp_cloud_api_configs for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "whatsapp_cloud_api_configs_admin"
on public.whatsapp_cloud_api_configs for all
to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

create policy "whatsapp_cloud_api_gerencias_owner"
on public.whatsapp_cloud_api_gerencias for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "whatsapp_cloud_api_gerencias_admin"
on public.whatsapp_cloud_api_gerencias for all
to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

create policy "whatsapp_cloud_api_events_owner_read"
on public.whatsapp_cloud_api_webhook_events for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "whatsapp_cloud_api_events_admin_read"
on public.whatsapp_cloud_api_webhook_events for select
to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

create policy "whatsapp_cloud_api_contacts_owner_read"
on public.whatsapp_cloud_api_contacts for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "whatsapp_cloud_api_contacts_admin_read"
on public.whatsapp_cloud_api_contacts for select
to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

create policy "whatsapp_cloud_api_attr_owner_read"
on public.whatsapp_cloud_api_attribution_sessions for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "whatsapp_cloud_api_attr_admin_read"
on public.whatsapp_cloud_api_attribution_sessions for select
to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

create policy "whatsapp_cloud_api_assignments_owner_read"
on public.whatsapp_cloud_api_assignments for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "whatsapp_cloud_api_assignments_admin_read"
on public.whatsapp_cloud_api_assignments for select
to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

create policy "whatsapp_cloud_api_outbound_owner_read"
on public.whatsapp_cloud_api_outbound_messages for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "whatsapp_cloud_api_outbound_admin_read"
on public.whatsapp_cloud_api_outbound_messages for select
to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

revoke all on table public.whatsapp_cloud_api_webhook_events from anon, authenticated;
revoke all on table public.whatsapp_cloud_api_contacts from anon, authenticated;
revoke all on table public.whatsapp_cloud_api_attribution_sessions from anon, authenticated;
revoke all on table public.whatsapp_cloud_api_assignments from anon, authenticated;
revoke all on table public.whatsapp_cloud_api_outbound_messages from anon, authenticated;
grant select on table public.whatsapp_cloud_api_webhook_events to authenticated;
grant select on table public.whatsapp_cloud_api_contacts to authenticated;
grant select on table public.whatsapp_cloud_api_attribution_sessions to authenticated;
grant select on table public.whatsapp_cloud_api_assignments to authenticated;
grant select on table public.whatsapp_cloud_api_outbound_messages to authenticated;
grant select, insert, update, delete on table public.whatsapp_cloud_api_configs to authenticated;
grant select, insert, update, delete on table public.whatsapp_cloud_api_gerencias to authenticated;
grant all on table public.whatsapp_cloud_api_configs to service_role;
grant all on table public.whatsapp_cloud_api_gerencias to service_role;
grant all on table public.whatsapp_cloud_api_webhook_events to service_role;
grant all on table public.whatsapp_cloud_api_contacts to service_role;
grant all on table public.whatsapp_cloud_api_attribution_sessions to service_role;
grant all on table public.whatsapp_cloud_api_assignments to service_role;
grant all on table public.whatsapp_cloud_api_outbound_messages to service_role;

create or replace function public.get_phone_for_whatsapp_cloud_api(p_config_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_config                    public.whatsapp_cloud_api_configs%rowtype;
  v_current_hour              int;
  v_gerencia_id               int;
  v_weight                    int;
  v_phone_mode                text;
  v_phone_kind                text;
  v_external_id               int;
  v_owner_user_id             uuid;
  v_fair_criterion            text;
  v_phone_id                  bigint;
  v_phone                     text;
  v_total_weight              float;
  v_r                         float;
begin
  select *
  into v_config
  from public.whatsapp_cloud_api_configs c
  where c.id = p_config_id
    and c.active = true
  limit 1;

  if v_config.id is null then
    return jsonb_build_object('_status', 'not_found');
  end if;

  v_current_hour := extract(hour from now())::int;

  drop table if exists _get_phone_pool;
  create temp table _get_phone_pool (
    gerencia_id      int,
    weight           int,
    phone_mode       text,
    phone_kind       text,
    external_id      int,
    owner_user_id    uuid,
    fair_criterion   text
  );

  insert into _get_phone_pool (
    gerencia_id,
    weight,
    phone_mode,
    phone_kind,
    external_id,
    owner_user_id,
    fair_criterion
  )
  select
    wg.gerencia_id,
    greatest(0, wg.weight),
    wg.phone_mode,
    wg.phone_kind,
    g.gerencia_id,
    g.user_id,
    coalesce(g.fair_criterion, 'usage_count')
  from public.whatsapp_cloud_api_gerencias wg
  join public.gerencias g on g.id = wg.gerencia_id
  where wg.config_id = v_config.id
    and wg.user_id = v_config.user_id
    and (
      (wg.interval_start_hour is null or wg.interval_end_hour is null)
      or (wg.interval_start_hour = wg.interval_end_hour)
      or (wg.interval_start_hour < wg.interval_end_hour
          and v_current_hour >= wg.interval_start_hour
          and v_current_hour < wg.interval_end_hour)
      or (wg.interval_start_hour > wg.interval_end_hour
          and (v_current_hour >= wg.interval_start_hour or v_current_hour < wg.interval_end_hour))
    );

  if (select count(*) from _get_phone_pool) = 0 then
    drop table if exists _get_phone_pool;
    return jsonb_build_object('_status', 'no_assignments');
  end if;

  loop
    if v_config.gerencia_selection_mode = 'fair' then
      if v_config.gerencia_fair_criterion = 'messages_received' then
        select
          p.gerencia_id, p.weight, p.phone_mode, p.phone_kind,
          p.external_id, p.owner_user_id, p.fair_criterion
        into
          v_gerencia_id, v_weight, v_phone_mode, v_phone_kind,
          v_external_id, v_owner_user_id, v_fair_criterion
        from _get_phone_pool p
        left join lateral (
          select count(*)::bigint as metric
          from public.conversions c
          where c.user_id = p.owner_user_id
            and c.lead_event_id <> ''
            and exists (
              select 1
              from public.gerencia_phones gp
              where gp.gerencia_id = p.gerencia_id
                and gp.kind = p.phone_kind
                and gp.phone = c.telefono_asignado
                and (
                  gp.messages_reset_at is null
                  or coalesce(to_timestamp(nullif(c.lead_event_time, 0)), c.created_at) >= gp.messages_reset_at
                )
            )
        ) m on true
        order by coalesce(m.metric, 0) asc, random()
        limit 1;
      else
        select
          p.gerencia_id, p.weight, p.phone_mode, p.phone_kind,
          p.external_id, p.owner_user_id, p.fair_criterion
        into
          v_gerencia_id, v_weight, v_phone_mode, v_phone_kind,
          v_external_id, v_owner_user_id, v_fair_criterion
        from _get_phone_pool p
        left join lateral (
          select coalesce(sum(gp.usage_count), 0)::bigint as metric
          from public.gerencia_phones gp
          where gp.gerencia_id = p.gerencia_id
            and gp.kind = p.phone_kind
        ) m on true
        order by coalesce(m.metric, 0) asc, random()
        limit 1;
      end if;
    else
      v_total_weight := (select sum(weight)::float from _get_phone_pool);
      if v_total_weight is null or v_total_weight <= 0 then
        drop table if exists _get_phone_pool;
        return jsonb_build_object('_status', 'no_phones');
      end if;

      v_r := random() * v_total_weight;
      select
        p.gerencia_id, p.weight, p.phone_mode, p.phone_kind,
        p.external_id, p.owner_user_id, p.fair_criterion
      into
        v_gerencia_id, v_weight, v_phone_mode, v_phone_kind,
        v_external_id, v_owner_user_id, v_fair_criterion
      from (
        select
          gerencia_id, weight, phone_mode, phone_kind, external_id,
          owner_user_id, fair_criterion,
          sum(weight) over (order by gerencia_id)::float - weight::float as cum_start,
          sum(weight) over (order by gerencia_id)::float as cum_end
        from _get_phone_pool
      ) p
      where v_r >= p.cum_start and v_r < p.cum_end
      limit 1;
    end if;

    if v_gerencia_id is null then
      drop table if exists _get_phone_pool;
      return jsonb_build_object('_status', 'no_phones');
    end if;

    if v_phone_mode = 'fair' then
      if v_fair_criterion = 'messages_received' then
        select gp.id, gp.phone
        into v_phone_id, v_phone
        from public.gerencia_phones gp
        left join lateral (
          select count(*)::bigint as lead_count
          from public.conversions c
          where c.user_id = v_owner_user_id
            and c.telefono_asignado = gp.phone
            and c.lead_event_id <> ''
            and (
              gp.messages_reset_at is null
              or coalesce(to_timestamp(nullif(c.lead_event_time, 0)), c.created_at) >= gp.messages_reset_at
            )
        ) lc on true
        where gp.gerencia_id = v_gerencia_id
          and gp.status = 'active'
          and gp.kind = v_phone_kind
        order by coalesce(lc.lead_count, 0) asc, random()
        limit 1;
      else
        select gp.id, gp.phone
        into v_phone_id, v_phone
        from public.gerencia_phones gp
        where gp.gerencia_id = v_gerencia_id
          and gp.status = 'active'
          and gp.kind = v_phone_kind
        order by gp.usage_count asc, random()
        limit 1;
      end if;
    else
      select gp.id, gp.phone
      into v_phone_id, v_phone
      from public.gerencia_phones gp
      where gp.gerencia_id = v_gerencia_id
        and gp.status = 'active'
        and gp.kind = v_phone_kind
      order by random()
      limit 1;
    end if;

    if v_phone_id is not null then
      drop table if exists _get_phone_pool;
      return jsonb_build_object(
        'phoneId', v_phone_id,
        'phone', v_phone,
        'landingId', v_config.id,
        'landingName', v_config.name,
        'integrationSource', 'whatsapp_cloud_api',
        'gerenciaSelectionMode', v_config.gerencia_selection_mode,
        'gerenciaFairCriterion', v_config.gerencia_fair_criterion,
        'phoneMode', v_phone_mode,
        'phoneKind', v_phone_kind,
        'fairCriterion', v_fair_criterion,
        'gerencia', jsonb_build_object(
          'id', v_gerencia_id,
          'externalId', v_external_id,
          'weight', v_weight
        )
      );
    end if;

    delete from _get_phone_pool where _get_phone_pool.gerencia_id = v_gerencia_id;
  end loop;
end;
$$;

comment on function public.get_phone_for_whatsapp_cloud_api(uuid) is
  'Selecciona telefono para landing conversacional WhatsApp Cloud API, usando gerencias y criterios configurados.';

revoke all on function public.get_phone_for_whatsapp_cloud_api(uuid) from public, anon, authenticated;
grant execute on function public.get_phone_for_whatsapp_cloud_api(uuid) to service_role;
