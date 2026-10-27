import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {localDatabase} from './local-runtime.mjs';
const db=await localDatabase(),sql=s=>db.sql(s).trim();
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const [advisor,other,player,account,connection]=[1,2,3,4,5].map(id);
const migration=name=>sql(readFileSync(new URL(`../../../internal-chat/supabase/migrations/${name}`,import.meta.url),'utf8'));
try {
 sql(`create schema auth;create schema app_private;
 create function auth.role() returns text language sql stable as $$select current_setting('request.jwt.claim.role',true)$$;
 create table profiles(id uuid primary key,slug text,role text,full_name text,avatar_url text,status text,whatsapp_channels jsonb,telegram_channels jsonb,widget_template text);
 create table players(id uuid primary key,advisor_id uuid,display_name text,device_id text,platform text,app_installed_status text);
 create table advisor_manager_connections(id uuid primary key,advisor_id uuid,target_provider text,active boolean,manager_id bigint,agency_id bigint,manager_type text);
 create table player_provider_accounts(id uuid primary key,player_id uuid,target_provider text,provider_username text,provider_external_account_id text,manager_connection_id uuid);
 create table conversations(id uuid primary key default gen_random_uuid(),player_id uuid,advisor_id uuid,player_provider_account_id uuid,provider_skin_code text,status text);
 create unique index conversation_scope on conversations(player_id,player_provider_account_id,provider_skin_code) nulls not distinct;
 create table quick_replies(id uuid primary key default gen_random_uuid(),advisor_id uuid,type text,text text,is_enabled boolean);
 create table quick_starters(id uuid,advisor_id uuid,label text,message text,message_options jsonb,behavior text,sort_order int,is_active boolean);
 create table advisor_wallets(id uuid,advisor_id uuid,is_active boolean);
 create table messages(id uuid primary key default gen_random_uuid(),conversation_id uuid,sender text,type text,content text,metadata jsonb default '{}',created_at timestamptz default now(),delivered_at timestamptz,read_at timestamptz);
 grant usage on schema public,auth to service_role,authenticated,anon;
 grant all on all tables in schema public to service_role;
 insert into profiles(id,slug,role) values('${advisor}','fixture','advisor'),('${other}','other','advisor');
 insert into players(id,advisor_id,display_name) values('${player}','${advisor}','{{clave}}');
 insert into advisor_manager_connections values('${connection}','${advisor}','ganamos_net',true,1044,280,'full_carga');
 insert into player_provider_accounts values('${account}','${player}','ganamos_net','fixture-user','${player}','${connection}');
 insert into quick_replies(advisor_id,type,text,is_enabled) values('${advisor}','bienvenida','Hola {{nombre}}: {{usuario}} / {{clave}}',true);`);
 migration('20261017212342_atomic_gateway_chat_bootstrap.sql');
 // Wallet behavior is outside this test; the real entry wrapper still runs in full.
 sql(`create function public.ensure_gateway_entry_wallet(uuid,uuid,uuid,uuid,jsonb) returns jsonb language sql as $$select null::jsonb$$;`);
 migration('20261023220427_manual_client_credentials.sql');
 migration('20261027181043_quick_reply_variables.sql');
 const call=`select public.bootstrap_gateway_chat_with_reply('fixture','${player}','${account}','ganamos_net',null,false,'fixture-key',true,'fixture-user')`;
 for(const role of ['anon','authenticated']) {
  assert.throws(()=>sql(`set role ${role};${call}`),/permission denied/);
  assert.throws(()=>sql(`set role ${role};select public.quick_reply_context('${advisor}','${player}','${account}',null)`),/permission denied/);
 }
 const context=JSON.parse(sql(`select public.quick_reply_context('${advisor}','${player}','${account}',null)`));
 assert.equal(context.manager_id,1044);assert.ok(context.welcome.includes('{{clave}}'));
 assert.equal(sql(`select public.quick_reply_context('${other}','${player}','${account}',null) is null`),'t');
 assert.equal(sql(`select public.quick_reply_context(null,'${player}','${account}','other') is null`),'t');
 const prepared=JSON.parse(sql(`select public.bootstrap_gateway_chat_with_reply('fixture','${player}','${account}','ganamos_net',null,false)`));
 assert.equal(prepared.reply_context.username,'fixture-user');
 assert.equal(sql('select count(*) from conversations'),'0','Preparation does not insert or expose a raw welcome');
 const concurrent=await Promise.all([1,2].map(()=>db.concurrentSql(`set role service_role;set request.jwt.claim.role='service_role';${call}`)));
 assert.ok(concurrent.every(r=>r.code===0),JSON.stringify(concurrent));
 assert.equal(sql('select count(*) from messages'),'1');
 assert.equal(sql('select content from messages'),'Hola {{clave}}: fixture-user / fixture-key');
 assert.equal(JSON.parse(sql(`select public.quick_reply_context('${advisor}','${player}','${account}',null)`)).welcome,null);
 const conversation=sql('select id from conversations');
 sql(`set role service_role;set request.jwt.claim.role='service_role';insert into messages(conversation_id,sender,type,content,metadata)
 values('${conversation}','asesor','texto','{{clave}}','{"source":"auto_away"}');`);
 assert.equal(sql(`select content from messages where metadata->>'source'='auto_away'`),'Disponible en Mi perfil');
 sql(`set role service_role;set request.jwt.claim.role='service_role';insert into messages(conversation_id,sender,type,content,metadata)
 values('${conversation}','cliente','texto','{{clave}}','{}'),('${conversation}','asesor','texto','{{nombre}}','{"source":"auto_away","quick_reply_rendered":true}');`);
 assert.equal(sql(`select content from messages where sender='cliente'`),'{{clave}}');
 assert.equal(sql(`select content from messages where metadata->>'quick_reply_rendered'='true'`),'{{nombre}}');
 sql(`update advisor_manager_connections set active=false;`);
 assert.equal(JSON.parse(sql(`select public.quick_reply_context('${advisor}','${player}','${account}',null)`)).manager_id,null);
 console.log('PASS: private RPC permissions, exact advisor/player/account scope, active connection, literal substitution, concurrent welcome deduplication, no password context leakage, client text preserved.');
} finally { db.close(); }
