set statement_timeout = '10min';

create table if not exists public.phone_metrics (
  gerencia_phone_id bigint primary key references public.gerencia_phones(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  gerencia_id integer not null references public.gerencias(id) on delete cascade,
  phone text not null default '',
  messages_received integer not null default 0,
  messages_received_historical integer not null default 0,
  calculated_at timestamptz not null default now()
);

comment on table public.phone_metrics is
  'Resumen precalculado de metricas operativas por telefono de gerencia. Evita que la UI de Telefonos escanee conversions.';
comment on column public.phone_metrics.messages_received is
  'Leads unicos vinculados a Contact para este telefono, respetando messages_reset_at.';
comment on column public.phone_metrics.messages_received_historical is
  'Leads unicos vinculados a Contact para este telefono, historico completo.';
comment on column public.phone_metrics.calculated_at is
  'Momento en que se recalculo el resumen.';

create index if not exists phone_metrics_user_gerencia_idx
  on public.phone_metrics (user_id, gerencia_id);

create index if not exists phone_metrics_phone_idx
  on public.phone_metrics (phone);

create index if not exists conversions_phone_metrics_contacts_idx
  on public.conversions (user_id, external_id)
  where coalesce(contact_event_id, '') <> ''
    and coalesce(external_id, '') <> ''
    and coalesce(telefono_asignado, '') <> ''
    and coalesce(test_event_code, '') = '';

create index if not exists conversions_phone_metrics_leads_idx
  on public.conversions (user_id, telefono_asignado, external_id, lead_event_time)
  where coalesce(lead_event_id, '') <> ''
    and coalesce(external_id, '') <> ''
    and coalesce(telefono_asignado, '') <> ''
    and coalesce(test_event_code, '') = '';

create index if not exists hidden_conversions_hidden_by_conversion_idx
  on public.hidden_conversions (hidden_by, conversion_id);

create or replace function public.refresh_phone_metrics()
returns void
language sql
security definer
set search_path = public
as $$
  with phone_rows as (
    select
      gp.id as gerencia_phone_id,
      g.user_id,
      gp.gerencia_id,
      regexp_replace(coalesce(gp.phone, ''), '\D', '', 'g') as phone,
      gp.messages_reset_at
    from public.gerencia_phones gp
    join public.gerencias g on g.id = gp.gerencia_id
    where nullif(regexp_replace(coalesce(gp.phone, ''), '\D', '', 'g'), '') is not null
  ),
  contact_keys as (
    select distinct
      c.user_id,
      trim(coalesce(c.external_id, '')) as external_id
    from public.conversions c
    where coalesce(c.contact_event_id, '') <> ''
      and trim(coalesce(c.external_id, '')) <> ''
      and nullif(regexp_replace(coalesce(c.telefono_asignado, ''), '\D', '', 'g'), '') is not null
      and coalesce(c.test_event_code, '') = ''
      and not exists (
        select 1
        from public.hidden_conversions h
        where h.hidden_by = c.user_id
          and h.conversion_id = c.id
      )
  ),
  linked_leads as (
    select distinct
      pr.gerencia_phone_id,
      pr.user_id,
      pr.gerencia_id,
      pr.phone,
      pr.messages_reset_at,
      trim(coalesce(c.external_id, '')) as external_id,
      c.lead_event_time
    from phone_rows pr
    join public.conversions c
      on c.user_id = pr.user_id
     and regexp_replace(coalesce(c.telefono_asignado, ''), '\D', '', 'g') = pr.phone
    join contact_keys ck
      on ck.user_id = c.user_id
     and ck.external_id = trim(coalesce(c.external_id, ''))
    where coalesce(c.lead_event_id, '') <> ''
      and trim(coalesce(c.external_id, '')) <> ''
      and coalesce(c.test_event_code, '') = ''
      and not exists (
        select 1
        from public.hidden_conversions h
        where h.hidden_by = c.user_id
          and h.conversion_id = c.id
      )
  ),
  aggregated as (
    select
      pr.gerencia_phone_id,
      pr.user_id,
      pr.gerencia_id,
      pr.phone,
      count(distinct ll.external_id) filter (
        where pr.messages_reset_at is null
          or (
            coalesce(ll.lead_event_time, 0) > 0
            and to_timestamp(ll.lead_event_time) >= pr.messages_reset_at
          )
      )::integer as messages_received,
      count(distinct ll.external_id)::integer as messages_received_historical
    from phone_rows pr
    left join linked_leads ll on ll.gerencia_phone_id = pr.gerencia_phone_id
    group by pr.gerencia_phone_id, pr.user_id, pr.gerencia_id, pr.phone
  ),
  deleted as (
    delete from public.phone_metrics pm
    where not exists (
      select 1
      from phone_rows pr
      where pr.gerencia_phone_id = pm.gerencia_phone_id
    )
    returning 1
  )
  insert into public.phone_metrics (
    gerencia_phone_id,
    user_id,
    gerencia_id,
    phone,
    messages_received,
    messages_received_historical,
    calculated_at
  )
  select
    gerencia_phone_id,
    user_id,
    gerencia_id,
    phone,
    messages_received,
    messages_received_historical,
    now()
  from aggregated
  on conflict (gerencia_phone_id) do update set
    user_id = excluded.user_id,
    gerencia_id = excluded.gerencia_id,
    phone = excluded.phone,
    messages_received = excluded.messages_received,
    messages_received_historical = excluded.messages_received_historical,
    calculated_at = excluded.calculated_at;
$$;

comment on function public.refresh_phone_metrics() is
  'Recalcula el resumen de mensajes recibidos por telefono. Ejecutado por pg_cron cada 5 minutos.';

alter table public.phone_metrics enable row level security;

drop policy if exists "phone_metrics_select_own_or_admin" on public.phone_metrics;
create policy "phone_metrics_select_own_or_admin"
on public.phone_metrics
for select
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

revoke all on table public.phone_metrics from anon, authenticated;
grant select on table public.phone_metrics to authenticated;
grant all on table public.phone_metrics to service_role;

revoke all on function public.refresh_phone_metrics() from public, anon, authenticated;
grant execute on function public.refresh_phone_metrics() to service_role;

select public.refresh_phone_metrics();

do $$
begin
  perform cron.unschedule('refresh-phone-metrics-every-5min');
exception when others then
  null;
end $$;

select cron.schedule(
  'refresh-phone-metrics-every-5min',
  '*/5 * * * *',
  $$select public.refresh_phone_metrics()$$
);
