import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const db=new PGlite();let checks=0;
const id=n=>`f0000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
try{
 await db.exec(`create schema app_private;create schema extensions;create schema vault;create schema net;create schema cron;
 create role anon;create role authenticated;create role service_role bypassrls;
 grant usage on schema public,app_private to service_role;
 create table cron.job(name text,schedule text,command text);
 create function cron.schedule(text,text,text) returns bigint language plpgsql as $$begin insert into cron.job values($1,$2,$3);return 1;end$$;
 create table vault.secrets(id uuid primary key default gen_random_uuid(),name text unique,decrypted_secret text);
 create view vault.decrypted_secrets as select * from vault.secrets;
 create function vault.create_secret(text,text) returns uuid language sql as $$insert into vault.secrets(decrypted_secret,name)values($1,$2)returning id$$;
 create function vault.update_secret(uuid,text) returns void language sql as $$update vault.secrets set decrypted_secret=$2 where id=$1$$;
 create table net.requests(id bigint generated always as identity,url text,body jsonb,headers jsonb);
 create function net.http_post(url text,body jsonb,headers jsonb,timeout_milliseconds integer)returns bigint language sql as $$insert into net.requests(url,body,headers)values($1,$2,$3)returning id$$;
 create table landings(id uuid primary key,name text,user_id uuid,workspace_currency text,config jsonb,landing_config jsonb);
 create table atrio_clients(id uuid primary key,atrio_id text,slug text,user_id uuid,workspace_currency text);
 create table landings_atrio_clients(landing_id uuid,atrio_client_id uuid,user_id uuid);
 create table profiles(id uuid primary key,slug text,role text,admin_id uuid);
 create table players(id uuid primary key,advisor_id uuid);
 create table player_provider_accounts(id uuid primary key,player_id uuid,target_provider text);
 create table conversations(id uuid primary key,player_id uuid,advisor_id uuid,player_provider_account_id uuid,provider_skin_code text);
 create table messages(id uuid primary key,conversation_id uuid,sender text,type text,content text,metadata jsonb,created_at timestamptz default now(),delivered_at timestamptz,read_at timestamptz);
 create table quick_starters(id uuid primary key);create table advisor_wallets(id uuid primary key);
 create table advisor_manager_connections(id uuid primary key,advisor_id uuid,manager_id int,agency_id int,target_provider text,skin_code text,manager_type text,active boolean);
 create table gateway_entry_settings(id boolean primary key,redirect_wait_enabled boolean,redirect_wait_seconds int,continue_button_enabled boolean);
 create table landing_manager_pools(landing_id uuid,target_provider text,admin_id uuid,mode text,criterion text,destinations jsonb,updated_at timestamptz default now());
 create function public.builder_advisor_scope(uuid[]) returns uuid language sql as $$select '${id(2)}'::uuid$$;
 create function public.read_builder_manager_pool(uuid,text,uuid[]) returns jsonb language sql set search_path=public as $$select coalesce((select to_jsonb(p)-'admin_id' from landing_manager_pools p where landing_id=$1 and target_provider=$2),'{"configuration":null}'::jsonb)$$;
 create table prepare_calls(n int);
 create function public.prepare_gateway_chat(text,uuid,uuid,text,text,boolean)returns jsonb language plpgsql set search_path=public as $$
 declare result jsonb;begin
 insert into prepare_calls values(1);
 select jsonb_build_object('advisor',to_jsonb(a),'player',to_jsonb(p),'account',to_jsonb(x),'conversation',to_jsonb(c),'messages','[]'::jsonb)
 into result from profiles a join players p on p.advisor_id=a.id join player_provider_accounts x on x.player_id=p.id
 join conversations c on c.player_provider_account_id=x.id
 where a.slug=$1 and a.role='advisor' and p.id=$2 and x.id=$3 and x.target_provider=$4 and c.provider_skin_code is not distinct from $5;
 return result;end$$;
 grant all on all tables in schema public to service_role;`);
 for(const file of ['../supabase/migrations/20261104015521_entry_configuration_catalog_source.sql','../../internal-chat/supabase/migrations/20261104015523_entry_configuration_catalog.sql','../../internal-chat/supabase/migrations/20261104014753_gateway_parallel_chat_prepare.sql']){
  // Both projects share the Vault helper; this fixture combines their schemas.
  const sql=(await readFile(new URL(file,import.meta.url),'utf8')).replace(/^create extension if not exists pg_net with schema extensions;$/m,'-- pg_net mocked above')
   .replaceAll('create function public.configure_entry_catalog_dispatch','create or replace function public.configure_entry_catalog_dispatch')
   .replaceAll('create function app_private.dispatch_entry_catalog_sync','create or replace function app_private.dispatch_entry_catalog_sync');
  await db.exec(sql);
 }
 await db.query('insert into landings values($1,$2,$3,$4,$5,$6)',[id(1),'fixture',id(2),'ARS',{template:'template7',targetProvider:'multi_skin',multiSkinCode:'bet30',private_key:'never project'},{}]);
 await db.query('insert into atrio_clients values($1,$2,$3,$4,$5)',[id(3),id(4),'advisor',id(2),'ARS']);
 await db.query('insert into landings_atrio_clients values($1,$2,$3)',[id(1),id(3),id(2)]);
 const read=async()=> (await db.query('select * from read_entry_catalog_changes(100)')).rows.map(row=>row.read_entry_catalog_changes);
 let [change]=await read();assert.equal(change.configuration.skin_code,'bet30');assert.equal(change.configuration.private_key,undefined);checks++;
 const oldRevision=change.revision;
 await db.query('update landings set config=config||$1::jsonb where id=$2',[{multiSkinCode:'jugamos'},id(1)]);
 await db.query('select ack_entry_catalog_changes($1::jsonb)',[JSON.stringify([{landing_id:id(1),revision:oldRevision}])]);
 [change]=await read();assert.ok(change.revision>oldRevision);assert.equal(change.configuration.skin_code,'jugamos');checks++;
 await db.query('insert into profiles values($1,$2,$3,$4)',[id(4),'advisor','advisor',id(2)]);
 await db.query('insert into advisor_manager_connections values($1,$2,1045,280,$3,$4,$5,true)',[id(5),id(4),'multi_skin','jugamos','full_carga']);
 await db.query('insert into landing_manager_pools values($1,$2,$3,$4,$5,$6,now())',[id(1),'multi_skin',id(2),'fixed','usage_count',[{connection_id:id(5),weight:1}]]);
 await db.exec('insert into gateway_entry_settings values(true,false,20,false)');
 const store=async(version=Number(change.revision),config=change.configuration)=>db.query('select store_entry_catalog_change($1,$2,$3::jsonb)',[id(1),version,JSON.stringify(config)]);
 await store();
 const catalog=async()=> (await db.query('select * from app_private.entry_configuration_catalog')).rows[0];
 assert.equal((await catalog()).connections[0].agency_id,280);assert.equal((await catalog()).entry_options.continueButtonEnabled,false);checks++;
 await db.exec('update advisor_manager_connections set agency_id=281');assert.equal((await catalog()).connections[0].agency_id,281);checks++;
 await db.exec('update gateway_entry_settings set continue_button_enabled=true');assert.equal((await catalog()).entry_options.continueButtonEnabled,true);checks++;
 await db.query('update landing_manager_pools set mode=$1',['fair']);assert.equal((await catalog()).pools[0].mode,'fair');checks++;
 await store(Number(change.revision)-1,{...change.configuration,slug:'stale'});assert.equal((await catalog()).configuration.slug,'fixture');checks++;
 await store(Number(change.revision)+1,null);await store(Number(change.revision),change.configuration);assert.equal((await catalog()).configuration,null);checks++;
 await store(Number(change.revision)+2,change.configuration);
 await db.query('insert into players values($1,$2)',[id(6),id(4)]);
 await db.query('insert into player_provider_accounts values($1,$2,$3)',[id(7),id(6),'multi_skin']);
 await db.query('insert into conversations values($1,$2,$3,$4,$5)',[id(8),id(6),id(4),id(7),'bet30']);
 const prepare=async(slug='advisor',skin='bet30')=>(await db.query('select prepare_cached_gateway_chat($1,$2,$3,$4,$5,false) as data',[slug,id(6),id(7),'multi_skin',skin])).rows[0].data;
 assert.ok(await prepare());assert.ok(await prepare());assert.equal((await db.query('select count(*)::int as n from prepare_calls')).rows[0].n,1);checks++;
 await db.query('insert into messages(id,conversation_id,sender,type,content)values($1,$2,$3,$4,$5)',[id(9),id(8),'asesor','texto','A new message during login']);
 assert.equal((await prepare()).messages[0].content,'A new message during login');checks++;
 assert.equal(await prepare('another'),null);assert.equal(await prepare('advisor','jugamos'),null);checks++;
 await db.query('update players set advisor_id=$1',[id(10)]);assert.equal(await prepare(),null);checks++;
 await db.query('update players set advisor_id=$1',[id(4)]);
 await db.exec('update advisor_manager_connections set active=false');
 assert.equal((await db.query('select count(*)::int as n from app_private.gateway_chat_preparations')).rows[0].n,0);checks++;
 for(const role of ['anon','authenticated'])for(const fn of ['read_entry_catalog_changes(integer)','ack_entry_catalog_changes(jsonb)','store_entry_catalog_change(uuid,bigint,jsonb)','prepare_cached_gateway_chat(text,uuid,uuid,text,text,boolean)','configure_entry_catalog_dispatch(text)']){
  assert.equal((await db.query('select has_function_privilege($1,$2,$3) as allowed',[role,fn,'execute'])).rows[0].allowed,false);checks++;
 }
 assert.deepEqual((await db.query('select schedule from cron.job order by name')).rows.map(r=>r.schedule),['*/5 * * * *','*/5 * * * *']);checks++;
 assert.equal((await db.query('select claim_entry_catalog_sync($1) as ok',[id(11)])).rows[0].ok,true);
 assert.equal((await db.query('select claim_entry_catalog_sync($1) as ok',[id(12)])).rows[0].ok,false);
 await db.query('select release_entry_catalog_sync($1)',[id(12)]);
 assert.equal((await db.query('select claim_entry_catalog_sync($1) as ok',[id(12)])).rows[0].ok,false);
 await db.query('select release_entry_catalog_sync($1)',[id(11)]);
 assert.equal((await db.query('select claim_entry_catalog_sync($1) as ok',[id(12)])).rows[0].ok,true);checks++;
 await db.query('select configure_entry_catalog_dispatch($1)',['fixture-only-key-'.repeat(4)]);
 await db.query('update landings set name=$1',['changed']);
 assert.equal((await db.query('select count(*)::int as n from net.requests')).rows[0].n,1);checks++;
 assert.equal((await db.query('select command from cron.job where name=$1',['entry-configuration-reconcile'])).rows[0].command,'select app_private.dispatch_entry_catalog_sync()');checks++;
 await db.query('delete from landings where id=$1',[id(1)]);assert.equal((await read())[0].configuration,null);checks++;
 console.log(`Entry catalog and parallel chat: ${checks} disposable PostgreSQL checks passed.`);
}catch(error){console.error(error.message,error.detail??'',error.where??'');process.exitCode=1;}finally{await db.close();}
