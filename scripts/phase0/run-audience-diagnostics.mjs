// Matched synthetic ARS/PYG workloads; never connects to production.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { localDatabase, root, read } from './local-runtime.mjs';
const db=await localDatabase(), results=[];
const owner='17000000-0000-0000-0000-000000000001';
try {
  db.sql(read('scripts/phase0/local-schema.sql'));
  for(const f of ['20260911175635_meta_audience_buyers_rpc.sql','20260911180712_speed_up_meta_audience_buyers_rpc.sql','20260911200034_meta_audience_buyers_v2.sql','20260911201101_compact_meta_audience_buyers_v2_payload.sql']) db.sql(read(`supabase/migrations/${f}`));
  db.sql(`insert into auth.users(id) values ('${owner}')`);
  const source=read('supabase/migrations/20260911200034_meta_audience_buyers_v2.sql');
  const body=source.slice(source.indexOf('  return query')+'  return query'.length,source.indexOf('\nend;',source.indexOf('  return query'))).trim();
  if(!body.startsWith('with raw_purchases as materialized')) throw new Error('RPC SQL extraction changed; review required');
  for(const count of [200,2815,8000,42449]) {
    db.sql(`truncate public.conversions;
      insert into public.conversions(user_id,estado,currency,email,purchase_event_id,purchase_type,valor,created_at)
      select '${owner}','purchase',currency,'synthetic-'||n||'@example.invalid','synthetic-event-'||n,
        case when n%3=0 then 'first' else 'repeat' end,n%100,'2026-09-01'::timestamptz
      from generate_series(1,${count}) n cross join (values('ARS'),('PYG')) c(currency);
      analyze public.conversions;`); // LOCAL synthetic statistics, never EXPLAIN ANALYZE.
    for(const currency of ['ARS','PYG']) {
      const prefix=`begin read only; set local statement_timeout='8s'; set local request.jwt.claim.sub='${owner}'; set local role authenticated;`;
      const inner=body.replace(/\bv_user_id\b/g,`'${owner}'::uuid`).replace(/\bv_currency\b/g,`'${currency}'::text`)
        .replace(/\bp_as_of\b/g,"'2026-09-15T23:40:00Z'::timestamptz").replace(/\bp_period_start_at\b/g,"'2026-08-17T03:00:00Z'::timestamptz")
        .replace(/\bp_period_end_at\b/g,"'2026-09-15T23:40:00Z'::timestamptz");
      const planText=db.sql(`${prefix} explain (format json, costs true) ${inner} rollback;`);
      const plan=JSON.parse(planText.slice(planText.indexOf('[\n'),planText.lastIndexOf(']')+1))[0].Plan;
      const nodes=[];
      function visit(p){nodes.push({node:p['Node Type'],relation:p['Relation Name']??p['CTE Name']??null,totalCost:p['Total Cost'],rows:p['Plan Rows'],join:p['Join Type']??null});for(const child of p.Plans??[])visit(child);}visit(plan);
      const start=performance.now();
      const result=await db.concurrentSql(`${prefix}
        with started as materialized(select clock_timestamp() t), payload as materialized (
          select get_meta_audience_buyers_v2_payload('${currency}','2026-09-15T23:40:00Z','2026-08-17T03:00:00Z','2026-09-15T23:40:00Z') data,t from started
        ) select json_build_object('rpcMs',extract(epoch from (clock_timestamp()-t))*1000,'buyers',jsonb_array_length(data->'rows'),'jsonTextBytes',octet_length(data::text)) from payload; rollback;`);
      const measurement=result.code===0?JSON.parse(result.stdout.split(/\r?\n/).find(x=>x.startsWith('{'))):null;
      const timedOut=result.stderr.includes('statement timeout');
      if(result.code!==0&&!timedOut) throw new Error(result.stderr);
      const row={currency,inputRows:count,statementTimeoutMs:8000,status:timedOut?'timeout':'measured',measurement,processElapsedMs:performance.now()-start,estimatedNodes:nodes};
      results.push(row);console.log(JSON.stringify({currency,inputRows:count,status:row.status,measurement}));
    }
  }
} finally {
  db.close();writeFileSync(join(root,'docs/optimization/phase-0/audience-diagnostics.json'),JSON.stringify({
    environment:'isolated local synthetic minimal schema; estimates are not production plans',asOf:'2026-09-15T23:40:00Z',
    procedure:'same rows, dates, role, values and limit for both currencies; EXPLAIN without ANALYZE of unchanged inner SELECT; one measured call per case',results},null,2)+'\n');
}
