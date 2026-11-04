import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

// Isolated PostgreSQL fixture. Never connects to a hosted database.
const {PGlite} = await import(process.env.PGLITE_MODULE
  ? pathToFileURL(process.env.PGLITE_MODULE).href : '@electric-sql/pglite');
const db = new PGlite();
const first = '92000000-0000-4000-8000-000000000001';
const second = '92000000-0000-4000-8000-000000000002';
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
    grant usage on schema auth, public to authenticated, anon, service_role;
    create table public.conversions_config(user_id uuid primary key, show_logs boolean not null default true);
    insert into auth.users values ('${first}'), ('${second}');
    insert into conversions_config(user_id) values ('${first}');
  `);
  await db.exec(await readFile(new URL('../../supabase/migrations/20261015181921_client_module_visibility.sql', import.meta.url), 'utf8'));
  await db.exec(`insert into public.client_module_permissions(user_id,show_followups) values ('${first}',false)`);
  const before = (await db.query('select * from public.client_module_permissions')).rows[0];
  await db.exec(await readFile(new URL('../../supabase/migrations/20261104134536_client_module_visibility_opt_in.sql', import.meta.url), 'utf8'));
  const {show_notifications, ...after} = (await db.query('select * from public.client_module_permissions')).rows[0];
  assert.deepEqual(after, before, 'migration preserves all saved flags and timestamps');
  assert.equal(show_notifications, false, 'new section starts hidden for existing clients');
  await db.exec(`set role service_role;
    insert into public.client_module_permissions(user_id) values ('${second}');
    insert into public.client_module_permissions(user_id,show_notifications) values ('${second}',true)
      on conflict(user_id) do update set show_notifications=excluded.show_notifications;
    reset role;
    insert into public.conversions_config(user_id) values ('${second}');`);
  const permissions = (await db.query('select * from public.client_module_permissions where user_id=$1', [second])).rows[0];
  for (const [key,value] of Object.entries(permissions).filter(([key])=>key.startsWith('show_'))) {
    assert.equal(value, key === 'show_notifications', `independent default and update: ${key}`);
  }
  assert.deepEqual((await db.query('select show_logs from public.conversions_config order by user_id')).rows,
    [{show_logs:true},{show_logs:false}], 'logs preserve saved enablement and default to hidden');
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${second}',false)`);
  assert.deepEqual((await db.query('select user_id,show_notifications from public.client_module_permissions')).rows,
    [{user_id:second,show_notifications:true}], 'client sees only own saved choices');
  await assert.rejects(db.exec('update public.client_module_permissions set show_notifications=false'), /permission denied/);
  await assert.rejects(db.exec(`insert into public.client_module_permissions(user_id) values ('${first}')`), /permission denied/);
  await assert.rejects(db.exec('delete from public.client_module_permissions'), /permission denied/);
  await db.exec('reset role; set role anon');
  await assert.rejects(db.query('select * from public.client_module_permissions'), /permission denied/);
  console.log('Module defaults: migration preservation, optional sections, partial update, Logs and RLS passed.');
} finally {
  await db.close();
}
