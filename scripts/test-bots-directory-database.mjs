import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const db=new PGlite();
const owner='92000000-0000-4000-8000-000000000001',other='92000000-0000-4000-8000-000000000002',advisor='92000000-0000-4000-8000-000000000003';
let checks=0;
try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create schema net;create schema cron;
 create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema public,auth to authenticated;
 create function cron.schedule(text,text,text)returns bigint language sql as $$select 1::bigint$$;
 create function net.http_post(url text,body jsonb,headers jsonb,timeout_milliseconds integer)returns bigint language sql as $$select 1::bigint$$;
 create table cron_config(key text,value text);
 create table gerencias(id int primary key,user_id uuid,nombre text,gerencia_id int,workspace_currency text,source_type text,fair_criterion text,pbadmin_bots jsonb default '[]',pbadmin_bots_synced_at timestamptz);
 create table gerencia_phones(id int primary key,gerencia_id int references gerencias(id),phone text,status text,source_available boolean,usage_count int,assignment_role text,messages_reset_at timestamptz,assignment_counter_reset_at timestamptz);
 create table phone_metrics(gerencia_phone_id int,messages_received int,messages_received_historical int,calculated_at timestamptz);
 create table phone_assignment_scope_metrics(phone_id int,usage_count int,updated_at timestamptz);
 create table atrio_clients(id uuid primary key,user_id uuid,atrio_id text,slug text,display_name text,workspace_currency text,pbadmin_bots jsonb default '[]');
 create table conversions_config(user_id uuid primary key,phone_auto_reset_daily boolean,phone_auto_reset_last_date date,updated_at timestamptz);
 alter table gerencias enable row level security;alter table gerencia_phones enable row level security;
 alter table phone_metrics enable row level security;alter table atrio_clients enable row level security;
 create policy own on gerencias for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
 create policy own on atrio_clients for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
 create policy own on gerencia_phones for all to authenticated using(exists(select 1 from gerencias g where g.id=gerencia_id)) with check(exists(select 1 from gerencias g where g.id=gerencia_id));
 create policy own on phone_metrics for select to authenticated using(exists(select 1 from gerencia_phones p where p.id=gerencia_phone_id));
 grant select,update,delete on gerencias,gerencia_phones,phone_metrics,atrio_clients to authenticated;
 insert into gerencias(id,user_id,nombre,gerencia_id,workspace_currency,source_type)select i,'${owner}','Group '||lpad(i::text,3,'0'),i,'ARS','pbadmin' from generate_series(1,121)i;
 insert into gerencias(id,user_id,nombre,gerencia_id,workspace_currency,source_type)values(500,'${other}','Foreign secret',1,'ARS','pbadmin'),(501,'${owner}','PYG only',501,'PYG','manual');
 insert into gerencia_phones values(1,1,'5491125787449','active',true,12,'acquisition',null,null),(2,121,'5491112345678','inactive',false,7,'follow_up',null,null),(3,500,'5491199999999','active',true,44,'acquisition',null,null),(4,501,'595973123456','active',true,3,'acquisition',null,null);
 insert into phone_metrics values(1,4,100,now()),(2,8,200,now()),(3,9,900,now());
 insert into phone_assignment_scope_metrics values(1,12,now());
 insert into atrio_clients(id,user_id,atrio_id,slug,display_name,workspace_currency)values('${advisor}','${owner}','${advisor}','gera','Gera','ARS');
 insert into conversions_config values('${owner}',true,null,now()),('${other}',false,null,now());`);
 await db.exec(await readFile(new URL('../supabase/migrations/20261109185337_bots_directory_pagination_and_daily_reset.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/20261109214729_batch_inactive_workspace_phone_cleanup.sql',import.meta.url),'utf8'));
 await db.query('select cache_atrio_bot_directory($1)',[JSON.stringify([{id:advisor,connections:[{connection_id:owner,agency_id:1,agency_name:'Group 001',active:true,manager_id:1035}]}])]);
 await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${owner}',false)`);
 const page=async(n=1,search='',channel='all',active=false,workspace='ARS')=>(await db.query('select read_bots_directory_page($1,$2,$3,$4,$5,true) as data',[workspace,n,search,channel,active])).rows[0].data;
 const first=await page();assert.equal(first.groups.length,50);assert.equal(first.total,121);assert.deepEqual(first.phones.map(p=>p.id),[1]);assert.equal(first.metrics.length,1);assert.equal(first.activePhones,1);assert.equal(first.inactivePhones,1);checks+=6;
 await db.exec('reset role');
 await db.exec(await readFile(new URL('../supabase/migrations/20261110163651_bots_directory_sorting.sql',import.meta.url),'utf8'));
 await db.exec('set role authenticated');assert.deepEqual(await page(),first,'previous RPC keeps its complete response');checks++;
 const second=await page(2);assert.equal(second.groups.length,50);assert.equal(second.phones.length,0);assert.equal(second.groups[0].id,51);checks+=3;
 const third=await page(3);assert.equal(third.groups.length,21);assert.equal(third.phones[0].id,2);checks+=2;
 assert.equal((await page(1,'Group 121')).groups[0].id,121);assert.equal((await page(1,'54 9 1112 34-5678')).groups[0].id,121);assert.equal((await page(1,'Gera')).groups[0].id,1);checks+=3;
 assert.equal((await page(1,'','atrio')).total,1);assert.equal((await page(1,'','all',true)).total,1);assert.equal((await page(9)).page,3);assert.equal((await page(1,'Foreign secret')).total,0);assert.equal((await page(1,'','all',false,'PYG')).total,1);checks+=5;
 await assert.rejects(db.query('select read_bots_directory_page($1,0)', ['ARS']));await assert.rejects(db.query("select cache_atrio_bot_directory('[]')"));await assert.rejects(db.query('select read_bot_daily_resets()'));checks+=3;
 await db.exec('reset role');
 await db.query('insert into gerencias(id,user_id,nombre,gerencia_id,workspace_currency,source_type)values(122,$1,$2,800,$3,$4)',[owner,'Manual collision','ARS','manual']);
 await db.query('select cache_atrio_bot_directory($1)',[JSON.stringify([{id:advisor,connections:[{connection_id:owner,agency_id:1,agency_name:'Group 001',active:true,manager_id:1035},{connection_id:other,agency_id:800,agency_name:'Virtual agency',active:false,manager_id:1080}]}])]);
 await db.exec('set role authenticated');
 const atrioPage=await page(1,'','atrio');assert.equal(atrioPage.total,2);assert.equal(atrioPage.groups.find(g=>g.nombre==='Virtual agency').virtual,true);
 assert.equal((await page(1,'Bot 1080')).groups[0].nombre,'Virtual agency');checks+=3;
 await db.exec('reset role');
 await db.query('select cache_atrio_bot_directory($1)',[JSON.stringify([{id:advisor,connections:[
  {connection_id:owner,agency_id:1,agency_name:'Group 001',active:true,manager_id:1035},
  {connection_id:other,agency_id:800,agency_name:'Virtual agency',active:false,manager_id:1080},
  {connection_id:advisor,agency_id:null,agency_name:'No agency',active:false,manager_id:1090}
 ]}])]);await db.exec('set role authenticated');
 const sorted=async(sort,direction,n=1,search='',workspace='ARS')=>(await db.query('select read_bots_directory_page_sorted($1,$2,$3,$4,false,true,$5,$6) data',[workspace,n,search,'all',sort,direction])).rows[0].data;
 const displayedId=g=>g.gerencia_id??(g.virtual?null:g.id);
 for(const sort of ['name','id'])for(const direction of ['asc','desc']){
  const all=[];let total=0;
  for(let n=1;n<=3;n++){
   const current=await sorted(sort,direction,n);total=current.total;
   assert.ok(current.groups.length<=50,'only a page of details');
   assert.ok(current.phones.every(p=>current.groups.some(g=>!g.virtual&&g.id===p.gerencia_id)),'phones only from selected page');
   assert.ok(current.metrics.every(m=>current.phones.some(p=>p.id===m.gerencia_phone_id)),'metrics only from selected page');
   assert.ok(current.groups.every(g=>g.user_id===owner),'sort preserves RLS');all.push(...current.groups);checks+=4;
  }
  assert.equal(all.length,total);assert.equal(new Set(all.map(g=>g.uiKey??g.id)).size,total,'stable ties prevent duplicates across pages');checks+=2;
  if(sort==='id'){
   const ids=all.map(displayedId),numericIds=ids.filter(x=>x!==null);
   assert.deepEqual(numericIds,[...numericIds].sort((a,b)=>direction==='asc'?a-b:b-a),'numeric display ID ordering');
   assert.equal(ids.at(-1),null,'N.A. always last');
   if(direction==='desc')assert.deepEqual(ids.slice(0,2),[800,800],'display IDs override internal and virtual IDs');checks+=3;
  }else{
   const names=all.map(g=>g.nombre.toLowerCase());assert.deepEqual(names,[...names].sort((a,b)=>direction==='asc'?(a<b?-1:a>b?1:0):(a>b?-1:a<b?1:0)));checks++;
  }
 }
 for(const args of [['invalid','asc'],['id','invalid'],[null,'asc'],['id',null]]){await assert.rejects(sorted(...args));checks++;}
 assert.equal((await sorted('id','desc',1,'Foreign secret')).total,0);
 assert.equal((await sorted('name','desc',1,'','PYG')).total,1);
 const grants=(await db.query("select has_function_privilege('anon','read_bots_directory_page_sorted(text,integer,text,text,boolean,boolean,text,text)','execute') anon,has_function_privilege('authenticated','read_bots_directory_page_sorted(text,integer,text,text,boolean,boolean,text,text)','execute') allowed")).rows[0];assert.deepEqual(grants,{anon:false,allowed:true});checks+=3;
 await db.exec("select set_config('request.jwt.claim.sub','',false)");await assert.rejects(sorted('id','asc'));await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);checks++;
 await db.exec('reset role');
 const allScope=await page(1,'Foreign secret');assert.equal(allScope.groups[0].atrioBots.length,0,'same agency owned by another client never receives these advisors');checks++;
 await db.query('delete from gerencias where id=122');
 await db.query('select cache_atrio_bot_directory($1)',[JSON.stringify([{id:advisor,connections:[{connection_id:owner,agency_id:1,agency_name:'Group 001',active:true,manager_id:1035}]}])]);
 await db.exec(`insert into gerencia_phones select 1000+n,121,'549110000'||lpad(n::text,4,'0'),'inactive',false,1,'follow_up',null,null from generate_series(1,52)n;
 update gerencia_phones set status='inactive' where id in(3,4);set role authenticated`);
 const batches=[];
 for(let i=0;i<4;i++)batches.push((await db.query('select delete_inactive_workspace_phone_batch($1) n',['ARS'])).rows[0].n);
 assert.deepEqual(batches,[25,25,3,0]);assert.equal((await page()).inactivePhones,0);checks+=2;
 await db.exec('reset role');
 assert.equal((await db.query("select count(*)::int n from gerencia_phones where id in(3,4) and status='inactive'")).rows[0].n,2,'foreign owner and another workspace remain untouched');
 assert.equal((await db.query("select has_function_privilege('anon','delete_inactive_workspace_phone_batch(text)','execute') allowed")).rows[0].allowed,false);checks+=2;
 await db.query('select cron_reset_phone_operational_daily()');
 const phoneRows=(await db.query('select id,usage_count from gerencia_phones order by id')).rows;
 assert.deepEqual(phoneRows,[{id:1,usage_count:0},{id:3,usage_count:44},{id:4,usage_count:0}]);
 assert.equal((await db.query('select usage_count from phone_assignment_scope_metrics')).rows[0].usage_count,0);
 assert.equal((await db.query('select count(*)::int n from app_private.bot_daily_resets')).rows[0].n,1);
 assert.equal((await db.query('select messages_received_historical from phone_metrics where gerencia_phone_id=1')).rows[0].messages_received_historical,100);checks+=4;
 await db.exec('update gerencia_phones set usage_count=6 where id=1;select cron_reset_phone_operational_daily()');
 assert.equal((await db.query('select usage_count from gerencia_phones where id=1')).rows[0].usage_count,6);checks++;
 await db.query('select ack_bot_daily_resets($1)',[JSON.stringify([{advisor_id:advisor,reset_date:(await db.query('select reset_date::text d from app_private.bot_daily_resets')).rows[0].d}])]);
 assert.equal((await db.query('select * from read_bot_daily_resets()')).rows.length,0);checks++;
 console.log(`Bots PostgreSQL: ${checks} assertions passed (50 per demand page, filters, RLS, global scope, daily resets, retry and history).`);
}finally{await db.close();}
