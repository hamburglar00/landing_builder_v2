-- Replace the initial Phase 1 query with a single buyer aggregation. The
-- signature and result remain unchanged; this avoids repeatedly joining and
-- materializing the same historical Purchase set.

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
      -- One event key, with explicit namespaces, follows the documented
      -- transaction -> Coelsa -> Purchase event -> row fallback priority.
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
      -- A single priority key avoids aggressive transitive alias merges.
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
  classified_purchases as (
    select
      dp.*,
      (
        dp.effective_purchase_at >= p_start_at
        and dp.effective_purchase_at <= p_end_at
        and (
          v_value_metric = 'first_purchase'
          or v_purchase_scope = 'all'
          or dp.normalized_purchase_type = v_purchase_scope
        )
      ) as contributes_to_metric
    from deduplicated_purchases dp
    where dp.effective_purchase_at <= p_end_at
  ),
  buyer_aggregates as (
    select
      cp.resolved_customer_key,
      count(*) filter (where cp.contributes_to_metric)::bigint as period_purchase_count,
      count(*) filter (
        where cp.contributes_to_metric and cp.normalized_purchase_type = 'first'
      )::bigint as period_first_purchase_count,
      count(*) filter (
        where cp.contributes_to_metric and cp.normalized_purchase_type = 'repeat'
      )::bigint as period_reload_count,
      coalesce(sum(cp.purchase_value) filter (where cp.contributes_to_metric), 0::numeric) as period_total_value,
      coalesce(avg(cp.purchase_value) filter (where cp.contributes_to_metric), 0::numeric) as period_average_value,
      coalesce(max(cp.purchase_value) filter (where cp.contributes_to_metric), 0::numeric) as period_max_value,
      (array_agg(cp.purchase_value order by cp.effective_purchase_at asc, cp.created_at asc, cp.id asc))[1] as historical_first_value,
      (array_agg(cp.normalized_purchase_type order by cp.effective_purchase_at asc, cp.created_at asc, cp.id asc))[1] as historical_first_type,
      coalesce((array_agg(cp.phone_normalized order by cp.effective_purchase_at desc, cp.id desc)
        filter (where nullif(cp.phone_normalized, '') is not null))[1], '') as phone,
      coalesce((array_agg(cp.email_normalized order by cp.effective_purchase_at desc, cp.id desc)
        filter (where cp.email_normalized is not null))[1], '') as email,
      coalesce((array_agg(cp.raw_fn order by cp.effective_purchase_at desc, cp.id desc)
        filter (where cp.raw_fn <> ''))[1], '') as fn,
      coalesce((array_agg(cp.raw_ln order by cp.effective_purchase_at desc, cp.id desc)
        filter (where cp.raw_ln <> ''))[1], '') as ln,
      coalesce((array_agg(cp.raw_ct order by cp.effective_purchase_at desc, cp.id desc)
        filter (where cp.raw_ct <> ''))[1], '') as ct,
      coalesce((array_agg(cp.raw_st order by cp.effective_purchase_at desc, cp.id desc)
        filter (where cp.raw_st <> ''))[1], '') as st,
      coalesce((array_agg(cp.raw_zip order by cp.effective_purchase_at desc, cp.id desc)
        filter (where cp.raw_zip <> ''))[1], '') as zip,
      coalesce((array_agg(cp.raw_country order by cp.effective_purchase_at desc, cp.id desc)
        filter (where cp.raw_country <> ''))[1], '') as country,
      min(cp.effective_purchase_at) as first_purchase_at,
      max(cp.effective_purchase_at) filter (where cp.contributes_to_metric) as last_purchase_at
    from classified_purchases cp
    group by cp.resolved_customer_key
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
    case when v_value_metric = 'first_purchase' then 1::bigint else ba.period_purchase_count end as purchase_count,
    case
      when v_value_metric = 'first_purchase' and ba.historical_first_type = 'first' then 1::bigint
      when v_value_metric = 'first_purchase' then 0::bigint
      else ba.period_first_purchase_count
    end as first_purchase_count,
    case
      when v_value_metric = 'first_purchase' and ba.historical_first_type = 'repeat' then 1::bigint
      when v_value_metric = 'first_purchase' then 0::bigint
      else ba.period_reload_count
    end as reload_count,
    case when v_value_metric = 'first_purchase' then ba.historical_first_value else ba.period_total_value end as total_value,
    case when v_value_metric = 'first_purchase' then ba.historical_first_value else ba.period_average_value end as average_purchase_value,
    case when v_value_metric = 'first_purchase' then ba.historical_first_value else ba.period_max_value end as max_purchase_value,
    ba.first_purchase_at,
    ba.last_purchase_at
  from buyer_aggregates ba
  where ba.period_purchase_count > 0
  order by
    (case when v_value_metric = 'first_purchase' then ba.historical_first_value else ba.period_total_value end) desc,
    ba.resolved_customer_key asc;
end;
$$;
