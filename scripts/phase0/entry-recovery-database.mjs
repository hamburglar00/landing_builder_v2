import assert from 'node:assert/strict';
import {localDatabase,read} from './local-runtime.mjs';
const db=await localDatabase(),sql=s=>db.sql(s).trim();
const id=n=>`b0000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const [owner,landing,client,advisor,landing8]=[1,2,3,4,5].map(id);
try {
 sql(`create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;
 create table profiles(id uuid primary key,role text);
 create table landings(id uuid primary key,name text,user_id uuid,workspace_currency text,config jsonb,landing_config jsonb,card_analytics_reset_at timestamptz);
 create table atrio_clients(id uuid primary key,atrio_id text,slug text,user_id uuid,workspace_currency text);
 create table landings_atrio_clients(landing_id uuid,atrio_client_id uuid,user_id uuid);
 create table client_template_permissions(user_id uuid primary key,template7_enabled boolean default false);
 create table landing_card_clicks(landing_id uuid,event_id uuid,card_index smallint,clicked_at timestamptz default now(),primary key(landing_id,event_id));
 create function is_client_access_blocked(uuid) returns boolean language sql as $$select false$$;
 grant usage on schema public,auth to service_role,authenticated,anon;
 grant all on all tables in schema public to service_role;`);
 for(const file of ['20261008203009_template7_rate_limits.sql','20261009032801_harden_template7_start_rate_limit_order.sql','20261022175337_template8_atrio_grid.sql','20261027184155_template7_resumable_attempt_limits.sql']) sql(read('supabase/migrations/'+file));
 sql(`insert into profiles values('${owner}','client');
 insert into atrio_clients values('${client}','${advisor}','fixture','${owner}','ARS');
 insert into landings_atrio_clients values('${landing}','${client}','${owner}'),('${landing8}','${client}','${owner}');
 insert into landings(id,name,user_id,workspace_currency,config,landing_config) values
 ('${landing}','fixture','${owner}','ARS','{"template":"template7","ctaDestination":"atrio","targetProvider":"rey_de_ases"}','{"layout":{"template":7}}'),
 ('${landing8}','fixture8','${owner}','ARS','{"template":"template8","ctaDestination":"atrio","template8Cover":{"cardCount":2,"cards":[{"targetProvider":"ganamos_net"},{"targetProvider":"rey_de_ases"}]}}','{"layout":{"template":8}}');`);
 const call=(template=7,assigned=client,unbound=false)=>`select status from resolve_template${template}_start_context('${template===7?landing:landing8}','fixture${template===7?'':'8'}','${assigned}','${advisor}','fixture','${'a'.repeat(64)}','${'b'.repeat(64)}',${unbound?`'${'c'.repeat(64)}'`:'null'}${template===8?',1':''});`;
 for(const template of [7,8]) for(const unbound of [false,true]){
  sql('truncate template7_rate_limit_buckets');
  const results=await Promise.all(Array.from({length:5},()=>db.concurrentSql('set role service_role;'+call(template,client,unbound))));
  assert.ok(results.every(r=>r.code===0),JSON.stringify(results));
  assert.equal(results.filter(r=>r.stdout.trim().endsWith('ok')).length,4);
  assert.equal(results.filter(r=>r.stdout.includes('rate_limited')).length,1);
  assert.equal(sql("select bool_and(expires_at-updated_at<=interval '10 seconds') from template7_rate_limit_buckets where bucket_key<>'"+'a'.repeat(64)+"'"),'t');
  sql("update template7_rate_limit_buckets set expires_at=now()-interval '1 second' where bucket_key<>'"+'a'.repeat(64)+"'");
  assert.equal(sql('set role service_role;'+call(template,client,unbound)).split('\n').at(-1),'ok');
  sql('truncate template7_rate_limit_buckets');
  assert.equal(sql(call(template,id(99))),'advisor_not_assigned');
  sql('truncate template7_rate_limit_buckets');
  sql(`insert into template7_rate_limit_buckets values('${'a'.repeat(64)}',120,now()+interval '1 minute',now());`);
  assert.equal(sql(call(template)),'rate_limited','Global IP protection unchanged');
  for(const role of ['anon','authenticated'])assert.throws(()=>sql('set role '+role+';'+call(template)),/permission denied/);
 }
 console.log('PASS: T7/T8 real RPCs, four concurrent recoveries, fifth denied, 10s expiry, unchanged IP cap and advisor/role isolation.');
} finally {db.close();}
