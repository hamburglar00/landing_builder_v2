-- Audiencias Meta Phase 2A: stable historical and period buyer metrics.
-- The row RPC remains convenient for SQL/reporting. The JSON transport wraps
-- the complete result in one Data API row so PostgREST's row cap cannot
-- silently truncate frontend percentiles.

create or replace function public.get_meta_audience_buyers_v2(
  p_currency text,
  p_as_of timestamptz,
  p_period_start_at timestamptz,
  p_period_end_at timestamptz
)
returns table (
  customer_key text,
  phone text,
  email text,
  fn text,
  ln text,
  ct text,
  st text,
  zip text,
  country text,
  currency text,
  historical_purchase_count bigint,
  historical_first_purchase_count bigint,
  historical_reload_count bigint,
  historical_total_value numeric,
  historical_average_purchase_value numeric,
  historical_max_purchase_value numeric,
  historical_first_purchase_value numeric,
  historical_first_purchase_at timestamptz,
  last_historical_purchase_at timestamptz,
  days_since_last_purchase bigint,
  period_purchase_count bigint,
  period_first_purchase_count bigint,
  period_reload_count bigint,
  period_total_value numeric,
  period_first_purchase_total_value numeric,
  period_reload_total_value numeric,
  period_average_purchase_value numeric,
  period_max_purchase_value numeric
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_currency text := upper(trim(coalesce(p_currency, '')));
begin
  if v_user_id is null then
    raise exception 'not authorized';
  end if;

  if v_currency not in ('ARS', 'PYG') then
    raise exception 'invalid currency';
  end if;

  if p_as_of is null
    or p_period_start_at is null
    or p_period_end_at is null
    or p_period_start_at > p_period_end_at
    or p_period_end_at > p_as_of
  then
    raise exception 'invalid period';
  end if;

  return query
  with raw_purchases as materialized (
    select
      c.id,
      case
        when c.purchase_event_time between 1 and 32503680000
          then pg_catalog.to_timestamp(c.purchase_event_time::double precision)
        else c.created_at
      end as effective_purchase_at,
      greatest(coalesce(c.valor, 0), 0::numeric) as purchase_value,
      case
        when c.purchase_type = 'first' then 'first'
        when c.purchase_type = 'repeat' then 'repeat'
        else null
      end as normalized_purchase_type,
      case
        when nullif(trim(coalesce(c.purchase_transaction_id, '')), '') is not null
          then 'transaction:' || trim(c.purchase_transaction_id)
        when nullif(trim(coalesce(c.purchase_coelsa_id, '')), '') is not null
          then 'coelsa:' || trim(c.purchase_coelsa_id)
        when nullif(trim(coalesce(c.purchase_event_id, '')), '') is not null
          then 'event:' || trim(c.purchase_event_id)
        else 'row:' || c.id::text
      end as event_key,
      nullif(trim(coalesce(nullif(trim(c.purchase_atrio_id), ''), nullif(trim(c.atrio_id), ''))), '') as atrio_id,
      nullif(trim(coalesce(nullif(trim(c.purchase_atrio_players_id), ''), nullif(trim(c.atrio_players_id), ''))), '') as players_id,
      nullif(
        pg_catalog.regexp_replace(
          coalesce(nullif(trim(c.phone), ''), nullif(trim(c.form_phone), ''), ''),
          '[^0-9]',
          '',
          'g'
        ),
        ''
      ) as phone_digits,
      case
        when position('@' in lower(trim(coalesce(nullif(trim(c.email), ''), nullif(trim(c.form_email), ''), '')))) > 1
          then lower(trim(coalesce(nullif(trim(c.email), ''), nullif(trim(c.form_email), ''), '')))
        else null
      end as email_normalized,
      nullif(lower(trim(coalesce(c.external_id, ''))), '') as external_id_normalized,
      lower(trim(coalesce(c.source_platform, 'unknown'))) as source_platform_normalized,
      trim(coalesce(nullif(trim(c.fn), ''), nullif(trim(c.form_fn), ''), '')) as raw_fn,
      trim(coalesce(nullif(trim(c.ln), ''), nullif(trim(c.form_ln), ''), '')) as raw_ln,
      trim(coalesce(nullif(trim(c.ct), ''), nullif(trim(c.geo_city), ''), '')) as raw_ct,
      trim(coalesce(nullif(trim(c.st), ''), nullif(trim(c.geo_region), ''), '')) as raw_st,
      trim(coalesce(c.zip, '')) as raw_zip,
      trim(coalesce(nullif(trim(c.country), ''), nullif(trim(c.geo_country), ''), '')) as raw_country,
      c.created_at
    from public.conversions c
    where c.user_id = v_user_id
      and c.currency = v_currency
      and (
        c.estado = 'purchase'
        or nullif(trim(coalesce(c.purchase_event_id, '')), '') is not null
      )
      and nullif(trim(coalesce(c.test_event_code, '')), '') is null
  ),
  normalized_purchases as (
    select
      rp.*,
      case
        when rp.phone_digits like '00%' then substring(rp.phone_digits from 3)
        else rp.phone_digits
      end as phone_normalized
    from raw_purchases rp
    where rp.effective_purchase_at <= p_as_of
  ),
  keyed_purchases as (
    select
      np.*,
      case
        when np.atrio_id is not null and np.players_id is not null
          then 'atrio:' || pg_catalog.md5(lower(np.atrio_id) || ':' || lower(np.players_id))
        when nullif(np.phone_normalized, '') is not null
          then 'phone:' || np.phone_normalized
        when np.email_normalized is not null
          then 'email:' || np.email_normalized
        when np.external_id_normalized is not null
          then 'external:' || np.source_platform_normalized || ':' || np.external_id_normalized
        else 'row:' || np.id::text
      end as resolved_customer_key
    from normalized_purchases np
  ),
  deduplicated_purchases as materialized (
    select distinct on (kp.event_key)
      kp.*
    from keyed_purchases kp
    order by
      kp.event_key,
      kp.effective_purchase_at desc,
      kp.created_at desc,
      kp.id desc
  ),
  historical_first_purchases as materialized (
    select distinct on (dp.resolved_customer_key)
      dp.resolved_customer_key,
      dp.purchase_value,
      dp.effective_purchase_at
    from deduplicated_purchases dp
    where dp.normalized_purchase_type = 'first'
    order by
      dp.resolved_customer_key,
      dp.effective_purchase_at asc,
      dp.created_at asc,
      dp.id asc
  ),
  buyer_aggregates as (
    select
      dp.resolved_customer_key,
      count(*)::bigint as historical_purchase_count,
      count(*) filter (where dp.normalized_purchase_type = 'first')::bigint as historical_first_purchase_count,
      count(*) filter (where dp.normalized_purchase_type = 'repeat')::bigint as historical_reload_count,
      coalesce(sum(dp.purchase_value), 0::numeric) as historical_total_value,
      avg(dp.purchase_value) as historical_average_purchase_value,
      max(dp.purchase_value) as historical_max_purchase_value,
      max(dp.effective_purchase_at) as last_historical_purchase_at,
      count(*) filter (
        where dp.effective_purchase_at >= p_period_start_at
          and dp.effective_purchase_at <= p_period_end_at
      )::bigint as period_purchase_count,
      count(*) filter (
        where dp.effective_purchase_at >= p_period_start_at
          and dp.effective_purchase_at <= p_period_end_at
          and dp.normalized_purchase_type = 'first'
      )::bigint as period_first_purchase_count,
      count(*) filter (
        where dp.effective_purchase_at >= p_period_start_at
          and dp.effective_purchase_at <= p_period_end_at
          and dp.normalized_purchase_type = 'repeat'
      )::bigint as period_reload_count,
      coalesce(sum(dp.purchase_value) filter (
        where dp.effective_purchase_at >= p_period_start_at
          and dp.effective_purchase_at <= p_period_end_at
      ), 0::numeric) as period_total_value,
      coalesce(sum(dp.purchase_value) filter (
        where dp.effective_purchase_at >= p_period_start_at
          and dp.effective_purchase_at <= p_period_end_at
          and dp.normalized_purchase_type = 'first'
      ), 0::numeric) as period_first_purchase_total_value,
      coalesce(sum(dp.purchase_value) filter (
        where dp.effective_purchase_at >= p_period_start_at
          and dp.effective_purchase_at <= p_period_end_at
          and dp.normalized_purchase_type = 'repeat'
      ), 0::numeric) as period_reload_total_value,
      avg(dp.purchase_value) filter (
        where dp.effective_purchase_at >= p_period_start_at
          and dp.effective_purchase_at <= p_period_end_at
      ) as period_average_purchase_value,
      max(dp.purchase_value) filter (
        where dp.effective_purchase_at >= p_period_start_at
          and dp.effective_purchase_at <= p_period_end_at
      ) as period_max_purchase_value,
      coalesce(max(dp.phone_normalized) filter (where nullif(dp.phone_normalized, '') is not null), '') as phone,
      coalesce(max(dp.email_normalized) filter (where dp.email_normalized is not null), '') as email,
      coalesce(max(dp.raw_fn) filter (where dp.raw_fn <> ''), '') as fn,
      coalesce(max(dp.raw_ln) filter (where dp.raw_ln <> ''), '') as ln,
      coalesce(max(dp.raw_ct) filter (where dp.raw_ct <> ''), '') as ct,
      coalesce(max(dp.raw_st) filter (where dp.raw_st <> ''), '') as st,
      coalesce(max(dp.raw_zip) filter (where dp.raw_zip <> ''), '') as zip,
      coalesce(max(dp.raw_country) filter (where dp.raw_country <> ''), '') as country
    from deduplicated_purchases dp
    group by dp.resolved_customer_key
  )
  select
    ba.resolved_customer_key as customer_key,
    ba.phone,
    ba.email,
    ba.fn,
    ba.ln,
    ba.ct,
    ba.st,
    ba.zip,
    ba.country,
    v_currency as currency,
    ba.historical_purchase_count,
    ba.historical_first_purchase_count,
    ba.historical_reload_count,
    ba.historical_total_value,
    ba.historical_average_purchase_value,
    ba.historical_max_purchase_value,
    hfp.purchase_value as historical_first_purchase_value,
    hfp.effective_purchase_at as historical_first_purchase_at,
    ba.last_historical_purchase_at,
    pg_catalog.floor(
      extract(epoch from (p_as_of - ba.last_historical_purchase_at)) / 86400
    )::bigint as days_since_last_purchase,
    ba.period_purchase_count,
    ba.period_first_purchase_count,
    ba.period_reload_count,
    ba.period_total_value,
    ba.period_first_purchase_total_value,
    ba.period_reload_total_value,
    ba.period_average_purchase_value,
    ba.period_max_purchase_value
  from buyer_aggregates ba
  left join historical_first_purchases hfp
    on hfp.resolved_customer_key = ba.resolved_customer_key
  order by ba.resolved_customer_key asc;
end;
$$;

create or replace function public.get_meta_audience_buyers_v2_payload(
  p_currency text,
  p_as_of timestamptz,
  p_period_start_at timestamptz,
  p_period_end_at timestamptz
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    pg_catalog.jsonb_agg(pg_catalog.to_jsonb(b) order by b.customer_key),
    '[]'::jsonb
  )
  from public.get_meta_audience_buyers_v2(
    p_currency,
    p_as_of,
    p_period_start_at,
    p_period_end_at
  ) b;
$$;

comment on function public.get_meta_audience_buyers_v2(text, timestamptz, timestamptz, timestamptz) is
  'Returns stable historical and period Meta audience buyer metrics for the authenticated owner.';

comment on function public.get_meta_audience_buyers_v2_payload(text, timestamptz, timestamptz, timestamptz) is
  'Returns the complete v2 buyer result as one JSON array so the Data API row limit cannot truncate it.';

revoke all on function public.get_meta_audience_buyers_v2(text, timestamptz, timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.get_meta_audience_buyers_v2(text, timestamptz, timestamptz, timestamptz)
  to authenticated;

revoke all on function public.get_meta_audience_buyers_v2_payload(text, timestamptz, timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.get_meta_audience_buyers_v2_payload(text, timestamptz, timestamptz, timestamptz)
  to authenticated;
