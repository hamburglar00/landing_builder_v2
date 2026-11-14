-- Additive rollout: apply before deploying the new /api/track handlers.
-- No historical event is sent or silently deleted by this migration.
alter table public.tracking_queue
  add column if not exists lease_token uuid,
  add column if not exists lease_expires_at timestamptz;

create index if not exists tracking_queue_processing_lease_idx
  on public.tracking_queue (coalesce(lease_expires_at, updated_at))
  where status = 'processing';

-- One atomic claim covers the initial HTTP request and cron. The lease is
-- deliberately longer than the bounded HTTP attempt, and is never renewed
-- from a new event timestamp. Old/ambiguous jobs remain available for review.
create or replace function public.claim_tracking_queue(
  p_limit integer default 1,
  p_id uuid default null
)
returns setof public.tracking_queue
language plpgsql
security invoker
set search_path = ''
as $$
declare
  candidate public.tracking_queue%rowtype;
  claimed public.tracking_queue%rowtype;
  claimed_count integer := 0;
  requested_limit integer := greatest(1, least(coalesce(p_limit, 1), 10));
begin
  for candidate in
    select q.* from public.tracking_queue q
    where (p_id is null or q.id = p_id)
      and (
        (q.status in ('pending', 'retry') and q.next_attempt_at <= now())
        or (q.status = 'processing'
          and coalesce(q.lease_expires_at, q.updated_at + interval '5 minutes') <= now())
      )
    order by coalesce(q.next_attempt_at, q.lease_expires_at, q.updated_at), q.id
    limit requested_limit + 50
    for update skip locked
  loop
    if candidate.created_at <= now() - interval '7 days'
      or candidate.attempt_count >= 12
      or ((candidate.status = 'processing' or candidate.attempt_count > 0)
        and nullif(btrim(candidate.event_id), '') is null)
    then
      update public.tracking_queue set
        status = 'review_required', next_attempt_at = null,
        lease_token = null, lease_expires_at = null,
        last_error = case
          when candidate.created_at <= now() - interval '7 days' then 'tracking_event_expired'
          when candidate.attempt_count >= 12 then 'tracking_attempt_limit'
          else 'tracking_recovery_missing_event_id' end
      where id = candidate.id;
      continue;
    end if;

    update public.tracking_queue set
      status = 'processing', lease_token = gen_random_uuid(),
      lease_expires_at = now() + interval '5 minutes',
      attempt_count = attempt_count + 1, next_attempt_at = null
    where id = candidate.id
    returning * into claimed;
    return next claimed;
    claimed_count := claimed_count + 1;
    exit when claimed_count >= requested_limit;
  end loop;
end;
$$;

-- Fencing prevents a delayed request/worker from overwriting a newer claim.
-- Attempts increment at claim time, including crashes; finishing never adds one.
create or replace function public.finish_tracking_queue(
  p_id uuid,
  p_lease_token uuid,
  p_delivered boolean,
  p_reason text default null,
  p_upstream_status integer default null
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  changed integer;
begin
  update public.tracking_queue q set
    status = case when p_delivered then 'sent'
      when q.attempt_count >= 12 or q.created_at <= now() - interval '7 days' then 'review_required'
      else 'retry' end,
    next_attempt_at = case when p_delivered or q.attempt_count >= 12
      or q.created_at <= now() - interval '7 days' then null
      else now() + make_interval(secs => least(1800, (30 * power(2, least(q.attempt_count, 12)))::integer)) end,
    last_error = case when p_delivered then null
      when q.attempt_count >= 12 then 'tracking_attempt_limit'
      when q.created_at <= now() - interval '7 days' then 'tracking_event_expired'
      else left(p_reason, 1000) end,
    last_status = p_upstream_status,
    lease_token = null, lease_expires_at = null
  where q.id = p_id and q.status = 'processing'
    and q.lease_token = p_lease_token and q.lease_expires_at > now();
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

revoke all on function public.claim_tracking_queue(integer, uuid) from public, anon, authenticated;
revoke all on function public.finish_tracking_queue(uuid, uuid, boolean, text, integer) from public, anon, authenticated;
grant execute on function public.claim_tracking_queue(integer, uuid) to service_role;
grant execute on function public.finish_tracking_queue(uuid, uuid, boolean, text, integer) to service_role;

comment on function public.claim_tracking_queue(integer, uuid) is
  'Service-only tracking ingestion lease. Max 12 claims/7 days. Expired historical or unidentifiable jobs require review.';
comment on function public.finish_tracking_queue(uuid, uuid, boolean, text, integer) is
  'Finish a tracking ingestion attempt only while holding its unexpired lease token; never changes event identity.';
