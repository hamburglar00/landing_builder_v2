import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const db=new PGlite(),owner='93000000-0000-4000-8000-000000000001',other='93000000-0000-4000-8000-000000000002',admin='93000000-0000-4000-8000-000000000003';
let checks=0;
try{
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema public,auth to authenticated;
 create table profiles(id uuid primary key,role text);
 create table client_module_permissions(user_id uuid primary key,show_atrio boolean default false);
 create table client_template_permissions(user_id uuid,template7_enabled boolean,template8_enabled boolean);
 create table landings(id int primary key,user_id uuid,config jsonb,landing_config jsonb);
 grant select on profiles,client_module_permissions,client_template_permissions to authenticated;
 grant select,insert,update,delete on landings to authenticated;
 alter table landings enable row level security;alter table client_module_permissions enable row level security;
 create policy own on client_module_permissions for select to authenticated using(user_id=auth.uid() or exists(select 1 from profiles where id=auth.uid()and role='admin'));
 create policy owner on landings for all to authenticated using(user_id=auth.uid()or exists(select 1 from profiles where id=auth.uid()and role='admin'))with check(user_id=auth.uid()or exists(select 1 from profiles where id=auth.uid()and role='admin'));
 insert into profiles values('${owner}','client'),('${other}','client'),('${admin}','admin');
 insert into client_module_permissions values('${owner}',false),('${other}',true);
 insert into client_template_permissions values('${owner}',true,true);
 insert into landings values(1,'${owner}','{"template":"template7","ctaDestination":"atrio"}','{"layout":{"template":7}}'),(2,'${other}','{"template":"template1"}','{}');`);
 for(const number of [7,8,9])for(const action of ['insert','update'])await db.exec(`create policy "Template ${number} permission on landing ${action}"on landings as restrictive for ${action} to authenticated ${action==='update'?'using(true)':''}with check(true)`);
 await db.exec(await readFile(new URL('../supabase/migrations/20261109191054_atrio_channel_global_template_permission.sql',import.meta.url),'utf8'));
 await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${owner}',false)`);
 assert.equal((await db.query('select * from landings')).rows.length,1);checks++;
 for(const number of [7,8,9]){
  await assert.rejects(db.query('insert into landings values($1,$2,$3,$4)',[number,owner,{template:`template${number}`,ctaDestination:'atrio'},{layout:{template:number}}]));checks++;
  await assert.rejects(db.query('insert into landings values($1,$2,$3,$4)',[number,owner,{template:'template1'},{layout:{template:number}}]));checks++;
 }
 await assert.rejects(db.query('update landings set config=$1 where id=1',[{template:'template7',title:'blocked'}]));checks++;
 await assert.rejects(db.query('update client_module_permissions set show_atrio=true'));checks++;
 await db.exec('reset role');await db.query('update client_module_permissions set show_atrio=true where user_id=$1',[owner]);
 await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${owner}',false)`);
 for(const number of [7,8,9]){await db.query('insert into landings values($1,$2,$3,$4)',[number,owner,{template:`template${number}`,ctaDestination:'atrio'},{layout:{template:number}}]);checks++;}
 await assert.rejects(db.query('insert into landings values(10,$1,$2,$3)',[other,{template:'template8'},{layout:{template:8}}]));checks++;
 await db.exec('reset role');await db.query('update client_module_permissions set show_atrio=false where user_id=$1',[owner]);
 await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${owner}',false)`);
 await db.query('update landings set config=$1,landing_config=$2 where id=1',[{template:'template1',ctaDestination:'whatsapp'},{layout:{template:1}}]);checks++;
 await assert.rejects(db.query('update landings set config=$1 where id=7',[{template:'template9'}]));checks++;
 await db.exec(`select set_config('request.jwt.claim.sub','${admin}',false)`);
 await db.query('update landings set config=$1 where id=7',[{template:'template9',ctaDestination:'atrio'}]);checks++;
 assert.equal((await db.query('select count(*)::int n from landings')).rows[0].n,5);checks++;
 console.log(`Atrio global permission: ${checks} PostgreSQL assertions passed (all 3 templates, both config fields, revoked/legacy flags, owner isolation, administrator).`);
}finally{await db.close();}
