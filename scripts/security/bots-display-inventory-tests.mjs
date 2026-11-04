import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(process.env.PGLITE_MODULE?pathToFileURL(process.env.PGLITE_MODULE).href:'@electric-sql/pglite');
const db=new PGlite(),owner='92000000-0000-4000-8000-000000000001',other='92000000-0000-4000-8000-000000000002';
try{
 await db.exec(`create role authenticated;create schema auth;
  create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  grant usage on schema public,auth to authenticated;
  create table gerencias(id int primary key,user_id uuid,nombre text,usage_count int);
  create table gerencia_phones(id int primary key,gerencia_id int,phone text,status text,usage_count int);
  create table atrio_clients(id uuid primary key,user_id uuid,slug text,usage_count int);
  insert into atrio_clients values('${owner}','${owner}','gera',19);
  alter table gerencias enable row level security;
  create policy own on gerencias for all to authenticated using((select auth.uid())=user_id)with check((select auth.uid())=user_id);
  grant select,insert,update,delete on gerencias to authenticated;
  insert into gerencias values(10,'${owner}','Edited name',17),(20,'${other}','Other client',22);
  insert into gerencia_phones values(1,10,'5493511234567','active',7);`);
 const before=(await db.query('select * from gerencia_phones')).rows;
 await db.exec(await readFile(new URL('../../supabase/migrations/20261104143552_bots_display_inventory.sql',import.meta.url),'utf8'));
 assert.deepEqual((await db.query('select nombre,usage_count,pbadmin_bots,pbadmin_bots_synced_at from gerencias order by id')).rows,
  [{nombre:'Edited name',usage_count:17,pbadmin_bots:[],pbadmin_bots_synced_at:null},{nombre:'Other client',usage_count:22,pbadmin_bots:[],pbadmin_bots_synced_at:null}]);
 await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${owner}',false)`);
 assert.equal((await db.query('select count(*)::int as count from gerencias')).rows[0].count,1);
 await db.query('update gerencias set pbadmin_bots=$1,pbadmin_bots_synced_at=now() where id=10',[[{manager_id:1042,active:false,phone:null}]]);
 assert.equal((await db.query("update gerencias set pbadmin_bots='[]' where id=20 returning id")).rows.length,0);
 await assert.rejects(db.exec(`update gerencias set pbadmin_bots='{}' where id=10`));
 await assert.rejects(db.exec(`update gerencias set pbadmin_bots=(select jsonb_agg(i)from generate_series(1,1001)i)where id=10`));
 await db.exec('reset role');
 assert.deepEqual((await db.query('select * from gerencia_phones')).rows,before,'snapshot migration and refresh do not alter routing or counters');
 assert.deepEqual((await db.query('select nombre,usage_count from gerencias where id=10')).rows,[{nombre:'Edited name',usage_count:17}]);
 assert.deepEqual((await db.query('select slug,usage_count,pbadmin_bots from atrio_clients')).rows,[{slug:'gera',usage_count:19,pbadmin_bots:[]}]);
 console.log('Bots display inventory: defaults, existing data, size constraints, owner RLS and unchanged phone routing passed.');
}finally{await db.close();}
