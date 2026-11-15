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
 await db.exec(readFileSync(resolve(root,'supabase/migrations/20261115011846_gateway_landing_publish_target.sql'),'utf8'));
 await run('Gateway publication is opt-in, T7/T9 Atrio only; reserved namespace rejected',async()=>{
  const save=(name,target,type,config)=>db.query('insert into landings values($1,$2,$3,$4)',[name,target,type,config]);
  await save('old','classic','external',{});await save('constructor','constructor','internal',{template:'template8'});
  for(const template of ['template7','template9'])await save(template,'gateway','internal',{template,ctaDestination:'atrio'});
  for(const [name,type,config]of [['nexobet','internal',{template:'template9',ctaDestination:'atrio'}],['NeXoBeT','internal',{template:'template9',ctaDestination:'atrio'}],['external','external',{template:'template9',ctaDestination:'atrio'}],['t8','internal',{template:'template8',ctaDestination:'atrio'}],['wa','internal',{template:'template9',ctaDestination:'whatsapp'}],['provider','internal',{template:'template9',ctaDestination:'atrio',targetProvider:'unknown'}]])await assert.rejects(save(name,'gateway',type,config));
  assert.equal((await db.query('select count(*)::int n from landings')).rows[0].n,4);
 });
 for(const product of ['builder','nexobet']){
  const nx=product==='nexobet',prefix=nx?'nx_':'',fn=prefix+'record_entry_funnel_events',table=prefix+'entry_funnel_events';
  const latest=readFileSync(nx?resolve(nexoRoot,'supabase/migrations/20261114035710_nexobet_builder_ui_template8.sql'):resolve(root,'supabase/migrations/20261110163119_entry_funnel_navigation_delivery_observability.sql'),'utf8');
  const rpc=latest.match(new RegExp('create or replace function public\\.'+fn+'\\([\\s\\S]+?\\$\\$;','i'))?.[0];
  assert.ok(rpc,'actual current collector SQL must be present');
  await db.exec(`create table ${table}(engine text constraint ${table}_engine_check check(engine ${nx?"='nexobet'":"in ('classic','constructor','nexobet')"}));${rpc} revoke all on function public.${fn}(uuid,uuid,integer,jsonb) from public,anon,authenticated;grant execute on function public.${fn}(uuid,uuid,integer,jsonb) to service_role;`);
  const definition=async()=>(await db.query(`select pg_get_functiondef('public.${fn}(uuid,uuid,integer,jsonb)'::regprocedure) body`)).rows[0].body;
  const before=await definition();
  const file=nx?resolve(nexoRoot,'supabase/migrations/20261115012053_nexobet_gateway_entry_funnel_engine.sql'):resolve(root,'supabase/migrations/20261115012052_gateway_entry_funnel_engine.sql');
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
