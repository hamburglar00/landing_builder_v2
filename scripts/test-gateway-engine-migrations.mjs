// In-memory PostgreSQL only. No database URL or production data is accepted.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=resolve(import.meta.dirname,'..');
const modulePath=process.argv.find(arg=>arg.startsWith('--pglite-module='))?.slice(16);
const nexoRoot=process.argv.find(arg=>arg.startsWith('--nexo-root='))?.slice(12);
if(!modulePath||!nexoRoot)throw Error('Supply local --pglite-module and --nexo-root');
const {PGlite}=await import(pathToFileURL(resolve(modulePath)).href);
const db=new PGlite();let passed=0;
const run=async(name,fn)=>{await fn();passed++;console.log('PASS '+name);};
try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create table landings(name text unique,publish_target text,landing_type text,config jsonb);`);
 await db.exec(readFileSync(resolve(root,'supabase/migrations/20261115013415_gateway_landing_publish_target.sql'),'utf8'));
 await run('Gateway publication is opt-in, T7/T9 Atrio only; reserved namespace rejected',async()=>{
  const save=(name,target,type,config)=>db.query('insert into landings values($1,$2,$3,$4)',[name,target,type,config]);
  await save('old','classic','external',{});await save('constructor','constructor','internal',{template:'template8'});
  for(const template of ['template7','template9'])await save(template,'gateway','internal',{template,ctaDestination:'atrio'});
  for(const [name,type,config]of [['nexobet','internal',{template:'template9',ctaDestination:'atrio'}],['NeXoBeT','internal',{template:'template9',ctaDestination:'atrio'}],['external','external',{template:'template9',ctaDestination:'atrio'}],['t8','internal',{template:'template8',ctaDestination:'atrio'}],['wa','internal',{template:'template9',ctaDestination:'whatsapp'}],['provider','internal',{template:'template9',ctaDestination:'atrio',targetProvider:'unknown'}]])await assert.rejects(save(name,'gateway',type,config));
  assert.equal((await db.query('select count(*)::int n from landings')).rows[0].n,4);
 });
 await db.exec(`alter table landings add column id uuid default gen_random_uuid(), add column user_id uuid default gen_random_uuid(), add column landing_config jsonb default '{}'::jsonb, add column pixel_id text default '';
  create table fixture_blocked(user_id uuid primary key);
  create function public.is_client_access_blocked(p_user_id uuid) returns boolean language sql stable as $$select exists(select 1 from public.fixture_blocked where user_id=p_user_id)$$;
  grant select on landings,fixture_blocked to service_role;
  alter table landings enable row level security;
  create policy service_read on landings for select to service_role using(true);`);
 await db.exec(readFileSync(resolve(root,'supabase/migrations/20261115013424_gateway_landing_context.sql'),'utf8'));
 await run('Gateway context combines the original row/block checks with service-only invoker permissions',async()=>{
  const expected=(await db.query(`select jsonb_build_object('id',l.id,'user_id',l.user_id,'name',l.name,'landing_type',l.landing_type,'publish_target',l.publish_target,'config',l.config,'landing_config',l.landing_config,'pixel_id',l.pixel_id) value from landings l where name='template9' and not public.is_client_access_blocked(user_id)`)).rows[0].value;
  await db.exec('set role service_role');
  assert.deepEqual((await db.query("select public.gateway_landing_context('template9') value")).rows[0].value,expected);
  assert.equal((await db.query("select public.gateway_landing_context('old') value")).rows[0].value,null);
  assert.equal((await db.query("select public.gateway_landing_context('missing') value")).rows[0].value,null);
  await db.exec('reset role');
  await db.exec("insert into fixture_blocked select user_id from landings where name='template9'");
  assert.equal((await db.query("select public.gateway_landing_context('template9') value")).rows[0].value,null);
  for(const role of ['anon','authenticated']) {
   assert.equal((await db.query(`select has_function_privilege('${role}','public.gateway_landing_context(text)','execute') ok`)).rows[0].ok,false);
   await db.exec(`set role ${role}`);
   await assert.rejects(db.query("select public.gateway_landing_context('template7')"));
   await db.exec('reset role');
  }
  assert.equal((await db.query("select prosecdef from pg_proc where oid='public.gateway_landing_context(text)'::regprocedure")).rows[0].prosecdef,false);
 });
 for(const product of ['builder','nexobet']){
  const nx=product==='nexobet',prefix=nx?'nx_':'',fn=prefix+'record_entry_funnel_events',table=prefix+'entry_funnel_events';
  const latest=readFileSync(nx?resolve(nexoRoot,'supabase/migrations/20261114035710_nexobet_builder_ui_template8.sql'):resolve(root,'supabase/migrations/20261110163119_entry_funnel_navigation_delivery_observability.sql'),'utf8');
  const rpc=latest.match(new RegExp('create or replace function public\\.'+fn+'\\([\\s\\S]+?\\$\\$;','i'))?.[0];
  assert.ok(rpc,'actual current collector SQL must be present');
  await db.exec(`create table ${table}(engine text constraint ${table}_engine_check check(engine ${nx?"='nexobet'":"in ('classic','constructor','nexobet')"}));${rpc} revoke all on function public.${fn}(uuid,uuid,integer,jsonb) from public,anon,authenticated;grant execute on function public.${fn}(uuid,uuid,integer,jsonb) to service_role;`);
  const definition=async()=>(await db.query(`select pg_get_functiondef('public.${fn}(uuid,uuid,integer,jsonb)'::regprocedure) body`)).rows[0].body;
  const before=await definition();
  const file=nx?resolve(nexoRoot,'supabase/migrations/20261115013430_nexobet_gateway_entry_funnel_engine.sql'):resolve(root,'supabase/migrations/20261115013453_gateway_entry_funnel_engine.sql');
  await db.exec(readFileSync(file,'utf8'));
  await run(product+' collector changes only the engine enum, retaining permissions and security invoker',async()=>{
   const old="v_event->>'engine' not in ('classic','constructor','nexobet')";
   const updated=nx?"v_event->>'engine' not in ('nexobet','gateway')":"v_event->>'engine' not in ('classic','constructor','nexobet','gateway')";
   assert.equal(await definition(),before.replace(old,updated));
   await db.exec(`insert into ${table}(engine)values('gateway');`);
   await assert.rejects(db.exec(`insert into ${table}(engine)values('invented');`));
   for(const role of ['anon','authenticated'])assert.equal((await db.query(`select has_function_privilege('${role}','public.${fn}(uuid,uuid,integer,jsonb)','execute') ok`)).rows[0].ok,false);
   assert.equal((await db.query(`select prosecdef from pg_proc where oid='public.${fn}(uuid,uuid,integer,jsonb)'::regprocedure`)).rows[0].prosecdef,false);
  });
 }
 console.log(JSON.stringify({passed,engine:'PGlite PostgreSQL',networkRequests:0,productionWrites:0}));
}finally{await db.close();}
