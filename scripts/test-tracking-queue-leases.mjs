// Local PostgreSQL-compatible execution only. Never accepts a database URL.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const modulePath = process.argv.find((arg) => arg.startsWith('--pglite-module='))?.split('=').slice(1).join('=');
const { PGlite } = await import(modulePath ? pathToFileURL(resolve(modulePath)).href : '@electric-sql/pglite');
const db = new PGlite();
const read = (name) => readFileSync(resolve(root, name), 'utf8');
let passed = 0;
async function check(name, run) { await db.exec('truncate public.tracking_queue'); await run(); passed++; console.log(`PASS ${name}`); }
async function insert(overrides = {}) {
  const row = { payload: { event_id: 'original-id', event_time: 1800000000, fbc: 'unchanged' }, event_id: 'original-id', status: 'pending', ...overrides };
  const result = await db.query(`insert into public.tracking_queue(post_url,payload,event_id,status,next_attempt_at,attempt_count,created_at,updated_at)
    values ('https://example.invalid/never-called',$1,$2,$3,now(),$4,$5,$6) returning *`,
  [JSON.stringify(row.payload), row.event_id, row.status, row.attempt_count ?? 0, row.created_at ?? new Date(), row.updated_at ?? new Date()]);
  return result.rows[0];
}
const claim = async (id = null) => (await db.query('select * from public.claim_tracking_queue(5,$1)', [id])).rows;
const finish = async (id, token, delivered) => (await db.query('select public.finish_tracking_queue($1,$2,$3,$4,$5) as changed', [id, token, delivered, 'synthetic failure', 503])).rows[0].changed;
const row = async (id) => (await db.query('select * from public.tracking_queue where id=$1', [id])).rows[0];
try {
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  const legacy = read('supabase/migrations/20260629190000_constructor_tracking_queue.sql');
  await db.exec(legacy.slice(legacy.indexOf('create table if not exists public.tracking_queue'), legacy.indexOf('create table if not exists public.cron_config')));
  await db.exec(read('supabase/migrations/20261114185112_tracking_queue_leases.sql'));
  await check('one active claim retains original event and payload', async () => {
    const original = await insert();
    const claims = (await Promise.all(Array.from({ length: 8 }, () => claim()))).flat();
    assert.equal(claims.length, 1); assert.equal(claims[0].id, original.id);
    assert.equal(claims[0].event_id, original.event_id); assert.deepEqual(claims[0].payload, original.payload);
    assert.equal(claims[0].attempt_count, 1); assert.ok(claims[0].lease_token);
    assert.equal((await claim()).length, 0);
  });
  await check('expired lease rotates token and rejects stale completion and retry', async () => {
    const original = await insert(); const first = (await claim())[0];
    await db.query("update public.tracking_queue set lease_expires_at=now()-interval '1 second' where id=$1", [original.id]);
    const recovered = (await claim())[0];
    assert.notEqual(first.lease_token, recovered.lease_token); assert.equal(recovered.attempt_count, 2);
    assert.deepEqual(recovered.payload, first.payload); assert.equal(recovered.event_id, first.event_id);
    assert.equal(await finish(original.id, first.lease_token, true), false);
    assert.equal(await finish(original.id, first.lease_token, false), false);
    assert.equal((await row(original.id)).lease_token, recovered.lease_token);
    assert.equal(await finish(original.id, recovered.lease_token, true), true);
    assert.equal((await row(original.id)).status, 'sent'); assert.equal((await claim()).length, 0);
  });
  await check('attempt consumed on claim, crash cannot reset budget, retry backs off', async () => {
    const original = await insert(); const first = (await claim())[0];
    assert.equal(await finish(original.id, first.lease_token, false), true);
    const retry = await row(original.id); assert.equal(retry.attempt_count, 1); assert.equal(retry.status, 'retry');
    assert.ok(new Date(retry.next_attempt_at).getTime() > Date.now()); assert.equal((await claim()).length, 0);
    await db.query("update public.tracking_queue set next_attempt_at=now()-interval '1 second' where id=$1", [original.id]);
    assert.equal((await claim())[0].attempt_count, 2);
  });
  await check('attempt ceiling sends no further requests and preserves review record', async () => {
    const original = await insert({ attempt_count: 11 }); const final = (await claim())[0];
    assert.equal(final.attempt_count, 12); await finish(original.id, final.lease_token, false);
    const closed = await row(original.id); assert.equal(closed.status, 'review_required');
    assert.equal(closed.last_error, 'tracking_attempt_limit'); assert.equal((await claim()).length, 0);
  });
  await check('old legacy processing is quarantined without replay', async () => {
    const old = new Date(Date.now() - 100 * 86400000);
    const original = await insert({ status: 'processing', created_at: old, updated_at: old });
    assert.equal((await claim()).length, 0); const closed = await row(original.id);
    assert.equal(closed.status, 'review_required'); assert.equal(closed.last_error, 'tracking_event_expired');
    assert.equal(closed.attempt_count, 0); assert.deepEqual(closed.payload, original.payload);
  });
  await check('unidentifiable abandoned processing requires review', async () => {
    const original = await insert({ status: 'processing', event_id: null, updated_at: new Date(Date.now() - 600000) });
    assert.equal((await claim()).length, 0); assert.equal((await row(original.id)).last_error, 'tracking_recovery_missing_event_id');
  });
  await check('active lease cannot be completed after expiration', async () => {
    const original = await insert(); const first = (await claim())[0];
    await db.query("update public.tracking_queue set lease_expires_at=now()-interval '1 second' where id=$1", [original.id]);
    assert.equal(await finish(original.id, first.lease_token, true), false);
    assert.equal((await row(original.id)).status, 'processing');
  });
  await check('database RPC access is service-only with no definer escalation', async () => {
    for (const signature of ['public.claim_tracking_queue(integer,uuid)', 'public.finish_tracking_queue(uuid,uuid,boolean,text,integer)']) {
      const result = await db.query(`select has_function_privilege('anon',$1,'execute') as anon,
        has_function_privilege('authenticated',$1,'execute') as authenticated,
        has_function_privilege('service_role',$1,'execute') as service,
        (select prosecdef from pg_proc where oid=$1::regprocedure) as definer`, [signature]);
      assert.deepEqual(result.rows[0], { anon:false, authenticated:false, service:true, definer:false });
    }
  });
  console.log(JSON.stringify({ passed, engine: 'PGlite PostgreSQL', limitations: 'Single engine; simultaneous claim calls serialize. Does not certify independent-session SKIP LOCKED contention.', networkRequests: 0 }));
} finally { await db.close(); }
