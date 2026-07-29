-- Atomic idempotency gate for Purchase processing.
-- A payment can expose more than one stable identifier (Coelsa and transaction).
-- Every identifier is attached to the same claim so concurrent webhooks cannot
-- generate different Meta event_ids for the same payment.

create table if not exists public.purchase_event_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_id text not null,
  status text not null default 'processing'
    check (status in ('processing', 'processed', 'deduplicated', 'error')),
  conversion_id uuid references public.conversions (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.purchase_event_claim_keys (
  user_id uuid not null references auth.users (id) on delete cascade,
  idempotency_key text not null,
  claim_id uuid not null references public.purchase_event_claims (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, idempotency_key)
);

create index if not exists purchase_event_claims_user_created_idx
  on public.purchase_event_claims (user_id, created_at desc);

create index if not exists purchase_event_claim_keys_claim_idx
  on public.purchase_event_claim_keys (claim_id);

alter table public.purchase_event_claims enable row level security;
alter table public.purchase_event_claim_keys enable row level security;

comment on table public.purchase_event_claims is
  'Reserva atomica de un unico Meta event_id por compra para evitar envios CAPI concurrentes.';

comment on table public.purchase_event_claim_keys is
  'Identificadores estables (transaccion, Coelsa o action_event_id) asociados a una reserva Purchase.';

create or replace function public.claim_purchase_event(
  p_user_id uuid,
  p_idempotency_keys text[],
  p_candidate_event_id text
)
returns table (
  claimed boolean,
  claim_id uuid,
  event_id text,
  conversion_id uuid,
  claim_status text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_keys text[];
  v_key text;
  v_claim public.purchase_event_claims%rowtype;
begin
  select coalesce(array_agg(distinct clean_key order by clean_key), array[]::text[])
    into v_keys
  from (
    select left(btrim(raw_key), 300) as clean_key
    from unnest(coalesce(p_idempotency_keys, array[]::text[])) as raw_key
    where btrim(coalesce(raw_key, '')) <> ''
  ) normalized;

  if coalesce(array_length(v_keys, 1), 0) = 0 then
    return query
    select true, null::uuid, p_candidate_event_id, null::uuid, 'unprotected'::text;
    return;
  end if;

  -- Serialize every alias in a deterministic order. Transaction-scoped advisory
  -- locks close the read-before-write race without holding locks after the RPC.
  foreach v_key in array v_keys loop
    perform pg_advisory_xact_lock(
      hashtextextended(p_user_id::text || ':' || v_key, 0)
    );
  end loop;

  select claims.*
    into v_claim
  from public.purchase_event_claim_keys keys
  join public.purchase_event_claims claims on claims.id = keys.claim_id
  where keys.user_id = p_user_id
    and keys.idempotency_key = any(v_keys)
  order by claims.created_at asc
  limit 1;

  if found then
    -- A failed or abandoned attempt may retry, but it must reuse the original
    -- event_id so Meta sees the same event rather than a second purchase.
    if v_claim.status = 'error'
      or (
        v_claim.status = 'processing'
        and v_claim.updated_at < now() - interval '5 minutes'
      )
    then
      update public.purchase_event_claims
      set status = 'processing',
          updated_at = now()
      where id = v_claim.id
      returning * into v_claim;

      return query
      select true, v_claim.id, v_claim.event_id, v_claim.conversion_id, v_claim.status;
      return;
    end if;

    return query
    select false, v_claim.id, v_claim.event_id, v_claim.conversion_id, v_claim.status;
    return;
  end if;

  insert into public.purchase_event_claims (user_id, event_id)
  values (p_user_id, p_candidate_event_id)
  returning * into v_claim;

  insert into public.purchase_event_claim_keys (user_id, idempotency_key, claim_id)
  select p_user_id, key_value, v_claim.id
  from unnest(v_keys) as key_value;

  return query
  select true, v_claim.id, v_claim.event_id, v_claim.conversion_id, v_claim.status;
end;
$$;

create or replace function public.complete_purchase_event_claim(
  p_claim_id uuid,
  p_conversion_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_claim_id is null then
    return;
  end if;

  update public.purchase_event_claims
  set conversion_id = coalesce(p_conversion_id, conversion_id),
      status = case
        when p_status in ('processed', 'deduplicated', 'error') then p_status
        else 'error'
      end,
      updated_at = now()
  where id = p_claim_id;
end;
$$;

revoke all on table public.purchase_event_claims from anon, authenticated;
revoke all on table public.purchase_event_claim_keys from anon, authenticated;
revoke all on function public.claim_purchase_event(uuid, text[], text) from public, anon, authenticated;
revoke all on function public.complete_purchase_event_claim(uuid, uuid, text) from public, anon, authenticated;

grant all on table public.purchase_event_claims to service_role;
grant all on table public.purchase_event_claim_keys to service_role;
grant execute on function public.claim_purchase_event(uuid, text[], text) to service_role;
grant execute on function public.complete_purchase_event_claim(uuid, uuid, text) to service_role;
