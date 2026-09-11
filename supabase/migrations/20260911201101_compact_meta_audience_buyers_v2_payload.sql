-- Keep the stable, named row RPC for SQL callers while compacting the Data API
-- transport. The payload version fixes the positional contract and avoids
-- repeating 28 JSON property names for every buyer.

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
  select pg_catalog.jsonb_build_object(
    'version', 2,
    'rows', coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_array(
          b.customer_key,
          b.phone,
          b.email,
          b.fn,
          b.ln,
          b.ct,
          b.st,
          b.zip,
          b.country,
          b.currency,
          b.historical_purchase_count,
          b.historical_first_purchase_count,
          b.historical_reload_count,
          b.historical_total_value,
          b.historical_average_purchase_value,
          b.historical_max_purchase_value,
          b.historical_first_purchase_value,
          b.historical_first_purchase_at,
          b.last_historical_purchase_at,
          b.days_since_last_purchase,
          b.period_purchase_count,
          b.period_first_purchase_count,
          b.period_reload_count,
          b.period_total_value,
          b.period_first_purchase_total_value,
          b.period_reload_total_value,
          b.period_average_purchase_value,
          b.period_max_purchase_value
        )
        order by b.customer_key
      ),
      '[]'::jsonb
    )
  )
  from public.get_meta_audience_buyers_v2(
    p_currency,
    p_as_of,
    p_period_start_at,
    p_period_end_at
  ) b;
$$;

comment on function public.get_meta_audience_buyers_v2_payload(text, timestamptz, timestamptz, timestamptz) is
  'Returns all v2 buyers in one compact versioned JSON payload so Data API row limits cannot truncate it.';

revoke all on function public.get_meta_audience_buyers_v2_payload(text, timestamptz, timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.get_meta_audience_buyers_v2_payload(text, timestamptz, timestamptz, timestamptz)
  to authenticated;
