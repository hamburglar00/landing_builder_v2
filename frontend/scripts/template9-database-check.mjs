// Standalone PostgreSQL regression; PGLITE_MODULE points to an existing local
// @electric-sql/pglite/dist/index.js. No project or production connection.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
if(!process.env.PGLITE_MODULE)throw Error('Set PGLITE_MODULE to the local PGlite module');
const {PGlite}=await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const db=new PGlite();let assertions=0;
const equal=(actual,expected,message)=>{assert.deepEqual(actual,expected,message);assertions++};
const migration=name=>readFile(new URL('../../supabase/migrations/'+name,import.meta.url),'utf8');
const id=n=>`a0000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const owner=id(1),foreign=id(2),landing=id(3),advisor=id(4),advisorId=id(5);
const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated,service_role;
    create table public.profiles(id uuid primary key,role text,nombre text);
    create table public.landings(id uuid primary key,user_id uuid,workspace_currency text,name text,config jsonb,landing_config jsonb);
    create table public.atrio_clients(id uuid primary key,user_id uuid,workspace_currency text,slug text,atrio_id text);
    create table public.landings_atrio_clients(landing_id uuid,atrio_client_id uuid,user_id uuid);
    create table public.client_subscriptions(user_id uuid primary key,status text,expires_at timestamptz,grace_days integer);
    create table public.landing_card_clicks(id uuid primary key);
    alter table public.landings enable row level security;
    create policy owner_access on public.landings for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
    grant select,insert,update on public.landings to authenticated;
    grant select on public.profiles to authenticated;
    grant select on all tables in schema public to service_role;
    insert into auth.users values('${owner}'),('${foreign}');
    insert into profiles values('${owner}','client','Fixture'),('${foreign}','client','Other');`);
  const subscriptions=await migration('20260403110000_client_subscriptions_plans.sql');
  await db.exec(subscriptions.match(/create or replace function public\.is_client_access_blocked\(p_user_id uuid\)[\s\S]*?\$\$;/)[0]);
  for(const file of ['20261008203009_template7_rate_limits.sql','20261009032801_harden_template7_start_rate_limit_order.sql','20261011154509_add_ases_del_norte_template7.sql','20261013020333_add_ganamos_net_template7.sql','20261009182035_template7_client_access.sql'])await db.exec(await migration(file));
  const eight=await migration('20261022175337_template8_atrio_grid.sql');
  await db.exec(eight.slice(0,eight.indexOf('create or replace function public.record_template6_card_click')));
  await db.exec(await migration('20261027184155_template7_resumable_attempt_limits.sql'));
  for(const file of ['20261030234129_entry_funnel_observability.sql','20261031131638_entry_funnel_chat_diagnostics.sql','20261031170412_entry_funnel_chat_usable.sql'])await db.exec(await migration(file));
  const definition=signature=>scalar(`select pg_get_functiondef($1::regprocedure)`,[signature]);
  const signatures=['public.resolve_template7_start_context(uuid,text,uuid,text,text,text,text,text)','public.resolve_template7_destination_context(uuid,text)','public.record_entry_funnel_events(uuid,uuid,integer,jsonb)'];
  const before=await Promise.all(signatures.map(definition));
  await db.exec(await migration('20261103184354_template9_gateway_entry.sql'));
  const after=await Promise.all(signatures.map(definition));
  equal(after[0].replace("in ('template7','template9')","= 'template7'").replace("in ('7','9')","= '7'"),before[0],'start changes only template admission');
  equal(after[1].replace("not in ('template7','template8','template9')","not in ('template7','template8')"),before[1],'destination changes only template admission');
  equal(after[2].replace('p_template not in (7,8,9)','p_template not in (7,8)'),before[2],'diagnostics change only template admission');
  for(const sig of signatures)for(const role of ['anon','authenticated'])equal(await scalar('select has_function_privilege($1,$2,\'execute\')',[role,sig]),false);
  await db.exec(`insert into atrio_clients values('${advisor}','${owner}','ARS','advisor','${advisorId}'),('${id(6)}','${foreign}','ARS','other','${id(7)}'),('${id(8)}','${owner}','PYG','foreignworkspace','${id(9)}');
    insert into landings values('${landing}','${owner}','ARS','fixture','{"template":"template9","ctaDestination":"atrio","targetProvider":"ganamos_net"}','{"layout":{"template":9}}');
    insert into landings_atrio_clients values('${landing}','${advisor}','${owner}');`);
  const start=async(n=0,selected=advisor,selectedId=advisorId)=>{
    const bucket=String(n).padStart(64,'0');
    await db.exec('set role service_role');
    try{return await scalar(`select status from public.resolve_template7_start_context($1,'fixture',$2,$3,'advisor',$4,$5,null)`,[landing,selected,selectedId,bucket,'a'.repeat(63)+(n%10)]);}finally{await db.exec('reset role')}
  };
  for(const [n,provider]of ['rey_de_ases','ases_del_norte','ganamos_net','multi_skin'].entries()){
    await db.query(`update landings set config=jsonb_set(config,'{targetProvider}',to_jsonb($1::text)) where id=$2`,[provider,landing]);
    equal(await start(n),'ok',provider);
  }
  equal(await start(5,id(6),id(7)),'advisor_not_assigned','foreign owner cannot become this advisor');
  equal(await start(6,id(8),id(9)),'advisor_not_assigned','foreign workspace cannot become this advisor');
  const context=await scalar(`select public.resolve_template7_destination_context($1,'fixture')`,[landing]);
  equal(context.advisors.map(a=>a.id),[advisor]);
  await db.exec(`insert into client_subscriptions values('${owner}','paused',null,5);`);
  equal(await start(7),'landing_unavailable');
  equal((await scalar(`select public.resolve_template7_destination_context($1,'fixture')`,[landing])).advisors,[]);
  await db.exec('delete from client_subscriptions');
  for(const number of [7,8,9]){
    await db.query(`update landings set config=jsonb_set(config,'{template}',to_jsonb($1::text)) where id=$2`,['template'+number,landing]);
    const event={id:id(100+number),name:'chat_usable',elapsed_ms:1200,duration_ms:300};
    equal(await scalar(`select record_entry_funnel_events($1,$2,$3,$4::jsonb)`,[landing,id(200+number),number,JSON.stringify([event])]),true);
    equal(await scalar(`select record_entry_funnel_events($1,$2,$3,$4::jsonb)`,[landing,id(200+number),number,JSON.stringify([event])]),true,'replay stays idempotent');
  }
  equal(await scalar('select count(*)::int from entry_funnel_events'),3);
  equal(await scalar(`select record_entry_funnel_events($1,$2,7,$3::jsonb)`,[landing,id(999),JSON.stringify([{id:id(999),name:'cta_clicked',elapsed_ms:0}])]),false,'mismatched template denied');
  // The existing capability gates raw and public config; migration adds no grants.
  const insert=async(n,raw='template9',publicTemplate=9)=>{
    await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${owner}',false);`);
    try{return await db.query(`insert into landings values($1,$2,'ARS','new',$3::jsonb,$4::jsonb)`,[id(n),owner,JSON.stringify({template:raw,ctaDestination:'atrio'}),JSON.stringify({layout:{template:publicTemplate}})]);}finally{await db.exec('reset role')}
  };
  await assert.rejects(insert(301));assertions++;
  await assert.rejects(insert(302,'template1'));assertions++;
  await db.exec(`insert into client_template_permissions(user_id,template7_enabled) values('${owner}',true);`);
  await insert(303);assertions++;
  equal(await scalar(`select count(*)::int from landings where id=$1`,[id(303)]),1);
  console.log(JSON.stringify({postgres:await scalar('select version()'),passed:assertions}));
}catch(error){console.error({message:error.message,code:error.code,where:error.where,stack:error.stack?.split('\n').slice(0,4)});process.exitCode=1}finally{await db.close()}
