import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {root} from '../phase0/local-runtime.mjs';
import {validateManifest,hash} from '../phase0/bootstrap-manifest.mjs';
import {profileDataApi} from '../security/profile-data-api.mjs';

const client='74000000-0000-4000-8000-000000000001';
const other='74000000-0000-4000-8000-000000000002';
const admin='74000000-0000-4000-8000-000000000003';
const oracleSettings="SET LOCAL enable_nestloop=off; SET LOCAL jit=off; ";
const source=readFileSync(join(root,'supabase/migrations/20260825192821_whatsapp_cloud_api_inbox_date_filter.sql'),'utf8').split('as $$')[1].split('$$;')[0].trim().replace(/;$/,'');
const lit=value=>value===null?'null':typeof value==='boolean'||typeof value==='number'?String(value):"'"+value.replaceAll("'","''")+"'";
const args=(extra={})=>({p_limit:20,p_offset:0,p_workspace_currency:'ARS',p_tag_filter:'all',p_unread_only:false,p_from:'2026-09-18T03:00:00Z',p_to:'2026-09-19T02:59:59.999Z',...extra});
const bound=parameters=>Object.entries(parameters).reduce((sql,[key,value])=>sql.replace(new RegExp('\\b'+key+'\\b','g'),lit(value)+(key==='p_from'||key==='p_to'?'::timestamptz':'')),source);
const referenceBound=parameters=>bound(parameters).replaceAll(' as (',' as materialized (');
const txn=(sql,user=client,role='postgres',timeoutMs=8000)=>`BEGIN; SET LOCAL statement_timeout='${timeoutMs}ms'; SET LOCAL request.jwt.claim.sub='${user}'; SET LOCAL ROLE ${role}; ${sql}; ROLLBACK;`;
const json=(db,sql,user=client,role='postgres',timeoutMs=8000)=>JSON.parse(db.sql(txn(sql,user,role,timeoutMs)).trim());
const summaries=(db,parameters,user=client)=>json(db,`SELECT coalesce(jsonb_agg(r),'[]') FROM public.get_whatsapp_cloud_api_inbox_summaries(${Object.values(parameters).map(lit).join(',')}) r`,user,'authenticated');
const detail=(db,id,cursor=null,user=client)=>json(db,`SELECT public.get_whatsapp_cloud_api_inbox_messages(${[id,cursor?.at??null,cursor?.stream??null,cursor?.id??null].map(lit).join(',')})`,user,'authenticated');

function measureCurrentReads(db){
  return Object.fromEntries([
    ['summaries',"SELECT * FROM public.get_whatsapp_cloud_api_inbox_summaries(20,0,'ARS','all',false,'2026-09-18T03:00:00Z','2026-09-19T02:59:59.999Z')"],
    ['selectedDetail',"SELECT public.get_whatsapp_cloud_api_inbox_messages(md5('inbox-contact-1')::uuid)"],
  ].map(([name,sql])=>{
    const plan=json(db,'EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) '+sql,client,'authenticated')[0];
    return [name,{sqlMs:plan['Execution Time'],planningMs:plan['Planning Time'],rows:plan.Plan['Actual Rows'],hits:plan.Plan['Shared Hit Blocks'],reads:plan.Plan['Shared Read Blocks'],timeoutMs:8000}];
  }));
}

export async function run(db,report,save){
  const {measure}=await import('./inbox-measure.mjs?source='+hash(readFileSync(join(root,'scripts/optimization/inbox-measure.mjs'))));
  if(report.complete&&report.migrationSha256===validateManifest().entries[273].sha256){
    if(!report.rpcMeasurements){report.rpcMeasurements=measureCurrentReads(db);save();}
    return;
  }
  report.checks=[];
  const manifest=validateManifest(),migration=manifest.entries[273];
  if(migration.sha256!==(report.previewMigrationSha256??report.migrationSha256)){
    db.sql('BEGIN; SET LOCAL statement_timeout=\'8s\'; '+manifest.sources.get(migration.file)+' COMMIT;');
    report.previewMigrationSha256=migration.sha256;
    report.finalReconstructionRequired=true;save();
  }
  report.equivalenceOracle={source:"historical SELECT with every CTE materialized; no logical expression, predicate, projection or order changed",localPlannerOnly:{enable_nestloop:false,jit:false},reason:"Obtain complete reference rows without the known repeated execution plan; candidate uses default planner and unchanged 8-second timeout."};
  const check=(name,fn)=>{try{fn();}catch(error){error.message=name+': '+error.message;throw error;}report.checks.push({name,status:'passed'});save();};
  if(!report.fixtureExtended){
    db.sql(readFileSync(join(root,'scripts/optimization/inbox-functional-fixture.sql'),'utf8'));
    report.fixtureExtended=true;save();
  }
  if(!report.todayMeasurements){report.todayMeasurements=measure(db);save();}
  if(!report.todayMeasurements.some(x=>x.label==='predicates_materialized_unread_thresholds_today')){
    report.todayMeasurements.push(...measure(db,['predicates_materialized_unread_thresholds_today']));save();
  }
  check('274/274 migration ledger',()=>assert.equal(db.sql('SELECT count(*) FROM supabase_migrations.schema_migrations').trim(),'274'));
  check('new privileged helpers are unexposed and public wrappers are invokers',()=>{
    const rows=json(db,"SELECT jsonb_agg(jsonb_build_object('name',p.proname,'schema',n.nspname,'definer',p.prosecdef,'anonymous',has_function_privilege('anon',p.oid,'EXECUTE'),'authenticated',has_function_privilege('authenticated',p.oid,'EXECUTE'),'searchPath',p.proconfig)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE (n.nspname='inbox_private' AND p.proname IN('thread_messages','thread_summaries')) OR (n.nspname='public' AND p.proname IN('get_whatsapp_cloud_api_inbox_messages','get_whatsapp_cloud_api_inbox_summaries'))");
    assert.equal(rows.length,4);for(const row of rows){assert.equal(row.anonymous,false);assert.equal(row.authenticated,true);assert.equal(row.definer,row.schema==='inbox_private');assert.deepEqual(row.searchPath,['search_path=public, pg_temp']);}
  });
  const cases=[args(),args({p_offset:20}),args({p_offset:260}),args({p_offset:300}),args({p_from:null,p_to:null}),args({p_workspace_currency:'PYG'}),args({p_workspace_currency:null}),args({p_unread_only:true}),...['nuevo','contacto','lead','cargo','recompra','premium'].map(p_tag_filter=>args({p_tag_filter})),args({p_from:'2026-09-19',p_to:'2026-09-20'})];
  const browserCases=[];
  for(const [index,parameters]of cases.entries()) {
    check(`complete historical projection equivalence case ${index+1}`,()=>{
      let original;try{original=json(db,oracleSettings+`WITH r AS (${referenceBound(parameters)}) SELECT coalesce(jsonb_agg(to_jsonb(r)),'[]') FROM r`);}catch(error){error.message='historical reference: '+error.message;throw error;}
      const actual=summaries(db,parameters);
      assert.deepEqual(actual.map(({preview_created_at,preview_meta_message_id,...row})=>row),original.map(({messages,...row})=>row));
      for(const [i,row]of actual.entries()){
        const message=original[i].messages.at(-1);
        assert.equal(row.preview_created_at,message?.created_at??null);
        assert.equal(row.preview_meta_message_id,message?.meta_message_id??'');
      }
      assert(actual.every(row=>!Object.hasOwn(row,'messages')));
      browserCases.push({parameters,rows:actual});
    });
  }
  const first=summaries(db,args());
  check('first page is bounded at 20 and excludes another tenant',()=>{assert.equal(first.length,20);assert(first.every(row=>row.user_id===client));});
  check('second tenant sees only its own rows',()=>{const rows=summaries(db,args(),other);assert.equal(rows.length,1);assert(rows.every(row=>row.user_id===other));});
  check('protected admin role can read both tenants',()=>{const rows=summaries(db,args({p_workspace_currency:null}),admin);assert(rows.some(row=>row.user_id===other));assert(rows.some(row=>row.user_id===client));});
  check('null auth uid exposes no summaries or history',()=>{
    const rows=summaries(db,args(),'');assert.deepEqual(rows,[]);
    assert.deepEqual(detail(db,first[0].contact_id,null,''),{messages:[],next_cursor:null});
  });
  check('foreign contact id cannot read history',()=>assert.deepEqual(detail(db,first[0].contact_id,null,other),{messages:[],next_cursor:null}));
  check('first detail page equals historical latest 50 messages',()=>{
    const old=json(db,oracleSettings+`WITH r AS (${referenceBound(args())}) SELECT messages FROM r WHERE contact_id='${first[0].contact_id}'`);
    assert.deepEqual(detail(db,first[0].contact_id).messages,old);
  });
  check('message cursor next and final page have no gaps or duplicates',()=>{
    const id=first[0].contact_id,one=detail(db,id);assert.equal(one.messages.length,50);assert(one.next_cursor);
    const two=detail(db,id,one.next_cursor);assert.equal(two.messages.length,10);assert.equal(two.next_cursor,null);
    const ids=[...two.messages,...one.messages].map(x=>x.meta_message_id);assert.equal(new Set(ids).size,60);
    const times=[...two.messages,...one.messages].map(x=>x.created_at);assert.deepEqual(times,[...times].sort());
  });
  check('empty conversation has empty detail',()=>assert.deepEqual(detail(db,'74000000-0000-4000-8000-000000000099'),{messages:[],next_cursor:null}));
  check('stable conversation pages including equal activity timestamps',()=>{
    const result=json(db,`UPDATE public.whatsapp_cloud_api_contacts SET last_message_at='2026-09-18T18:00:00Z' WHERE config_id='74000000-0000-4000-8000-000000000010'; WITH pages AS (SELECT r.* FROM generate_series(0,280,20) AS page(offset_value) CROSS JOIN LATERAL public.get_whatsapp_cloud_api_inbox_summaries(20,page.offset_value,'ARS','all',false,'2026-09-18T03:00:00Z','2026-09-19T02:59:59.999Z') r) SELECT jsonb_build_object('rows',count(*),'unique',count(DISTINCT contact_id),'total',max(total_threads)) FROM pages`);
    assert.deepEqual(result,{rows:269,unique:269,total:269});
  });
  check('read state is preserved and calculated per authenticated reader',()=>{
    const result=json(db,`DO $$ BEGIN PERFORM public.mark_whatsapp_cloud_api_thread_read('${first[0].contact_id}'); END $$; SELECT to_jsonb(r) FROM public.get_whatsapp_cloud_api_inbox_summaries(20,0,'ARS','all',false,'2026-09-18T03:00:00Z','2026-09-19T02:59:59.999Z') r WHERE contact_id='${first[0].contact_id}'`,client,'authenticated');
    assert.equal(result.unread_count,0);assert.equal(result.unread_last_message_at,null);
    assert(first[0].unread_count>0);
  });
  check('positive Contacto filter retains redirect-derived state',()=>{
    const result=json(db,`INSERT INTO public.whatsapp_cloud_api_redirects(token,config_id,user_id,contact_id,assignment_id,wa_link,click_count,status) SELECT 'synthetic-inbox-redirect',config_id,user_id,contact_id,id,'https://example.invalid/synthetic',1,'clicked' FROM public.whatsapp_cloud_api_assignments WHERE promo_code='SYNTHETIC-synthetic-5'; SELECT coalesce(jsonb_agg(r),'[]') FROM public.get_whatsapp_cloud_api_inbox_summaries(20,0,'ARS','contacto',false,'2026-09-18T03:00:00Z','2026-09-19T02:59:59.999Z') r`);
    assert.equal(result.length,1);assert.equal(result[0].tag,'contacto');assert.equal(result[0].redirect_click_count,1);
  });
  check('mixed stream timestamp ties paginate with no lost or duplicate messages',()=>{
    const result=json(db,`
      INSERT INTO public.whatsapp_cloud_api_outbound_messages(config_id,user_id,recipient_wa_id,meta_message_id,payload,status,created_at)
      SELECT config_id,user_id,wa_id,'synthetic-tied-out-'||g,jsonb_build_object('text',jsonb_build_object('body','SYNTHETIC-TIE-'||g)),'sent','2026-09-18T18:00:00Z'
      FROM public.whatsapp_cloud_api_contacts CROSS JOIN generate_series(1,120) g WHERE id='${first[0].contact_id}';
      INSERT INTO public.whatsapp_cloud_api_webhook_events(config_id,user_id,event_type,payload,received_at,meta_message_id,status)
      SELECT config_id,user_id,'message',jsonb_build_object('message',jsonb_build_object('from',wa_id,'text',jsonb_build_object('body','SYNTHETIC-TIE-'||g))),'2026-09-18T18:00:00Z','synthetic-tied-in-'||g,'processed'
      FROM public.whatsapp_cloud_api_contacts CROSS JOIN generate_series(1,60) g WHERE id='${first[0].contact_id}';
      WITH RECURSIVE pages(n,data) AS (
        SELECT 1,public.get_whatsapp_cloud_api_inbox_messages('${first[0].contact_id}')
        UNION ALL SELECT n+1,public.get_whatsapp_cloud_api_inbox_messages('${first[0].contact_id}',(data#>>'{next_cursor,at}')::timestamptz,(data#>>'{next_cursor,stream}')::integer,(data#>>'{next_cursor,id}')::uuid)
        FROM pages WHERE data->>'next_cursor' IS NOT NULL AND n<10
      ), messages AS (SELECT n,m FROM pages CROSS JOIN LATERAL jsonb_array_elements(data->'messages') m)
      SELECT jsonb_build_object('pages',max(n),'rows',count(*),'unique',count(DISTINCT m->>'meta_message_id')) FROM messages`);
    assert.deepEqual(result,{pages:5,rows:240,unique:240});
  });
  check('pgTAP access contracts (10 assertions)',()=>{
    const tap=db.sql(readFileSync(join(root,'scripts/optimization/inbox-pgtap.sql'),'utf8'));
    assert(tap.includes('1..10'));assert(!/(?:^|\n)not ok\b/.test(tap));assert.equal((tap.match(/(?:^|\n)ok \d+/g)??[]).length,10);
    report.pgTap={assertions:10,passed:true};
  });
  check('existing authenticated RPC no longer times out',()=>{
    const plan=json(db,`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT * FROM public.get_whatsapp_cloud_api_inbox_threads_page(20,0,'ARS','all',false,'2026-09-18T03:00:00Z','2026-09-19T02:59:59.999Z')`,client,'authenticated');
    report.optimizedExistingRpcMs=plan[0]['Execution Time'];assert(report.optimizedExistingRpcMs<8000);
  });
  const rows=json(db,`SELECT coalesce(jsonb_agg(r),'[]') FROM public.get_whatsapp_cloud_api_inbox_threads_page(20,0,'ARS','all',false,'2026-09-18T03:00:00Z','2026-09-19T02:59:59.999Z') r`,client,'authenticated');
  report.transfers={oldRows:rows.length,oldMessages:rows.reduce((n,r)=>n+r.messages.length,0),oldJsonBytes:Buffer.byteLength(JSON.stringify(rows)),newRows:first.length,newMessages:0,newJsonBytes:Buffer.byteLength(JSON.stringify(first)),selectedMessageRows:detail(db,first[0].contact_id).messages.length};
  const browserFixture=join(mkdtempSync(join(tmpdir(),'inbox-synthetic-browser-')),'input.json');
  writeFileSync(browserFixture,JSON.stringify({before:rows,after:first,cases:browserCases,detail:detail(db,first[0].contact_id),older:detail(db,first[0].contact_id,detail(db,first[0].contact_id).next_cursor)},null,2)+'\n');
  console.log('INBOX_BROWSER_FIXTURE '+browserFixture);
  const api=await profileDataApi(db);
  try {
    check('Data API authenticated summary projection',()=>{const r=api.request('authenticated',client,'POST','rpc/get_whatsapp_cloud_api_inbox_summaries',args());assert.equal(r.status,200);assert.deepEqual(r.body,first);});
    check('Data API selected history and cursor',()=>{const r=api.request('authenticated',client,'POST','rpc/get_whatsapp_cloud_api_inbox_messages',{p_contact_id:first[0].contact_id});assert.equal(r.status,200);assert.equal(r.body.messages.length,50);assert(r.body.next_cursor);});
    check('Data API anonymous cannot list or read messages',()=>{for(const [rpc,body]of [['get_whatsapp_cloud_api_inbox_summaries',args()],['get_whatsapp_cloud_api_inbox_messages',{p_contact_id:first[0].contact_id}]]){const r=api.request('anon',undefined,'POST','rpc/'+rpc,body);assert([401,403].includes(r.status));assert.equal(r.body.code,'42501');}});
    check('Data API cannot inject tenant identity',()=>{const r=api.request('authenticated',other,'POST','rpc/get_whatsapp_cloud_api_inbox_summaries',{...args(),p_user_id:client});assert.equal(r.status,404);assert.equal(r.body.code,'PGRST202');});
    check('Data API foreign selected contact returns no messages',()=>{const r=api.request('authenticated',other,'POST','rpc/get_whatsapp_cloud_api_inbox_messages',{p_contact_id:first[0].contact_id});assert.equal(r.status,200);assert.deepEqual(r.body,{messages:[],next_cursor:null});});
    report.dataApi={image:api.image,localOnly:true,publishedPorts:api.publishedPorts};
  }finally{report.dataApiCleanup=api.close();save();}
  report.rpcMeasurements=measureCurrentReads(db);save();
}
