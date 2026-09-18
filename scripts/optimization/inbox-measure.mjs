import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {root} from '../phase0/local-runtime.mjs';

export function measure(db,labels=null){
  const old=readFileSync(join(root,'supabase/migrations/20260825192821_whatsapp_cloud_api_inbox_date_filter.sql'),'utf8').split('as $$')[1].split('$$;')[0].trim().replace(/;$/,'');
  const predicates=old.replace('and c.external_id = vc.external_id',"and c.external_id = vc.external_id and c.external_id <> ''").replace('and c.promo_code = la.promo_code',"and c.promo_code = la.promo_code and c.promo_code <> ''");
  const materialized=predicates.replace('unread_metrics as (','unread_metrics as materialized (');
  const parameters={p_limit:'20',p_offset:'0',p_workspace_currency:"'ARS'::text",p_tag_filter:"'all'::text",p_unread_only:'false',p_from:"'2026-09-18T03:00:00Z'::timestamptz",p_to:"'2026-09-19T02:59:59.999Z'::timestamptz"};
  const results=[];
  for(const [label,source]of [['original_today',old],['predicates_today',predicates],['predicates_materialized_unread_today',materialized],['predicates_materialized_unread_thresholds_today',materialized.replace('thresholds as (','thresholds as materialized (')]]){
    if(labels&&!labels.includes(label))continue;
    const query=Object.entries(parameters).reduce((sql,[key,value])=>sql.replace(new RegExp('\\b'+key+'\\b','g'),value),source);
    // A longer budget is used ONLY to measure the unfixed synthetic reference,
    // never as application configuration or as a criterion for the optimized RPC.
    const timeout=label==='original_today'?60000:8000;
    try {
      const plan=JSON.parse(db.sql(`BEGIN; SET LOCAL statement_timeout='${timeout}ms'; SET LOCAL request.jwt.claim.sub='74000000-0000-4000-8000-000000000001'; EXPLAIN(ANALYZE,BUFFERS,FORMAT JSON) ${query}; ROLLBACK;`))[0];
      const scans=[];const visit=n=>{if(n['Relation Name'])scans.push({table:n['Relation Name'],type:n['Node Type'],index:n['Index Name']??null,rows:n['Actual Rows'],loops:n['Actual Loops'],rowsRemovedByFilter:n['Rows Removed by Filter']??0,hits:n['Shared Hit Blocks'],reads:n['Shared Read Blocks']});for(const child of n.Plans??[])visit(child);};visit(plan.Plan);
      results.push({label,timeoutMs:timeout,sqlMs:plan['Execution Time'],planningMs:plan['Planning Time'],rows:plan.Plan['Actual Rows'],hits:plan.Plan['Shared Hit Blocks'],reads:plan.Plan['Shared Read Blocks'],scans});
    }catch(error){results.push({label,timeoutMs:timeout,sqlstate:error.sqlstate??null});}
  }
  return results;
}
