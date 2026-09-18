import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {root} from '../phase0/local-runtime.mjs';
import {fixture as users,ids} from './profile-security-tests.mjs';

export {ids};
export const scope=JSON.parse(readFileSync(join(root,'docs/security/phase-1b4/scope.json')));
export const landing='74000000-0000-4000-8000-000000000001';
const atrio='74000000-0000-4000-8000-000000000002',promotion='74000000-0000-4000-8000-000000000003';
export const fixture=`${users}
INSERT INTO public.client_subscriptions(user_id,max_landings) VALUES ('${ids.client}',2);
INSERT INTO public.landings(id,user_id,name,landing_tag) VALUES ('${landing}','${ids.client}','phase1b4-client-a','phase1b4tag');
INSERT INTO public.landings(user_id,name) VALUES ('${ids.client}','phase1b4-client-b'),('${ids.other}','phase1b4-other');
INSERT INTO public.atrio_clients(id,user_id,slug,atrio_id) VALUES ('${atrio}','${ids.client}','phase1b4-atrio','synthetic-atrio');
INSERT INTO public.promotions(id,user_id,title,slug,draw_at) VALUES ('${promotion}','${ids.client}','Synthetic promotion','phase1b4-promotion','2099-01-01');
INSERT INTO public.notification_bot_config(id,telegram_bot_username) VALUES (1,'phase1b4_synthetic_bot') ON CONFLICT(id) DO UPDATE SET telegram_bot_username=excluded.telegram_bot_username;
`;
export const identity=(role='authenticated',id=ids.client)=>`SELECT set_config('request.jwt.claim.sub','${id??''}',true); SELECT set_config('request.jwt.claims','${JSON.stringify({role,...(id?{sub:id}:{}),user_metadata:{role:'admin'}})}',true); SET LOCAL ROLE ${role};`;
const last=s=>s.trim().split(/\r?\n/).at(-1);
const tx=sql=>`BEGIN; SET LOCAL statement_timeout='15s'; ${fixture} ${sql} ROLLBACK;`;
const json=(db,sql)=>JSON.parse(last(db.sql(sql)));
const bool=(db,sql)=>assert.equal(last(db.sql(sql)),'t');
export const authGuard="  if v_auth_uid is null then\n    raise exception 'Authentication required' using errcode = '42501';\n  end if;\n\n";

// Before/after comparison exercises the real unchanged consumers, using only
// local synthetic rows. Timestamp comparisons are predicates, not wall times.
export function historicalBehavior(db) {
  const result={};
  for(const [label,role,id,target] of [['client','authenticated',ids.client,ids.client],['admin','authenticated',ids.admin,ids.client],['backend','service_role',ids.client,ids.client]]) {
    result['stats-'+label]=json(db,tx(`${identity(role,id)} SELECT public.get_home_overview_stats('${target}',null);`));
    assert.equal(result['stats-'+label].landings_count,2);
  }
  result.quota=json(db,tx(`${identity()} SELECT row_to_json(q) FROM public.consume_ai_assistant_quota(3) q;`));
  result.notificationUsername=last(db.sql(tx(`${identity()} SELECT public.get_notification_bot_username();`)));
  assert.equal(result.notificationUsername,'phase1b4_synthetic_bot');
  result.publicRouting=json(db,tx(`${identity('anon',null)} SELECT coalesce(jsonb_agg(to_jsonb(r)),'[]') FROM public.get_public_landing_routing() r;`));
  result.publicPhone=json(db,tx(`${identity('anon',null)} SELECT public.get_phone_for_landing('phase1b4-client-a');`));
  result.cron=json(db,tx(`
    INSERT INTO public.cron_config(key,value) VALUES ('sync_phones_url','http://127.0.0.1:1/functions/v1/synthetic-disabled'),('sync_phones_cron_secret','phase1b4-synthetic-only') ON CONFLICT(key) DO UPDATE SET value=excluded.value;
    SELECT public.cron_process_due_promotions();
    SELECT jsonb_agg(jsonb_build_object('url',url,'method',method,'body',convert_from(body,'UTF8')::jsonb,'headers',headers,'timeout',timeout_milliseconds)) FROM net.http_request_queue;
  `));
  assert.equal(result.cron.length,1);assert.equal(result.cron[0].url,'http://127.0.0.1:1/functions/v1/promotion-draw-due');
  result.triggerDml=json(db,tx(`${identity()}
    UPDATE public.landings SET comment='synthetic-edited',updated_at='2000-01-01' WHERE id='${landing}';
    UPDATE public.atrio_clients SET slug='phase1b4-edited',updated_at='2000-01-01' WHERE id='${atrio}';
    INSERT INTO public.landings_atrio_clients(landing_id,atrio_client_id,user_id,weight) VALUES ('${landing}','${atrio}','${ids.client}',-2);
    UPDATE public.promotions SET title='Synthetic edited',updated_at='2000-01-01' WHERE id='${promotion}';
    DO $$ BEGIN
      BEGIN INSERT INTO public.landings(user_id,name) VALUES ('${ids.client}','phase1b4-over-limit'); RAISE EXCEPTION 'guard missing' USING ERRCODE='XX000'; EXCEPTION WHEN SQLSTATE 'P0001' THEN IF SQLERRM<>'PLAN_LIMIT_LANDINGS' THEN RAISE; END IF; END;
      BEGIN UPDATE public.landings SET name='phase1b4-forbidden' WHERE id='${landing}'; RAISE EXCEPTION 'guard missing' USING ERRCODE='XX000'; EXCEPTION WHEN SQLSTATE 'P0001' THEN IF SQLERRM<>'Landing name is immutable once set' THEN RAISE; END IF; END;
      BEGIN UPDATE public.landings SET landing_tag='phase1b4forbidden' WHERE id='${landing}'; RAISE EXCEPTION 'guard missing' USING ERRCODE='XX000'; EXCEPTION WHEN SQLSTATE 'P0001' THEN IF SQLERRM<>'Landing tag is immutable once set' THEN RAISE; END IF; END;
    END $$;
    ${identity('authenticated',ids.admin)}
    UPDATE public.client_subscriptions SET updated_at='2000-01-01' WHERE user_id='${ids.client}';
    SELECT jsonb_build_object('landing',(SELECT name='phase1b4-client-a' AND landing_tag='phase1b4tag' AND comment='synthetic-edited' AND updated_at>'2000-01-02' FROM public.landings WHERE id='${landing}'),
      'atrio',(SELECT slug='phase1b4-edited' AND updated_at>'2000-01-02' FROM public.atrio_clients WHERE id='${atrio}'),
      'assignment',(SELECT user_id='${ids.client}' AND weight=0 FROM public.landings_atrio_clients WHERE landing_id='${landing}'),
      'promotion',(SELECT title='Synthetic edited' AND updated_at>'2000-01-02' FROM public.promotions WHERE id='${promotion}'),
      'subscription',(SELECT updated_at>'2000-01-02' FROM public.client_subscriptions WHERE user_id='${ids.client}'));
  `));
  assert.ok(Object.values(result.triggerDml).every(x=>x===true));
  return result;
}

export function sqlTests(db,check,report) {
  for(const table of scope.truncateTables)for(const role of ['anon','authenticated'])check(`TRUNCATE ${role} ${table} denied with 42501`,()=>{
    bool(db,`SELECT NOT has_table_privilege('${role}','public.${table}','TRUNCATE');`);
    let code;try{db.sql(`BEGIN; SET LOCAL ROLE ${role}; TRUNCATE TABLE public.${table} CASCADE; ROLLBACK;`);}catch(error){code=error.sqlstate;}assert.equal(code,'42501');
  });
  check('PUBLIC has no TRUNCATE ACL on target tables',()=>bool(db,`SELECT NOT EXISTS(SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE n.nspname='public' AND c.relname IN (${scope.truncateTables.map(x=>"'"+x+"'").join(',')}) AND a.grantee=0 AND a.privilege_type='TRUNCATE');`));
  check('postgres TRUNCATE maintenance removes synthetic rows and rolls back',()=>{
    const before=db.sql('SELECT count(*) FROM public.landings;');
    bool(db,tx(`TRUNCATE TABLE ${scope.truncateTables.map(x=>'public.'+x).join(',')} CASCADE; SELECT NOT EXISTS(SELECT FROM public.landings);`));
    assert.equal(db.sql('SELECT count(*) FROM public.landings;'),before);
  });
  for(const role of ['anon','authenticated','service_role','postgres'])check(`legacy stats null subject rejected before operations for ${role}`,()=>{
    let code;try{db.sql(tx(`${identity(role,null)} SELECT public.get_home_overview_stats('${ids.client}',null);`));}catch(error){code=error.sqlstate;}assert.equal(code,'42501');
  });
  check('legacy stats forged metadata cannot authorize another tenant',()=>{
    let code;try{db.sql(tx(`${identity('authenticated',ids.other)} SELECT public.get_home_overview_stats('${ids.client}',null);`));}catch(error){code=error.sqlstate;}assert.equal(code,'P0001');
  });
  check('pgTAP directed privilege checks',()=>{
    const sql=readFileSync(join(root,'supabase/tests/internal_privileges.test.sql'),'utf8');
    const out=db.sql(`BEGIN; CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions; SET LOCAL search_path=public,extensions; ${sql} ROLLBACK;`);
    const successes=out.split(/\r?\n/).filter(x=>/^ok \d+/.test(x));assert.equal(successes.length,8);assert.ok(!/^not ok/m.test(out));report.pgTap={passed:8,failed:0,countedInsideOneCheck:true};
  });
}

export function dataApiTests(db,api,check,report,before) {
  db.sql(fixture);
  const request=(role,id,method,path,body)=>{
    const r=api.request(role,id,method,path,body);
    report.http.push({role,subject:id??null,method,endpoint:path,status:r.status,code:typeof r.body?.code==='string'?r.body.code:null});return r;
  };
  const denied=r=>{assert.ok([401,403,404].includes(r.status));assert.ok(['42501','PGRST202'].includes(r.body?.code));};
  try{
    for(const f of scope.functions)for(const role of f.remove.filter(x=>x!=='PUBLIC'))check(`Data API ${role} cannot execute ${f.name}`,()=>{
      const body=f.name==='get_home_overview_stats'?{p_user_id:ids.client,p_hidden_by:null}:f.name==='consume_ai_assistant_quota'?{p_limit:3}:{};
      denied(request(role,role==='authenticated'?ids.client:undefined,'POST','rpc/'+f.name,body));
    });
    check('denied cron RPC has no queue effects',()=>bool(db,'SELECT NOT EXISTS(SELECT FROM net.http_request_queue) AND NOT EXISTS(SELECT FROM net._http_response);'));
    for(const role of ['authenticated','service_role'])check('Data API legacy stats rejects null subject '+role,()=>denied(request(role,undefined,'POST','rpc/get_home_overview_stats',{p_user_id:ids.client,p_hidden_by:null})));
    for(const [label,role,id] of [['client','authenticated',ids.client],['admin','authenticated',ids.admin],['backend','service_role',ids.client]])check('Data API legacy stats historical authorized result '+label,()=>{
      const r=request(role,id,'POST','rpc/get_home_overview_stats',{p_user_id:ids.client,p_hidden_by:null});assert.equal(r.status,200);assert.deepEqual(r.body,before['stats-'+label]);
    });
    check('Data API stats cannot select another tenant',()=>{const r=request('authenticated',ids.other,'POST','rpc/get_home_overview_stats',{p_user_id:ids.client});assert.equal(r.status,400);assert.equal(r.body.code,'P0001');});
    for(const role of ['anon','authenticated'])for(const method of ['GET','POST','PATCH','DELETE'])check(`Data API cron_config ${role} ${method} denied`,()=>denied(request(role,role==='authenticated'?ids.client:undefined,method,'cron_config?key=eq.phase1b4-synthetic',method==='POST'?{key:'phase1b4-synthetic',value:'synthetic'}:method==='PATCH'?{value:'forbidden'}:undefined)));
    check('Data API legitimate backend cron_config CRUD remains functional',()=>{
      for(const [method,body,status] of [['POST',{key:'phase1b4-synthetic',value:'synthetic'},201],['GET',undefined,200],['PATCH',{value:'synthetic-edited'},200],['DELETE',undefined,200]]){const r=request('service_role',undefined,method,'cron_config?key=eq.phase1b4-synthetic',body);assert.equal(r.status,status);assert.equal(r.body.length,1);}
    });
    check('Data API authenticated quota result unchanged',()=>{const r=request('authenticated',ids.client,'POST','rpc/consume_ai_assistant_quota',{p_limit:3});assert.equal(r.status,200);assert.deepEqual(r.body,[before.quota]);});
    check('Data API authenticated notification username unchanged',()=>{const r=request('authenticated',ids.client,'POST','rpc/get_notification_bot_username',{});assert.equal(r.status,200);assert.equal(r.body,before.notificationUsername);});
    check('Data API public landing routing unchanged',()=>{const r=request('anon',undefined,'POST','rpc/get_public_landing_routing',{});assert.equal(r.status,200);assert.deepEqual(r.body,before.publicRouting);});
    check('Data API public landing-phone legacy contract unchanged',()=>{const r=request('anon',undefined,'POST','rpc/get_phone_for_landing',{p_landing_name:'phase1b4-client-a'});assert.equal(r.status,200);assert.deepEqual(r.body,before.publicPhone);});
  }finally{
    db.sql(`DELETE FROM public.cron_config WHERE key='phase1b4-synthetic'; DELETE FROM public.profiles WHERE id IN ('${ids.client}','${ids.other}','${ids.admin}'); DELETE FROM auth.users WHERE id IN ('${ids.client}','${ids.other}','${ids.admin}'); UPDATE public.notification_bot_config SET telegram_bot_username='' WHERE id=1 AND telegram_bot_username='phase1b4_synthetic_bot';`);
  }
}
