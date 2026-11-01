import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// Run against an ephemeral Postgres WASM instance, never an application DB.
// PGlite validates SQL/permissions/state transitions; it does not certify
// contention between independent Postgres sessions or pg_net network delivery.
const modulePath = process.env.PURCHASE_INGEST_PGLITE;
if (!modulePath) throw new Error('Set PURCHASE_INGEST_PGLITE to the local @electric-sql/pglite/dist/index.js');
const { PGlite } = await import(pathToFileURL(modulePath).href);
const migrationUrl = new URL('../migrations/20261031233646_durable_purchase_ingest_queue.sql', import.meta.url);
const user = '10000000-0000-4000-8000-000000000001';
const otherUser = '10000000-0000-4000-8000-000000000002';
const payload = { action: 'PURCHASE', action_event_id: 'fixture-event', event_time: 1792609153,
  transaction_id: 'fixture-transaction', amount: 1000, currency: 'ARS', nested: { complete: 'x'.repeat(8000) } };
const context = { client_name: 'fixture', request_id: 'fixture-request', received_at: '2026-10-31T22:00:00Z',
  idempotency_keys: ['event:fixture-event', 'payment:fixture-transaction'] };

test('durable PURCHASE queue SQL and service-only contract', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create schema auth; create schema cron; create schema net;
    create role anon; create role authenticated; create role service_role bypassrls;
    grant usage on schema public, auth to anon, authenticated, service_role;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    create table public.conversions(id uuid primary key);
    create table public.conversion_inbox(id uuid primary key,user_id uuid not null references auth.users(id),payload_raw text not null);
    alter table public.conversion_inbox enable row level security;
    create policy conversion_inbox_select_own on public.conversion_inbox for select to authenticated using(user_id=auth.uid());
    grant select,insert,update on public.conversion_inbox to anon,authenticated,service_role;
    create table public.cron_config(key text primary key,value text not null);
    create table cron.job(id bigserial primary key,name text,schedule text,command text);
    create function cron.schedule(text,text,text) returns bigint language sql as $$
      insert into cron.job(name,schedule,command) values($1,$2,$3) returning id;
    $$;
    create table net.requests(id bigserial primary key,url text,body jsonb,headers jsonb,timeout integer);
    create function net.http_post(url text,body jsonb,headers jsonb,timeout_milliseconds integer)
    returns bigint language sql as $$
      insert into net.requests(url,body,headers,timeout) values($1,$2,$3,$4) returning id;
    $$;
    grant usage on schema cron,net to service_role;
    grant all on all tables in schema net to service_role;
    grant usage on all sequences in schema net to service_role;
    grant select on public.cron_config to service_role;
    insert into auth.users values('${user}'),('${otherUser}');
    insert into public.conversion_inbox values('10000000-0000-4000-8000-000000000030','${user}','original legacy truncated log');
  `);
  await db.exec(await readFile(new URL('../migrations/20260728163000_purchase_event_atomic_claims.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(migrationUrl, 'utf8'));
  await db.exec('set role service_role');
  const rows = async (sql, args = []) => (await db.query(sql, args)).rows;
  const enqueue = async (key, p = payload, c = context, owner = user) => (await rows(
    'select * from enqueue_purchase_ingest_job($1,$2,$3::jsonb,$4::jsonb)',
    [owner, key, JSON.stringify(p), JSON.stringify(c)]))[0];
  const claim = async (id = null, limit = 4) => rows('select * from claim_purchase_ingest_jobs($1,$2)', [limit, id]);
  const finish = async (job, status = 200, retryable = false, body = 'synthetic result') => (await rows(
    'select finish_purchase_ingest_job($1,$2,$3,$4,$5) as ok', [job.id, job.lease_token, status, body, retryable]))[0].ok;
  const get = async (id) => (await rows('select * from purchase_ingest_jobs where id=$1', [id]))[0];
  const expire = async (id) => rows("update purchase_ingest_jobs set lease_until=clock_timestamp()-interval '1 second' where id=$1", [id]);
  const due = async (id) => rows("update purchase_ingest_jobs set available_at=clock_timestamp()-interval '1 second' where id=$1", [id]);
  const pending = async (owner, event) => (await rows('select purchase_ingest_event_pending($1,$2) as pending', [owner, event]))[0].pending;

  let first;
  await t.test('stores payload beyond the inbox 4000-character limit with original event identity/time', async () => {
    first = await enqueue('event:fixture-event');
    assert.equal(first.inserted, true);
    assert.equal(first.status, 'queued');
    const saved = await get(first.id);
    assert.deepEqual(saved.payload, payload);
    assert.deepEqual(saved.request_context, context);
    assert.equal(saved.attempts, 0);
    assert.equal(saved.lease_token, null);
  });
  await t.test('duplicate acceptance keeps the first payload/context and another receiver gets its own job', async () => {
    const duplicate = await enqueue('event:fixture-event', { ...payload, amount: 9000 }, { ...context, request_id: 'later' });
    assert.deepEqual(duplicate, { id: first.id, status: 'queued', inserted: false });
    assert.deepEqual((await get(first.id)).payload, payload);
    assert.deepEqual((await get(first.id)).request_context, context);
    assert.notEqual((await enqueue('event:fixture-event', payload, context, otherUser)).id, first.id);
  });
  await t.test('input is immutable even through a direct privileged UPDATE', async () => {
    for (const assignment of ["payload='{}'::jsonb", "request_context='{}'::jsonb", "idempotency_key='changed'", `user_id='${otherUser}'`, "created_at=created_at-interval '1 second'"])
      await assert.rejects(rows(`update purchase_ingest_jobs set ${assignment} where id=$1`, [first.id]), /immutable/);
  });
  await t.test('invalid keys, malformed containers, oversize payload/context and aliases fail before acceptance', async () => {
    for (const key of ['', ' whitespace', 'x'.repeat(301)]) await assert.rejects(enqueue(key), /invalid_input/);
    for (const value of [null, [], 'text']) await assert.rejects(enqueue('invalid', value), /invalid_input/);
    await assert.rejects(enqueue('large', { full: 'x'.repeat(1048576) }), /invalid_input/);
    await assert.rejects(enqueue('context-large', {}, { text: 'x'.repeat(16384) }), /invalid_input/);
    for (const aliases of [null, 'bad', [1], [''], [' leading'], ['x'.repeat(301)], Array(33).fill('event:x')])
      await assert.rejects(enqueue('invalid-aliases', {}, { idempotency_keys: aliases }), /invalid_aliases/);
    assert.equal((await rows("select count(*)::int as n from purchase_ingest_jobs where idempotency_key like 'invalid%'"))[0].n, 0);
  });
  await t.test('claim chooses a requested job, grants 10-minute lease and skips active leases', async () => {
    const claimed = await claim(first.id);
    assert.equal(claimed.length, 1);
    assert.equal(claimed[0].attempts, 1);
    assert.equal(claimed[0].status, 'processing');
    assert.ok(claimed[0].lease_token);
    const duration = new Date(claimed[0].lease_until) - new Date(claimed[0].updated_at);
    assert.equal(duration, 600000);
    assert.deepEqual(await claim(first.id), []);
    await assert.rejects(claim(null, 0), /invalid_limit/);
    await assert.rejects(claim(null, 21), /invalid_limit/);
  });
  await t.test('expired lease recovers the same payload with a new token and rejects stale completions', async () => {
    const previous = await get(first.id);
    await expire(first.id);
    assert.equal(await finish(previous), false, 'Expired worker cannot complete even before reclamation');
    const [recovered] = await claim(first.id);
    assert.equal(recovered.attempts, 2);
    assert.notEqual(recovered.lease_token, previous.lease_token);
    assert.deepEqual(recovered.payload, payload);
    assert.equal(await finish(previous), false);
    assert.equal(await finish(recovered), true);
    assert.equal((await get(first.id)).status, 'completed');
  });
  await t.test('finished job cannot be leased or requeued by duplicate HTTP acceptance', async () => {
    const duplicate = await enqueue('event:fixture-event');
    assert.equal(duplicate.status, 'completed');
    assert.equal(duplicate.inserted, false);
    assert.deepEqual(await claim(first.id), []);
    assert.equal((await get(first.id)).attempts, 2);
  });
  await t.test('retry records bounded backoff and preserves payload/time; it is not immediately claimable', async () => {
    const job = await enqueue('retry');
    const [leased] = await claim(job.id);
    assert.equal(await finish(leased, 503, true), true);
    const saved = await get(job.id);
    assert.equal(saved.status, 'queued');
    assert.equal(new Date(saved.available_at) - new Date(saved.updated_at), 60000);
    assert.deepEqual(await claim(job.id), []);
    assert.deepEqual(saved.payload, payload);
    await due(job.id);
    const [retry] = await claim(job.id);
    assert.equal(retry.attempts, 2);
    assert.equal(await finish(leased, 500, true), false);
    await finish(retry, 200, false);
  });
  await t.test('eight attempts are bounded and exponential backoff never exceeds 30 minutes', async () => {
    const job = await enqueue('bounded');
    for (let attempt = 1; attempt <= 8; attempt++) {
      await due(job.id);
      const [leased] = await claim(job.id);
      assert.equal(leased.attempts, attempt);
      assert.equal(await finish(leased, 0, true), true);
      const saved = await get(job.id);
      assert.equal(saved.status, attempt < 8 ? 'queued' : 'failed');
      if (attempt < 8)
        assert.equal(new Date(saved.available_at) - new Date(saved.updated_at), Math.min(1800, 30 * 2 ** attempt) * 1000);
    }
    assert.deepEqual(await claim(job.id), []);
    assert.equal((await enqueue('bounded')).status, 'failed');
  });
  await t.test('crash on the eighth attempt becomes terminal on the next sweep', async () => {
    const job = await enqueue('crash-last');
    for (let attempt = 1; attempt <= 8; attempt++) {
      const [leased] = await claim(job.id);
      assert.equal(leased.attempts, attempt);
      await expire(job.id);
    }
    assert.deepEqual(await claim(job.id), []);
    const saved = await get(job.id);
    assert.equal(saved.status, 'failed');
    assert.equal(saved.response_body, 'purchase_ingest_attempts_exhausted');
    assert.equal(saved.lease_token, null);
  });
  await t.test('HTTP202 durable handoff is terminal; HTTP422 terminal rejection is failed', async () => {
    for (const [status, expected] of [[202, 'completed'], [422, 'failed']]) {
      const job = await enqueue('terminal-' + status);
      const [leased] = await claim(job.id);
      assert.equal(await finish(leased, status, false, 'x'.repeat(1500)), true);
      const saved = await get(job.id);
      assert.equal(saved.status, expected);
      assert.equal(saved.response_body.length, 1000);
      assert.equal(saved.lease_until, null);
      assert.deepEqual(await claim(job.id), []);
    }
  });
  await t.test('wrong job/token and malformed completion cannot change work ownership', async () => {
    const a = await enqueue('token-a'), b = await enqueue('token-b');
    const [la] = await claim(a.id), [lb] = await claim(b.id);
    assert.equal(await finish({ ...la, lease_token: lb.lease_token }), false);
    assert.equal(await finish({ ...la, id: b.id }), false);
    await assert.rejects(finish(la, 999, false), /invalid_result/);
    assert.equal((await get(a.id)).status, 'processing');
    assert.equal(await finish(la), true);
    assert.equal(await finish(lb), true);
  });
  await t.test('CAPI exclusion joins every original alias within the same receiver', async () => {
    const [receipt] = await rows('select * from claim_purchase_event($1,$2,$3)',
      [user, ['payment:prior-alias'], 'fixture-capi-event']);
    assert.equal(receipt.claimed, true);
    const job = await enqueue('event:new-alias', payload, { ...context, idempotency_keys: ['event:new-alias', 'payment:prior-alias'] });
    assert.equal(await pending(user, 'fixture-capi-event'), true);
    assert.equal(await pending(otherUser, 'fixture-capi-event'), false);
    assert.equal(await pending(user, 'different-event'), false);
    const [leased] = await claim(job.id);
    assert.equal(await pending(user, 'fixture-capi-event'), true);
    await finish(leased);
    assert.equal(await pending(user, 'fixture-capi-event'), false);
  });
  await t.test('primary key alone links an active job and terminal failure releases the exclusion', async () => {
    await rows('select * from claim_purchase_event($1,$2,$3)', [user, ['payment:primary'], 'primary-capi-event']);
    const job = await enqueue('payment:primary', payload, {});
    assert.equal(await pending(user, 'primary-capi-event'), true);
    const [leased] = await claim(job.id);
    await finish(leased, 422, false);
    assert.equal(await pending(user, 'primary-capi-event'), false);
  });
  await t.test('queue table and all operational RPCs are inaccessible to anon/authenticated', async () => {
    const functions = [
      'enqueue_purchase_ingest_job(uuid,text,jsonb,jsonb)', 'claim_purchase_ingest_jobs(integer,uuid)',
      'finish_purchase_ingest_job(uuid,uuid,integer,text,boolean)', 'purchase_ingest_event_pending(uuid,text)',
      'cron_process_purchase_ingest()',
    ];
    const [security] = await rows("select relrowsecurity, (select count(*) from pg_policies where tablename='purchase_ingest_jobs')::int policies from pg_class where oid='public.purchase_ingest_jobs'::regclass");
    assert.deepEqual(security, { relrowsecurity: true, policies: 0 });
    for (const role of ['anon', 'authenticated']) {
      for (const name of functions)
        assert.equal((await rows('select has_function_privilege($1,$2,$3) as allowed', [role, name, 'execute']))[0].allowed, false);
      await db.exec(`reset role; set role ${role}`);
      await assert.rejects(rows('select * from purchase_ingest_jobs'), /permission denied/);
      await assert.rejects(claim(), /permission denied/);
      await assert.rejects(pending(user, 'fixture'), /permission denied/);
      await db.exec('reset role; set role service_role');
    }
    for (const name of functions)
      assert.equal((await rows('select has_function_privilege($1,$2,$3) as allowed', ['service_role', name, 'execute']))[0].allowed, true);
  });
  await t.test('inbox receipt reference validates FK and preserves the historical raw log', async () => {
    const inboxId = '10000000-0000-4000-8000-000000000030';
    const before = (await rows('select * from conversion_inbox where id=$1', [inboxId]))[0];
    assert.equal(before.purchase_ingest_job_id, null, 'Migration never links historical inbox rows automatically');
    await rows('update conversion_inbox set purchase_ingest_job_id=$1 where id=$2', [first.id, inboxId]);
    await assert.rejects(rows('update conversion_inbox set purchase_ingest_job_id=$1 where id=$2',
      ['10000000-0000-4000-8000-000000000099', inboxId]), /foreign key/);
    const after = (await rows('select * from conversion_inbox where id=$1', [inboxId]))[0];
    assert.equal(after.purchase_ingest_job_id, first.id);
    assert.equal(after.payload_raw, before.payload_raw);
    const [linked] = await rows('select jobs.payload from conversion_inbox inbox join purchase_ingest_jobs jobs on jobs.id=inbox.purchase_ingest_job_id and jobs.user_id=inbox.user_id where inbox.id=$1', [inboxId]);
    assert.deepEqual(linked.payload, payload);
  });
  await t.test('inbox reader can see only its receipt UUID and cannot access payload or replace the link', async () => {
    const foreign = await enqueue('foreign-inbox-reference', payload, context, otherUser);
    const foreignInbox = '10000000-0000-4000-8000-000000000031';
    await rows('insert into conversion_inbox(id,user_id,payload_raw,purchase_ingest_job_id) values($1,$2,$3,$4)',
      [foreignInbox, otherUser, 'foreign legacy log', foreign.id]);
    await db.exec(`reset role; set request.jwt.claim.sub='${user}'; set role authenticated`);
    const visible = await rows('select id,purchase_ingest_job_id from conversion_inbox');
    assert.deepEqual(visible, [{ id: '10000000-0000-4000-8000-000000000030', purchase_ingest_job_id: first.id }]);
    assert.deepEqual(await rows('update conversion_inbox set purchase_ingest_job_id=$1 returning id', [foreign.id]), []);
    await assert.rejects(rows('select payload from purchase_ingest_jobs where id=$1', [first.id]), /permission denied/);
    await assert.rejects(rows('select jobs.payload from conversion_inbox inbox join purchase_ingest_jobs jobs on jobs.id=inbox.purchase_ingest_job_id'), /permission denied/);
    await db.exec('reset role; set role anon');
    assert.deepEqual(await rows('select * from conversion_inbox'), []);
    await db.exec('reset role; set role service_role');
    assert.equal((await rows('select purchase_ingest_job_id from conversion_inbox where id=$1', ['10000000-0000-4000-8000-000000000030']))[0].purchase_ingest_job_id, first.id);
  });
  await t.test('deleting a receipt clears only its optional inbox link and retains the historical payload', async () => {
    const removable = await enqueue('removable-receipt');
    const inboxId = '10000000-0000-4000-8000-000000000032';
    await rows('insert into conversion_inbox(id,user_id,payload_raw,purchase_ingest_job_id) values($1,$2,$3,$4)',
      [inboxId, user, 'retained audit log', removable.id]);
    await db.exec('reset role');
    await rows('delete from purchase_ingest_jobs where id=$1', [removable.id]);
    await db.exec('set role service_role');
    const [saved] = await rows('select payload_raw,purchase_ingest_job_id from conversion_inbox where id=$1', [inboxId]);
    assert.deepEqual(saved, { payload_raw: 'retained audit log', purchase_ingest_job_id: null });
  });
  await t.test('cron is scheduled each minute and sends only the authenticated empty worker request', async () => {
    await db.exec('reset role');
    const jobs = await rows('select name,schedule,command from cron.job');
    assert.deepEqual(jobs, [{ name: 'process-purchase-ingest', schedule: '* * * * *', command: 'select public.cron_process_purchase_ingest();' }]);
    await db.exec("insert into cron_config values('sync_phones_url','https://fixture.supabase.invalid/functions/v1/sync-phones'),('sync_phones_cron_secret','synthetic-cron-secret'); set role service_role");
    await rows('select cron_process_purchase_ingest()');
    const [request] = await rows('select url,body,headers,timeout from net.requests');
    assert.deepEqual(request, { url: 'https://fixture.supabase.invalid/functions/v1/conversions?process_purchase_receipts=1', body: {},
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer synthetic-cron-secret' }, timeout: 60000 });
  });
  await t.test('missing or placeholder cron config cannot dispatch', async () => {
    await db.exec("reset role; update cron_config set value='https://REPLACE_PROJECT.supabase.co/functions/v1/sync-phones' where key='sync_phones_url'; set role service_role");
    await rows('select cron_process_purchase_ingest()');
    await db.exec("reset role; delete from cron_config where key='sync_phones_cron_secret'; set role service_role");
    await rows('select cron_process_purchase_ingest()');
    assert.equal((await rows('select count(*)::int as n from net.requests'))[0].n, 1);
  });
});
