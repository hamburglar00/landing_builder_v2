-- Optimize the Telefonos UI metrics cache refresh without changing CTA phone
-- assignment. get_phone_for_landing/get_phone_for_chatrace_client still count
-- live rows from conversions; phone_metrics is read only by the Telefonos UI.

set statement_timeout = '10min';

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
  conversion_events as materialized (
    select
      c.id,
      c.user_id,
      trim(coalesce(c.external_id, '')) as external_id,
      regexp_replace(coalesce(c.telefono_asignado, ''), '\D', '', 'g') as phone,
      coalesce(c.contact_event_id, '') <> '' as has_contact,
      coalesce(c.lead_event_id, '') <> '' as has_lead,
      c.lead_event_time
    from public.conversions c
    where (coalesce(c.contact_event_id, '') <> '' or coalesce(c.lead_event_id, '') <> '')
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
  contact_keys as (
    select distinct
      ce.user_id,
      ce.external_id
    from conversion_events ce
    where ce.has_contact
  ),
  linked_leads as (
    select distinct
      pr.gerencia_phone_id,
      pr.user_id,
      pr.gerencia_id,
      pr.phone,
      pr.messages_reset_at,
      ce.external_id,
      ce.lead_event_time
    from phone_rows pr
    join conversion_events ce
      on ce.user_id = pr.user_id
     and ce.phone = pr.phone
     and ce.has_lead
    join contact_keys ck
      on ck.user_id = ce.user_id
     and ck.external_id = ce.external_id
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
  'Recalcula el resumen de mensajes recibidos por telefono. Ejecutado por pg_cron cada 30 minutos. Cache de UI; no participa en la asignacion CTA.';

revoke all on function public.refresh_phone_metrics() from public, anon, authenticated;
grant execute on function public.refresh_phone_metrics() to service_role;

do $$
declare
  target_job_id bigint;
begin
  select jobid
    into target_job_id
  from cron.job
  where jobname = 'refresh-phone-metrics-every-5min'
  order by jobid
  limit 1;

  if target_job_id is null then
    raise notice 'Cron job refresh-phone-metrics-every-5min not found; skipping schedule alignment.';
    return;
  end if;

  perform cron.alter_job(
    job_id := target_job_id,
    schedule := '7,37 * * * *'
  );
end $$;
