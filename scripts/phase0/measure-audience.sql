-- READ ONLY measurement of the verified, STABLE v2 audience RPC only.
-- Replace both currency literals together and the fixed dates before a new baseline.
-- Target is the largest purchase owner in that currency at execution time.
-- Never save the output of set_config; it contains an owner identifier.
-- MCP normally returns the final SELECT only. No row contents leave PostgreSQL.
-- Stop on timeout. Do not increase limits or repeatedly load production.
begin read only;
set local statement_timeout='8s';
set local lock_timeout='1s';
select set_config('request.jwt.claim.sub',(
  select user_id::text from public.conversions
  where currency='PYG' and purchase_event_id is not null and purchase_event_id<>''
  group by user_id order by count(*) desc,user_id limit 1
),true);
set local role authenticated;
with start_clock as materialized (select clock_timestamp() as t),
payload as materialized (
  select public.get_meta_audience_buyers_v2_payload(
    'PYG','2026-09-15 23:40Z','2026-08-17 03:00Z','2026-09-15 23:40Z'
  ) as data,t from start_clock
), end_clock as materialized (
  select clock_timestamp() as t,data,payload.t as started from payload
)
select round((extract(epoch from(t-started))*1000)::numeric,2) as rpc_ms,
  jsonb_array_length(data->'rows') as embedded_buyers,
  octet_length(data::text) as json_text_utf8_bytes
from end_clock;
rollback;
-- Clock excludes tenant discovery, includes wrapper invocation/materialization,
-- and excludes network, browser parsing and the final JSON-to-text size calculation.
-- JSON text bytes are a DB serialization proxy, NOT compressed HTTP transfer size.
-- Fixed as_of cannot prevent newly ingested backdated events changing a future run.
-- Exact parity requires a synthetic frozen dataset or the same DB snapshot.
