// Local synthetic diagnosis only. No connection strings or production inputs.
import assert from 'node:assert/strict';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {root} from '../phase0/local-runtime.mjs';
import {assertSafeEnvironment, validateManifest, hash} from '../phase0/bootstrap-manifest.mjs';
import {createBootstrapDatabase} from '../phase0/bootstrap-runtime.mjs';
import {compatibilitySources, applyCompatibility} from '../phase0/bootstrap-compatibility.mjs';
import {alignNativePgNet} from '../phase0/bootstrap-net.mjs';
import {createInterface} from 'node:readline';

const interactive=process.env.INBOX_DIAGNOSTIC_INTERACTIVE==='1';
assertSafeEnvironment();
const folder=join(root,'docs/optimization/inbox');
mkdirSync(folder,{recursive:true});
const report={kind:'synthetic_diagnosis',complete:false,migrationsApplied:0,productionData:false,remoteCalls:0,measurements:[]};
const previousPath=join(folder,'synthetic-diagnostic.json');
if(existsSync(previousPath)){
  const previous=JSON.parse(readFileSync(previousPath,'utf8'));
  report.priorAttempts=[...(previous.priorAttempts??[]),{complete:previous.complete,migrationsApplied:previous.migrationsApplied,failure:previous.failure??null,cleanup:previous.cleanup}];
}
report.harnessCorrections=[
  {number:1,reason:'Static review: strip the embedded statement terminator before wrapping it in a CTE; distinguish fixture timeouts from Inbox SELECT timeouts.'},
  {number:2,reason:'Provide and populate the migration ledger required by the accredited compatibility harness; first attempt stopped at 268 with SQLSTATE 42P01.'},
  {number:3,reason:'Terminate the EXPLAIN statement before ROLLBACK; retain the delimiter-free expression only inside the measurement CTE.'},
];
const save=()=>writeFileSync(join(folder,'synthetic-diagnostic.json'),JSON.stringify(report,null,2)+'\n');
let db;
try {
  report.stage='baseline';
  const manifest=validateManifest();assert(manifest.entries.length>=273);
  const baselineEntries=manifest.entries.slice(0,273);
  report.migrationManifestSha256=hash(JSON.stringify(baselineEntries.map(x=>({file:x.file,sha256:x.sha256}))));
  db=await createBootstrapDatabase();report.provider=db.provider;
  report.nativeCompatibility=alignNativePgNet(db);
  db.sql('CREATE SCHEMA IF NOT EXISTS supabase_migrations; CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations(version text PRIMARY KEY,statements text[],name text);');
  for(const [index,entry]of baselineEntries.entries()) {
    if(index===268)report.compatibility=applyCompatibility(db,compatibilitySources());
    assert(db.verify());
    for(const relation of entry.requiredEmptyRelations??[]){assert(/^public\.[a-z_]+$/.test(relation));assert.equal(db.sql(`SELECT NOT EXISTS(SELECT FROM ${relation})`).trim(),'t');}
    db.sql(`BEGIN; SET LOCAL statement_timeout='45s'; SET LOCAL lock_timeout='5s'; SET LOCAL phase0.tracking_retry_url='http://127.0.0.1:1/inbox-disabled'; SET LOCAL phase0.tracking_retry_token='synthetic-local'; ${manifest.sources.get(entry.file)} INSERT INTO supabase_migrations.schema_migrations(version,name) VALUES('${entry.version}','${entry.file.slice(entry.version.length+1,-4)}'); COMMIT;`);
    report.migrationsApplied++;if(report.migrationsApplied%50===0||report.migrationsApplied===273){save();console.log(`Synthetic baseline ${report.migrationsApplied}/273`);}
  }
  const fixture=readFileSync(join(root,'scripts/optimization/inbox-diagnostic-fixture.sql'),'utf8');
  report.stage='fixture';db.sql(fixture);console.log('Synthetic fixture ready');
  const migration=readFileSync(join(root,'supabase/migrations/20260825192821_whatsapp_cloud_api_inbox_date_filter.sql'),'utf8');
  const original=migration.split('as $$')[1].split('$$;')[0];
  let candidate=original.replace('and c.external_id = vc.external_id',"and c.external_id = vc.external_id\n     and c.external_id <> ''").replace('and c.promo_code = la.promo_code',"and c.promo_code = la.promo_code\n     and c.promo_code <> ''");
  const parameters={p_limit:'20',p_offset:'0',p_workspace_currency:"'ARS'::text",p_tag_filter:"'all'::text",p_unread_only:'false',p_from:'null::timestamptz',p_to:'null::timestamptz'};
  const bind=sql=>Object.entries(parameters).reduce((s,[k,v])=>s.replace(new RegExp('\\b'+k+'\\b','g'),v),sql).trim().replace(/;$/, '');
  const identity="SET LOCAL request.jwt.claim.sub='74000000-0000-4000-8000-000000000001'; SET LOCAL ROLE authenticated;";
  report.fixture=JSON.parse(db.sql("SELECT json_build_object('contacts',(SELECT count(*) FROM public.whatsapp_cloud_api_contacts),'conversions',(SELECT count(*) FROM public.conversions),'messages',(SELECT count(*) FROM public.whatsapp_cloud_api_webhook_events),'conversionBytes',pg_total_relation_size('public.conversions'))").trim());
  for(const [label,source]of [['before',original],['predicate_candidate',candidate]]) {
    report.stage='measurement_'+label;
    // Direct SELECT uses the same owner scope but RLS as postgres, matching the existing SECURITY DEFINER body.
    const query=bind(source);
    const plan=JSON.parse(db.sql(`BEGIN; SET LOCAL statement_timeout='8s'; SET LOCAL request.jwt.claim.sub='74000000-0000-4000-8000-000000000001'; EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}; ROLLBACK;`).trim())[0];
    const metrics=JSON.parse(db.sql(`BEGIN; SET LOCAL statement_timeout='8s'; SET LOCAL request.jwt.claim.sub='74000000-0000-4000-8000-000000000001'; WITH result AS (${query}) SELECT json_build_object('rows',count(*),'messages',sum(jsonb_array_length(messages)),'jsonBytes',octet_length(coalesce(json_agg(result)::text,'[]')),'resultHash',md5(coalesce(jsonb_agg(to_jsonb(result) ORDER BY contact_id)::text,'[]'))) FROM result; ROLLBACK;`).trim());
    const scans=[];const visit=n=>{if(n['Relation Name']==='conversions')scans.push({type:n['Node Type'],index:n['Index Name']??null,actualRows:n['Actual Rows'],loops:n['Actual Loops']});for(const p of n.Plans??[])visit(p);};visit(plan.Plan);
    report.measurements.push({label,sqlMs:plan['Execution Time'],planningMs:plan['Planning Time'],planCost:plan.Plan['Total Cost'],sharedHitBlocks:plan.Plan['Shared Hit Blocks'],sharedReadBlocks:plan.Plan['Shared Read Blocks'],conversionScans:scans,...metrics});save();
  }
  report.stage='existing_authenticated_rpc';
  const rpc=JSON.parse(db.sql(`BEGIN; SET LOCAL statement_timeout='8s'; ${identity} EXPLAIN (ANALYZE, FORMAT JSON) SELECT * FROM public.get_whatsapp_cloud_api_inbox_threads_page(20,0,'ARS','all',false,null,null); ROLLBACK;`).trim())[0];
  report.existingAuthenticatedRpcMs=rpc['Execution Time'];
  report.resultsIdentical=report.measurements[0].resultHash===report.measurements[1].resultHash;
  assert(report.resultsIdentical);
  report.observedTimeoutReproduced=false;
  report.complete=true;
  if(interactive) {
    console.log('LOCAL_SYNTHETIC_READY '+JSON.stringify(db.localApiTarget()));
    console.log(JSON.stringify(report.measurements));
    const input=createInterface({input:process.stdin,terminal:false});
    for await(const line of input) {
      if(line.trim()==='exit')break;
      try {const command=JSON.parse(line);assert.equal(command.operation,'sql');assert.equal(typeof command.query,'string');assert(db.verify());console.log(JSON.stringify({ok:true,result:db.sql(command.query)}));}
      catch(error){console.log(JSON.stringify({ok:false,message:error.message,sqlstate:error.sqlstate??null}));}
    }
  }
}catch(error){report.failure={stage:report.stage,message:error.message,sqlstate:error.sqlstate??null};report.observedTimeoutReproduced=error.sqlstate==='57014'&&['measurement_before','existing_authenticated_rpc'].includes(report.stage);process.exitCode=1;}
finally {if(db)try{report.cleanup=db.close();}catch{report.cleanup={failed:true};report.complete=false;process.exitCode=1;}save();console.log(JSON.stringify(report));}
