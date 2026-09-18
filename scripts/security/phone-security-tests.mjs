import assert from 'node:assert/strict';
import {fixture as users,ids} from './profile-security-tests.mjs';

export {ids};
export const landing='73000000-0000-4000-8000-000000000001';
export const phoneFixture=`${users}
INSERT INTO public.gerencias(id,user_id,nombre,gerencia_id,source_type,fair_criterion) VALUES
 (7301,'${ids.client}','synthetic-own',7301,'pbadmin','messages_received'),
 (7302,'${ids.other}','synthetic-other',7302,'pbadmin','messages_received'),
 (7303,'${ids.client}','synthetic-own-second',7303,'pbadmin','messages_received');
INSERT INTO public.gerencia_phones(id,gerencia_id,phone,kind,usage_count) VALUES
 (730101,7301,'000001','carga',10),(730102,7302,'000002','carga',20),(730103,7303,'000003','carga',10);
INSERT INTO public.landings(id,user_id,name,gerencia_selection_mode,gerencia_fair_criterion)
 VALUES ('${landing}','${ids.client}','phase1b3-synthetic','fair','messages_received');
INSERT INTO public.landings_gerencias(landing_id,gerencia_id,weight,phone_mode,phone_kind)
 VALUES ('${landing}',7301,1,'fair','carga'),('${landing}',7303,1,'fair','carga');
INSERT INTO public.phone_metrics(gerencia_phone_id,user_id,gerencia_id,messages_received)
 VALUES(730101,'${ids.client}',7301,4),(730102,'${ids.other}',7302,8);
INSERT INTO public.phone_assignment_scope_metrics(user_id,scope_type,scope_id,gerencia_id,phone_id,usage_count)
 VALUES('${ids.client}','landing','${landing}',7301,730101,10);
`;
export const cleanupPhones=db=>db.sql(`DELETE FROM auth.users WHERE id IN ('${ids.client}','${ids.other}','${ids.admin}');`);
export const subject=(id=ids.client)=>`SELECT set_config('request.jwt.claim.sub','${id}',true);
 SELECT set_config('request.jwt.claims','{"sub":"${id}","role":"authenticated","user_metadata":{"role":"admin"}}',true);`;
const last=s=>s.trim().split(/\r?\n/).at(-1);
const transaction=(sql,id=ids.client,role='authenticated')=>`BEGIN; SET LOCAL statement_timeout='10s'; ${phoneFixture} ${subject(id)} SET LOCAL ROLE ${role}; ${sql}; ROLLBACK;`;

export function phoneSqlTests(db,check) {
  const bool=(name,sql)=>check(name,()=>assert.equal(last(db.sql(sql)),'t'));
  const denied=(name,sql,id=ids.client,role='authenticated')=>check(name,()=>{
    let state=null;try{db.sql(transaction(sql,id,role));}catch(e){state=e.sqlstate;}
    assert.equal(state,'42501');
  });
  bool('SQL client sees own phones even when local/external gerencia ids coincide',transaction('SELECT array_agg(id ORDER BY id)=ARRAY[730101,730103]::bigint[] FROM public.gerencia_phones'));
  bool('SQL client creates own phone',transaction("INSERT INTO public.gerencia_phones(gerencia_id,phone,kind) VALUES(7301,'000004','carga'); SELECT count(*)=3 FROM public.gerencia_phones"));
  bool('SQL client edits and deletes own phone',transaction("UPDATE public.gerencia_phones SET comment='synthetic-edited' WHERE id=730101; DELETE FROM public.gerencia_phones WHERE id=730103; SELECT count(*)=1 AND bool_and(comment='synthetic-edited') FROM public.gerencia_phones"));
  bool('SQL own upsert conflict key stays compatible',transaction("INSERT INTO public.gerencia_phones(gerencia_id,phone,kind,comment,last_seen_at) VALUES(7301,'000001','carga','synthetic-upsert',now()) ON CONFLICT(gerencia_id,phone) DO UPDATE SET gerencia_id=excluded.gerencia_id,comment=excluded.comment,last_seen_at=excluded.last_seen_at; SELECT comment='synthetic-upsert' FROM public.gerencia_phones WHERE id=730101"));
  denied('SQL cannot create foreign phone',"INSERT INTO public.gerencia_phones(gerencia_id,phone) VALUES(7302,'000004')");
  for(const operation of ['UPDATE public.gerencia_phones SET comment=\'forbidden\'','DELETE FROM public.gerencia_phones'])bool(`SQL foreign ${operation.startsWith('UPDATE')?'update':'delete'} affects zero`,transaction(`WITH changed AS (${operation} WHERE id=730102 RETURNING id) SELECT count(*)=0 FROM changed`));
  denied('SQL mixed phone owner reassignment denied',"UPDATE public.gerencia_phones SET comment='forbidden',gerencia_id=7302 WHERE id=730101");
  denied('SQL same-owner gerencia reassignment denied',"UPDATE public.gerencia_phones SET gerencia_id=7303 WHERE id=730101");
  denied('SQL gerencia owner reassignment denied',`UPDATE public.gerencias SET user_id='${ids.other}',nombre='forbidden' WHERE id=7301`);
  denied('SQL cannot create gerencia for other client',`INSERT INTO public.gerencias(id,user_id,nombre,gerencia_id) VALUES(7399,'${ids.other}','forbidden',7399)`);
  for(const sql of ['SELECT * FROM public.gerencia_phones',"INSERT INTO public.gerencia_phones(gerencia_id,phone) VALUES(7301,'000004')","UPDATE public.gerencia_phones SET comment='forbidden' WHERE id=730101",'DELETE FROM public.gerencia_phones WHERE id=730101'])denied('SQL anon denied '+sql.split(' ')[0],sql,ids.client,'anon');
  bool('SQL admin reads all phones',transaction('SELECT count(*)=3 FROM public.gerencia_phones',ids.admin));
  bool('SQL admin manages phone for another client',transaction("INSERT INTO public.gerencia_phones(gerencia_id,phone) VALUES(7302,'000004'); UPDATE public.gerencia_phones SET comment='admin-edited' WHERE gerencia_id=7302; DELETE FROM public.gerencia_phones WHERE phone='000004'; SELECT comment='admin-edited' FROM public.gerencia_phones WHERE id=730102",ids.admin));
  denied('SQL admin cannot reassign existing phone',"UPDATE public.gerencia_phones SET gerencia_id=7302 WHERE id=730101",ids.admin);
  denied('SQL admin cannot reassign existing gerencia',`UPDATE public.gerencias SET user_id='${ids.other}' WHERE id=7301`,ids.admin);
  bool('SQL forged metadata retains client role and isolation',transaction(`SELECT (SELECT role='client' FROM public.profiles WHERE id='${ids.client}') AND NOT EXISTS(SELECT FROM public.gerencia_phones WHERE id=730102)`));
  bool('SQL backend reads and updates operational fields',transaction('UPDATE public.gerencia_phones SET usage_count=0,messages_reset_at=now() WHERE id=730102; SELECT usage_count=0 AND messages_reset_at IS NOT NULL FROM public.gerencia_phones WHERE id=730102',ids.client,'service_role'));
  for(const role of ['anon','authenticated'])for(const column of ['id','usage_count','created_at','updated_at','messages_reset_at'])for(const privilege of ['INSERT','UPDATE'])bool(`grant ${role} ${privilege} ${column} denied`,`SELECT NOT has_column_privilege('${role}','public.gerencia_phones','${column}','${privilege}')`);
  for(const op of ['SELECT','INSERT','UPDATE','DELETE'])bool('RLS phone '+op+' targets authenticated',`SELECT roles=array['authenticated']::name[] AND ${op==='INSERT'?'with_check IS NOT NULL':op==='UPDATE'?'qual IS NOT NULL AND with_check IS NOT NULL':'qual IS NOT NULL'} FROM pg_policies WHERE schemaname='public' AND tablename='gerencia_phones' AND cmd='${op}'`);
  for(const name of ['prevent_phone_owner_reassignment','prevent_gerencia_owner_reassignment'])bool('private invoker guard '+name,`SELECT NOT prosecdef AND proconfig=array['search_path=""']::text[] AND NOT has_function_privilege('anon',oid,'EXECUTE') AND NOT has_function_privilege('authenticated',oid,'EXECUTE') FROM pg_proc WHERE oid='private.${name}()'::regprocedure`);
}

export function phoneDataApiTests(db,api,check) {
  db.sql(phoneFixture);
  const req=(id,method,path,body)=>api.request('authenticated',id,method,path,body);
  const adminRead=()=>req(ids.admin,'GET','gerencia_phones?order=id&select=*').body;
  const denied=result=>{assert.ok([401,403].includes(result.status));assert.equal(result.body.code,'42501');};
  try {
    check('Data API client lists only own phones',()=>{const r=req(ids.client,'GET','gerencia_phones?order=id&select=id');assert.equal(r.status,200);assert.deepEqual(r.body.map(x=>x.id),[730101,730103]);});
    check('Data API client cannot read foreign filter',()=>{const r=req(ids.client,'GET','gerencia_phones?id=eq.730102&select=*');assert.equal(r.status,200);assert.deepEqual(r.body,[]);});
    check('Data API spoofed owner URL filter returns no foreign gerencia',()=>assert.deepEqual(req(ids.client,'GET',`gerencias?user_id=eq.${ids.other}&select=id`).body,[]));
    check('Data API own manual insert and upsert contract',()=>{
      const row={gerencia_id:7301,phone:'000004',status:'active',source_available:true,kind:'carga',assignment_role:'acquisition',comment:'synthetic',last_seen_at:'2000-01-01T00:00:00Z'};
      for(let i=0;i<2;i++){const r=api.request('authenticated',ids.client,'POST','gerencia_phones?on_conflict=gerencia_id,phone',row,'resolution=merge-duplicates,return=representation');assert.equal(r.status,i===0?201:200,i===0?'insert returns 201':'existing-row upsert returns 200');assert.equal(r.body[0].phone,'000004');}
      const edited=req(ids.client,'PATCH','gerencia_phones?phone=eq.000004',{comment:'edited'});assert.equal(edited.status,200);assert.equal(edited.body[0].comment,'edited');
      assert.equal(req(ids.client,'DELETE','gerencia_phones?phone=eq.000004').body.length,1);
    });
    check('Data API foreign insert denied',()=>denied(req(ids.client,'POST','gerencia_phones',{gerencia_id:7302,phone:'000004'})));
    for(const method of ['PATCH','DELETE'])check('Data API foreign '+method+' changes nothing',()=>{const before=adminRead();const r=req(ids.client,method,'gerencia_phones?id=eq.730102',method==='PATCH'?{comment:'forbidden'}:undefined);assert.equal(r.status,200);assert.deepEqual(r.body,[]);assert.deepEqual(adminRead(),before);});
    for(const id of [ids.client,ids.admin])check('Data API atomic owner reassignment '+(id===ids.client?'client':'admin'),()=>{
      const before=adminRead();denied(req(id,'PATCH','gerencia_phones?id=eq.730101',{comment:'forbidden',gerencia_id:7302}));assert.deepEqual(adminRead(),before);
    });
    check('Data API mixed own/foreign insert is atomic',()=>{const before=adminRead();denied(req(ids.client,'POST','gerencia_phones',[{gerencia_id:7301,phone:'000005'},{gerencia_id:7302,phone:'000006'}]));assert.deepEqual(adminRead(),before);});
    check('Data API gerencia owner mixed payload is atomic',()=>{const before=req(ids.admin,'GET','gerencias?id=eq.7301&select=*').body;denied(req(ids.client,'PATCH','gerencias?id=eq.7301',{user_id:ids.other,nombre:'forbidden'}));assert.deepEqual(req(ids.admin,'GET','gerencias?id=eq.7301&select=*').body,before);});
    for(const method of ['GET','POST','PATCH','DELETE'])check('Data API anon '+method+' denied',()=>denied(api.request('anon',undefined,method,'gerencia_phones?id=eq.730101',method==='POST'?{gerencia_id:7301,phone:'000004'}:method==='PATCH'?{comment:'forbidden'}:undefined)));
    check('Data API admin CRUD for another client',()=>{let r=req(ids.admin,'POST','gerencia_phones',{gerencia_id:7302,phone:'000007'});assert.equal(r.status,201);const id=r.body[0].id;r=req(ids.admin,'PATCH',`gerencia_phones?id=eq.${id}`,{comment:'admin'});assert.equal(r.body[0].comment,'admin');assert.equal(req(ids.admin,'DELETE',`gerencia_phones?id=eq.${id}`).body.length,1);});
    check('Data API service backend still updates operational counters',()=>{const r=api.request('service_role',undefined,'PATCH','gerencia_phones?id=eq.730102',{usage_count:0});assert.equal(r.status,200);assert.equal(r.body[0].usage_count,0);});
    for(const fn of ['cron_sync_phones_all','cron_reset_phone_operational_daily'])for(const role of ['anon','authenticated'])check('Data API '+role+' RPC '+fn+' denied without partial effects',()=>{
      const before=adminRead(),beforeConfig=db.sql("SELECT md5(coalesce(jsonb_agg(to_jsonb(c) ORDER BY user_id)::text,'[]')) FROM public.conversions_config c"),beforeQueue=db.sql('SELECT count(*) FROM net.http_request_queue');
      const r=api.request(role,role==='authenticated'?ids.client:undefined,'POST','rpc/'+fn,{});
      assert.ok([401,403,404].includes(r.status));assert.ok(['42501','PGRST202'].includes(r.body.code));
      assert.deepEqual(adminRead(),before);assert.equal(db.sql("SELECT md5(coalesce(jsonb_agg(to_jsonb(c) ORDER BY user_id)::text,'[]')) FROM public.conversions_config c"),beforeConfig);assert.equal(db.sql('SELECT count(*) FROM net.http_request_queue'),beforeQueue);
    });
  } finally {cleanupPhones(db);}
}

// All cron calls are in a transaction that rolls back. pg_net cannot observe
// uncommitted queue rows; the database also has no outbound network and jobs off.
export function cronBehavior(db) {
  const sync=JSON.parse(last(db.sql(`BEGIN; SET LOCAL statement_timeout='10s';
    INSERT INTO public.cron_config(key,value) VALUES ('sync_phones_url','http://127.0.0.1:1/phase1b3-disabled'),('sync_phones_cron_secret','phase1b3-synthetic-cron') ON CONFLICT(key) DO UPDATE SET value=excluded.value;
    SELECT public.cron_sync_phones_all();
    SELECT jsonb_build_object('queued',(SELECT count(*) FROM net.http_request_queue),'localOnly',(SELECT bool_and(url='http://127.0.0.1:1/phase1b3-disabled') FROM net.http_request_queue),'bodyMatches',(SELECT bool_and(convert_from(body,'UTF8')::jsonb=jsonb_build_object('cron_secret','phase1b3-synthetic-cron')) FROM net.http_request_queue),'responses',(SELECT count(*) FROM net._http_response)); ROLLBACK;`)));
  const reset=JSON.parse(last(db.sql(`BEGIN; ${phoneFixture}
    INSERT INTO public.conversions_config(user_id,phone_auto_reset_daily,phone_auto_reset_last_date) VALUES('${ids.client}',true,null),('${ids.other}',false,null) ON CONFLICT(user_id) DO UPDATE SET phone_auto_reset_daily=excluded.phone_auto_reset_daily,phone_auto_reset_last_date=null;
    SELECT public.cron_reset_phone_operational_daily();
    SELECT jsonb_build_object('ownCountersReset',(SELECT bool_and(usage_count=0 AND messages_reset_at IS NOT NULL) FROM public.gerencia_phones WHERE gerencia_id IN (7301,7303)),'otherUntouched',(SELECT usage_count=20 AND messages_reset_at IS NULL FROM public.gerencia_phones WHERE id=730102),'scopeReset',(SELECT usage_count=0 FROM public.phone_assignment_scope_metrics WHERE phone_id=730101),'dayMarked',(SELECT phone_auto_reset_last_date=(now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date FROM public.conversions_config WHERE user_id='${ids.client}'));
    ROLLBACK;`)));
  assert.deepEqual(sync,{queued:1,localOnly:true,bodyMatches:true,responses:0});
  assert.deepEqual(reset,{ownCountersReset:true,otherUntouched:true,scopeReset:true,dayMarked:true});
  assert.equal(last(db.sql('SELECT NOT EXISTS(SELECT FROM net.http_request_queue) AND NOT EXISTS(SELECT FROM net._http_response)')),'t');
  return {sync,reset,rolledBack:true,externalRequests:0};
}
