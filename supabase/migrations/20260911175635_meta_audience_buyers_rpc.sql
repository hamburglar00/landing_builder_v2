-- Audiencias Meta Phase 1: keep Purchase aggregation and identity resolution in
-- PostgreSQL so the browser receives one minimal row per buyer.

create index if not exists conversions_meta_audience_purchase_idx
  on public.conversions (user_id, currency, purchase_event_time, created_at)
  where (
    estado = 'purchase'
    or nullif(trim(coalesce(purchase_event_id, '')), '') is not null
  )
    and nullif(trim(coalesce(test_event_code, '')), '') is null;

create or replace function public.get_meta_audience_buyers(
  p_currency text,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_purchase_scope text default 'all',
  p_value_metric text default 'period_total'
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
  purchase_count bigint,
  first_purchase_count bigint,
  reload_count bigint,
  total_value numeric,
  average_purchase_value numeric,
  max_purchase_value numeric,
  first_purchase_at timestamptz,
  last_purchase_at timestamptz
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_currency text := upper(trim(coalesce(p_currency, '')));
  v_purchase_scope text := lower(trim(coalesce(p_purchase_scope, '')));
  v_value_metric text := lower(trim(coalesce(p_value_metric, '')));
begin
  if v_user_id is null then
    raise exception 'not authorized';
  end if;

  if v_currency not in ('ARS', 'PYG') then
    raise exception 'invalid currency';
  end if;

  if p_start_at is null or p_end_at is null or p_start_at > p_end_at then
    raise exception 'invalid period';
  end if;

  if v_purchase_scope not in ('all', 'first', 'repeat') then
    raise exception 'invalid purchase scope';
  end if;

  if v_value_metric not in ('first_purchase', 'period_total') then
    raise exception 'invalid value metric';
  end if;

  return query
  with raw_purchases as materialized (
    select
      c.id,
      -- purchase_event_time is Unix seconds. Out-of-range values fall back to
      -- created_at without changing the stored conversion.
      case
        when c.purchase_event_time between 1 and 32503680000
          then pg_catalog.to_timestamp(c.purchase_event_time::double precision)
        else c.created_at
      end as effective_purchase_at,
      greatest(coalesce(c.valor, 0), 0::numeric) as purchase_value,
      case
        when c.purchase_type in ('first', 'repeat') then c.purchase_type
        when coalesce(c.observaciones, '') ilike '%REPEAT%' then 'repeat'
        else 'first'
      end as normalized_purchase_type,
      -- Deduplication intentionally uses the first available identifier in
      -- this order: transaction_id, coelsa_id, purchase_event_id, row id.
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
  ),
  keyed_purchases as (
    select
      np.*,
      -- A single priority key avoids transitive alias merging. This favors
      -- avoiding false merges until a persistent customer/alias model exists.
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
    select ranked.*
    from (
      select
        kp.*,
        pg_catalog.row_number() over (
          partition by kp.event_key
          order by kp.effective_purchase_at desc, kp.created_at desc, kp.id desc
        ) as event_rank
      from keyed_purchases kp
    ) ranked
    where ranked.event_rank = 1
  ),
  period_purchases as materialized (
    select dp.*
    from deduplicated_purchases dp
    where dp.effective_purchase_at >= p_start_at
      and dp.effective_purchase_at <= p_end_at
      and (
        v_value_metric = 'first_purchase'
        or v_purchase_scope = 'all'
        or dp.normalized_purchase_type = v_purchase_scope
      )
  ),
  active_buyers as (
    select distinct pp.resolved_customer_key
    from period_purchases pp
  ),
  historical_ranked as materialized (
    select
      dp.*,
      pg_catalog.row_number() over (
        partition by dp.resolved_customer_key
        order by dp.effective_purchase_at asc, dp.created_at asc, dp.id asc
      ) as historical_purchase_rank
    from deduplicated_purchases dp
    join active_buyers ab
      on ab.resolved_customer_key = dp.resolved_customer_key
    where dp.effective_purchase_at <= p_end_at
  ),
  metric_purchases as (
    select
      pp.resolved_customer_key,
      pp.normalized_purchase_type,
      pp.purchase_value
    from period_purchases pp
    where v_value_metric = 'period_total'

    union all

    select
      hr.resolved_customer_key,
      hr.normalized_purchase_type,
      hr.purchase_value
    from historical_ranked hr
    where v_value_metric = 'first_purchase'
      and hr.historical_purchase_rank = 1
  ),
  buyer_metrics as (
    select
      mp.resolved_customer_key,
      count(*)::bigint as purchase_count,
      count(*) filter (where mp.normalized_purchase_type = 'first')::bigint as first_purchase_count,
      count(*) filter (where mp.normalized_purchase_type = 'repeat')::bigint as reload_count,
      coalesce(sum(mp.purchase_value), 0::numeric) as total_value,
      coalesce(avg(mp.purchase_value), 0::numeric) as average_purchase_value,
      coalesce(max(mp.purchase_value), 0::numeric) as max_purchase_value
    from metric_purchases mp
    group by mp.resolved_customer_key
  ),
  buyer_history as (
    select
      hr.resolved_customer_key,
      coalesce((array_agg(hr.phone_normalized order by hr.effective_purchase_at desc, hr.id desc)
        filter (where nullif(hr.phone_normalized, '') is not null))[1], '') as phone,
      coalesce((array_agg(hr.email_normalized order by hr.effective_purchase_at desc, hr.id desc)
        filter (where hr.email_normalized is not null))[1], '') as email,
      coalesce((array_agg(hr.raw_fn order by hr.effective_purchase_at desc, hr.id desc)
        filter (where hr.raw_fn <> ''))[1], '') as fn,
      coalesce((array_agg(hr.raw_ln order by hr.effective_purchase_at desc, hr.id desc)
        filter (where hr.raw_ln <> ''))[1], '') as ln,
      coalesce((array_agg(hr.raw_ct order by hr.effective_purchase_at desc, hr.id desc)
        filter (where hr.raw_ct <> ''))[1], '') as ct,
      coalesce((array_agg(hr.raw_st order by hr.effective_purchase_at desc, hr.id desc)
        filter (where hr.raw_st <> ''))[1], '') as st,
      coalesce((array_agg(hr.raw_zip order by hr.effective_purchase_at desc, hr.id desc)
        filter (where hr.raw_zip <> ''))[1], '') as zip,
      coalesce((array_agg(hr.raw_country order by hr.effective_purchase_at desc, hr.id desc)
        filter (where hr.raw_country <> ''))[1], '') as country,
      min(hr.effective_purchase_at) as first_purchase_at
    from historical_ranked hr
    group by hr.resolved_customer_key
  ),
  buyer_period_activity as (
    select
      pp.resolved_customer_key,
      max(pp.effective_purchase_at) as last_purchase_at
    from period_purchases pp
    group by pp.resolved_customer_key
  )
  select
    bm.resolved_customer_key as customer_key,
    bh.phone,
    bh.email,
    bh.fn,
    bh.ln,
    bh.ct,
    bh.st,
    bh.zip,
    bh.country,
    v_currency as currency,
    bm.purchase_count,
    bm.first_purchase_count,
    bm.reload_count,
    bm.total_value,
    bm.average_purchase_value,
    bm.max_purchase_value,
    bh.first_purchase_at,
    bpa.last_purchase_at
  from buyer_metrics bm
  join buyer_history bh
    on bh.resolved_customer_key = bm.resolved_customer_key
  join buyer_period_activity bpa
    on bpa.resolved_customer_key = bm.resolved_customer_key
  order by bm.total_value desc, bm.resolved_customer_key asc;
end;
$$;

comment on function public.get_meta_audience_buyers(text, timestamptz, timestamptz, text, text) is
  'Returns Purchase buyers for manual Meta audience CSVs. Uses purchase_event_time with created_at fallback, query-only deduplication, conservative identity keys and authenticated-user isolation.';

revoke all on function public.get_meta_audience_buyers(text, timestamptz, timestamptz, text, text)
  from public, anon;

grant execute on function public.get_meta_audience_buyers(text, timestamptz, timestamptz, text, text)
  to authenticated;
