-- Full, private PURCHASE acceptance. The HTTP receiver may acknowledge only after
-- enqueue commits. No historical inbox payloads are imported or replayed here.
create table public.purchase_ingest_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null check (
    length(idempotency_key) between 1 and 300 and idempotency_key = btrim(idempotency_key)
  ),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 1048576),
  request_context jsonb not null check (
    jsonb_typeof(request_context) = 'object' and octet_length(request_context::text) <= 16384
  ),
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed')),
  attempts integer not null default 0 check (attempts between 0 and 8),
  available_at timestamptz not null default now(),
  lease_token uuid,
  lease_until timestamptz,
  last_http_status integer check (last_http_status = 0 or last_http_status between 100 and 599),
  response_body text not null default '' check (length(response_body) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, idempotency_key),
  check ((status = 'processing') = (lease_token is not null and lease_until is not null)),
  check (status = 'processing' or (lease_token is null and lease_until is null))
);

-- A legacy inbox can retain its original truncated log while a newly accepted
-- receipt supplies the complete replay payload. No historical rows are linked
-- or rewritten here; only the service may establish the link during ingestion.
alter table public.conversion_inbox
  add column purchase_ingest_job_id uuid
    references public.purchase_ingest_jobs(id) on delete set null;
create index conversion_inbox_purchase_ingest_job_idx
  on public.conversion_inbox(purchase_ingest_job_id)
  where purchase_ingest_job_id is not null;
comment on column public.conversion_inbox.purchase_ingest_job_id is
  'Service-established full receipt reference. Replay must also match the inbox user_id; payload fields never choose this link.';

create index purchase_ingest_jobs_due_idx
  on public.purchase_ingest_jobs(available_at, created_at, id) where status = 'queued';
create index purchase_ingest_jobs_expired_idx
  on public.purchase_ingest_jobs(lease_until, created_at, id) where status = 'processing';
create index purchase_ingest_jobs_active_user_idx
  on public.purchase_ingest_jobs(user_id) where status in ('queued', 'processing');
create index if not exists purchase_event_claims_user_event_idx
  on public.purchase_event_claims(user_id, event_id);

alter table public.purchase_ingest_jobs enable row level security;
revoke all on public.purchase_ingest_jobs from public, anon, authenticated;
grant select, insert, update on public.purchase_ingest_jobs to service_role;

comment on table public.purchase_ingest_jobs is
  'Private full PURCHASE receipts; first accepted payload/context are immutable. No public reads or writes.';

create function public.preserve_purchase_ingest_input()
returns trigger language plpgsql security invoker set search_path = pg_catalog, public
as $$
begin
  if row(new.id, new.user_id, new.idempotency_key, new.payload, new.request_context, new.created_at)
    is distinct from row(old.id, old.user_id, old.idempotency_key, old.payload, old.request_context, old.created_at)
  then
    raise exception 'purchase_ingest_input_immutable' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.preserve_purchase_ingest_input() from public, anon, authenticated;
create trigger purchase_ingest_input_immutable
  before update on public.purchase_ingest_jobs
  for each row execute function public.preserve_purchase_ingest_input();

create function public.enqueue_purchase_ingest_job(
  p_user_id uuid,
  p_idempotency_key text,
  p_payload jsonb,
  p_request_context jsonb
)
returns table(id uuid, status text, inserted boolean)
language plpgsql security invoker set search_path = pg_catalog, public
as $$
declare
  v_id uuid;
  v_aliases jsonb;
begin
  if p_user_id is null or p_idempotency_key is null
    or length(p_idempotency_key) not between 1 and 300
    or p_idempotency_key <> btrim(p_idempotency_key)
    or p_payload is null or jsonb_typeof(p_payload) <> 'object'
    or octet_length(p_payload::text) > 1048576
    or p_request_context is null or jsonb_typeof(p_request_context) <> 'object'
    or octet_length(p_request_context::text) > 16384
  then
    raise exception 'purchase_ingest_invalid_input' using errcode = '22023';
  end if;
  v_aliases := coalesce(p_request_context->'idempotency_keys', '[]'::jsonb);
  if jsonb_typeof(v_aliases) <> 'array' then
    raise exception 'purchase_ingest_invalid_aliases' using errcode = '22023';
  end if;
  if jsonb_array_length(v_aliases) > 32 or exists (
    select 1 from jsonb_array_elements(v_aliases) as alias(value)
    where jsonb_typeof(value) <> 'string' or length(value #>> '{}') not between 1 and 300
      or (value #>> '{}') <> btrim(value #>> '{}')
  ) then
    raise exception 'purchase_ingest_invalid_aliases' using errcode = '22023';
  end if;

  insert into public.purchase_ingest_jobs(user_id, idempotency_key, payload, request_context)
  values(p_user_id, p_idempotency_key, p_payload, p_request_context)
  on conflict (user_id, idempotency_key) do nothing
  returning purchase_ingest_jobs.id into v_id;

  if v_id is not null then
    return query select jobs.id, jobs.status, true
      from public.purchase_ingest_jobs jobs where jobs.id = v_id;
  else
    -- A separate statement sees a concurrently committed insert. Never refresh
    -- original occurrence time, identity, attempts or terminal status on a retry.
    return query select jobs.id, jobs.status, false
      from public.purchase_ingest_jobs jobs
      where jobs.user_id = p_user_id and jobs.idempotency_key = p_idempotency_key;
  end if;
end;
$$;

create function public.claim_purchase_ingest_jobs(p_limit integer default 4, p_job_id uuid default null)
returns setof public.purchase_ingest_jobs
language plpgsql security invoker set search_path = pg_catalog, public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_limit integer := coalesce(p_limit, 4);
begin
  if v_limit < 1 or v_limit > 20 then
    raise exception 'purchase_ingest_invalid_limit' using errcode = '22023';
  end if;
  -- A crash on the final attempt must become terminal too; it cannot remain
  -- processing forever. Skip active locks and keep every maintenance pass bounded.
  with exhausted as (
    select jobs.id from public.purchase_ingest_jobs jobs
    where jobs.attempts >= 8 and (p_job_id is null or jobs.id = p_job_id)
      and ((jobs.status = 'processing' and jobs.lease_until <= v_now)
        or (jobs.status = 'queued' and jobs.available_at <= v_now))
    order by jobs.created_at, jobs.id limit 100 for update skip locked
  )
  update public.purchase_ingest_jobs jobs
    set status = 'failed', lease_token = null, lease_until = null,
      response_body = 'purchase_ingest_attempts_exhausted', completed_at = v_now, updated_at = v_now
    from exhausted where jobs.id = exhausted.id;

  return query
  with candidates as (
    select jobs.id from public.purchase_ingest_jobs jobs
    where jobs.attempts < 8 and (p_job_id is null or jobs.id = p_job_id)
      and ((jobs.status = 'queued' and jobs.available_at <= v_now)
        or (jobs.status = 'processing' and jobs.lease_until <= v_now))
    order by jobs.available_at, jobs.created_at, jobs.id
    limit v_limit for update skip locked
  )
  update public.purchase_ingest_jobs jobs
    set status = 'processing', attempts = jobs.attempts + 1,
      lease_token = gen_random_uuid(), lease_until = v_now + interval '10 minutes', updated_at = v_now
    from candidates where jobs.id = candidates.id
    returning jobs.*;
end;
$$;

create function public.finish_purchase_ingest_job(
  p_job_id uuid,
  p_lease_token uuid,
  p_http_status integer,
  p_response_body text,
  p_retryable boolean
)
returns boolean language plpgsql security invoker set search_path = pg_catalog, public
as $$
declare
  v_job public.purchase_ingest_jobs%rowtype;
  v_now timestamptz := clock_timestamp();
  v_retry boolean;
begin
  if p_http_status is null or not (p_http_status = 0 or p_http_status between 100 and 599)
    or p_retryable is null then
    raise exception 'purchase_ingest_invalid_result' using errcode = '22023';
  end if;
  select * into v_job from public.purchase_ingest_jobs jobs
    where jobs.id = p_job_id and jobs.status = 'processing'
      and jobs.lease_token = p_lease_token and jobs.lease_until > v_now
    for update;
  if not found then return false; end if;
  v_retry := p_retryable and v_job.attempts < 8;
  update public.purchase_ingest_jobs jobs
    set status = case when v_retry then 'queued'
      when not p_retryable and p_http_status between 200 and 299 then 'completed' else 'failed' end,
      available_at = case when v_retry
        then v_now + make_interval(secs => least(1800, 30 * power(2, v_job.attempts))::integer)
        else jobs.available_at end,
      lease_token = null, lease_until = null, last_http_status = p_http_status,
      response_body = left(coalesce(p_response_body, ''), 1000), updated_at = v_now,
      completed_at = case when v_retry then null else v_now end
    where jobs.id = v_job.id;
  return true;
end;
$$;

create function public.purchase_ingest_event_pending(p_user_id uuid, p_event_id text)
returns boolean language sql stable security invoker set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.purchase_ingest_jobs jobs
    join public.purchase_event_claim_keys keys on keys.user_id = jobs.user_id
      and (keys.idempotency_key = jobs.idempotency_key
        or keys.idempotency_key in (
          select jsonb_array_elements_text(coalesce(jobs.request_context->'idempotency_keys', '[]'::jsonb))
        ))
    join public.purchase_event_claims claims on claims.id = keys.claim_id and claims.user_id = jobs.user_id
    where jobs.user_id = p_user_id and claims.event_id = p_event_id
      and jobs.status in ('queued', 'processing')
  );
$$;

revoke all on function public.enqueue_purchase_ingest_job(uuid, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.claim_purchase_ingest_jobs(integer, uuid) from public, anon, authenticated;
revoke all on function public.finish_purchase_ingest_job(uuid, uuid, integer, text, boolean) from public, anon, authenticated;
revoke all on function public.purchase_ingest_event_pending(uuid, text) from public, anon, authenticated;
grant execute on function public.enqueue_purchase_ingest_job(uuid, text, jsonb, jsonb) to service_role;
grant execute on function public.claim_purchase_ingest_jobs(integer, uuid) to service_role;
grant execute on function public.finish_purchase_ingest_job(uuid, uuid, integer, text, boolean) to service_role;
grant execute on function public.purchase_ingest_event_pending(uuid, text) to service_role;

-- Reuse the existing, private cron configuration. No secret is embedded in the
-- migration or stored in a job/request context; pg_net performs the HTTP call.
create function public.cron_process_purchase_ingest()
returns void language plpgsql security invoker set search_path = pg_catalog, public
as $$
declare
  v_base_url text;
  v_secret text;
begin
  select value into v_base_url from public.cron_config where key = 'sync_phones_url';
  select value into v_secret from public.cron_config where key = 'sync_phones_cron_secret';
  if v_base_url is null or v_base_url like '%REPLACE_%'
    or v_base_url !~ '^https://[^/?#]+/functions/v1/sync-phones/?$'
    or nullif(btrim(v_secret), '') is null or v_secret like 'REPLACE_%' then
    return;
  end if;
  perform net.http_post(
    url := regexp_replace(v_base_url, '/sync-phones/?$', '/conversions?process_purchase_receipts=1'),
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    timeout_milliseconds := 60000
  );
end;
$$;
revoke all on function public.cron_process_purchase_ingest() from public, anon, authenticated;
grant execute on function public.cron_process_purchase_ingest() to service_role;
select cron.schedule('process-purchase-ingest', '* * * * *', 'select public.cron_process_purchase_ingest();');
