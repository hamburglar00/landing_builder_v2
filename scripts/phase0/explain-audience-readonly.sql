-- Production-safe estimate only: no ANALYZE, no RPC execution, no stored objects.
-- Returns only plan node kinds, estimated rows/costs and function identity.
-- Tenant selection is aggregate-only and bounded by statement_timeout.
begin read only;
set local statement_timeout='8s';
set local lock_timeout='1s';
do $phase0$
declare
  definition text;
  body text;
  query text;
  tenant uuid;
  currency_code text;
  plan jsonb;
  nodes jsonb;
  report jsonb := '[]'::jsonb;
begin
  definition := pg_get_functiondef('public.get_meta_audience_buyers_v2(text,timestamptz,timestamptz,timestamptz)'::regprocedure);
  body := substring(definition from '(?s)return query\s+(with raw_purchases.*?);\s*end;');
  if body is null then raise exception 'RPC definition changed; review extraction before planning'; end if;
  foreach currency_code in array array['ARS','PYG'] loop
    select c.user_id into tenant from public.conversions c
      where c.currency=currency_code and c.purchase_event_id is not null and c.purchase_event_id<>''
      group by c.user_id order by count(*) desc,c.user_id limit 1;
    if tenant is null then raise exception 'No aggregate tenant candidate'; end if;
    query := replace(replace(replace(replace(replace(body,
      'v_user_id',quote_literal(tenant)||'::uuid'),
      'v_currency',quote_literal(currency_code)||'::text'),
      'p_as_of',quote_literal('2026-09-15T23:40:00Z')||'::timestamptz'),
      'p_period_start_at',quote_literal('2026-08-17T03:00:00Z')||'::timestamptz'),
      'p_period_end_at',quote_literal('2026-09-15T23:40:00Z')||'::timestamptz');
    perform set_config('request.jwt.claim.sub',tenant::text,true);
    set local role authenticated;
    execute 'explain (format json, costs true) '||query into plan;
    reset role;
    with recursive tree(node) as (
      select plan->0->'Plan'
      union all
      select child.value from tree t cross join lateral jsonb_array_elements(coalesce(t.node->'Plans','[]'::jsonb)) child
    ) select jsonb_agg(jsonb_build_object(
      'node',node->'Node Type','subplan',node->'Subplan Name','join',node->'Join Type',
      'rows',node->'Plan Rows','width',node->'Plan Width','cost',node->'Total Cost'
    )) into nodes from tree;
    report := report || jsonb_build_array(jsonb_build_object('currency',currency_code,'definitionMd5',md5(definition),'nodes',nodes));
  end loop;
  perform set_config('phase0.explain_report',report::text,true);
end;
$phase0$;
select current_setting('phase0.explain_report')::jsonb as estimated_plans;
rollback;
