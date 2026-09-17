-- READ ONLY. Run through Supabase MCP; save only these aggregate columns.
-- Do not collect query text, JWTs, bodies, owner ids, or reset statistics.
begin read only;
set local statement_timeout='8s';
set local lock_timeout='1s';
select clock_timestamp() as measured_at, stats_reset from extensions.pg_stat_statements_info;
select queryid::text,calls,round(total_exec_time::numeric,2) as total_ms,
  round(mean_exec_time::numeric,2) as mean_ms,round(max_exec_time::numeric,2) as max_ms,
  rows,shared_blks_read,shared_blks_hit,temp_blks_written,
  case
    when query ilike '%get_meta_audience_buyers%' then 'audiences (may include measurement wrapper)'
    when query ilike '%refresh_home_overview_stats_cache%' then 'refresh_home_cache'
    when query ilike '%get_home_overview_stats_cached_by_currency%' then 'home_cached'
    when query ilike '%get_gerencia_availability_summaries%' then 'availability'
    when query ilike '%refresh_phone%' then 'refresh_phone'
    when query ilike '%get_phone_for_landing%' then 'phone_assignment'
    else 'other'
  end as category
from extensions.pg_stat_statements
where dbid=(select oid from pg_database where datname=current_database())
  and query not ilike '%pg_stat_statements%'
order by total_exec_time desc limit 20;
rollback;

-- Some SQL tools return only the last result. Execute these SELECTs separately
-- inside their own read-only transactions if necessary. Never treat the RPC's
-- pg_stat_statements rows (often ONE JSON row) as the embedded buyer count.
