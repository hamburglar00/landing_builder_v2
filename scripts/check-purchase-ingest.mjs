// Real durable-receipt module and retry HTTP handler; all DB and transport IO
// are fixtures. The separate PGlite suite verifies RPC locking and lease recovery.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { runInNewContext } from 'node:vm';

const root = fileURLToPath(new URL('../', import.meta.url));
const ts = createRequire(path.join(root, 'frontend/package.json'))('typescript');
const modules = new Map(), handlers = {}, results = [], diagnostics = [];
let activeDb, transport;
function load(file) {
  file = path.resolve(file);
  assert.ok(file.startsWith(path.join(root, 'supabase/functions') + path.sep));
  if (modules.has(file)) return modules.get(file);
  const exports = {}; modules.set(file, exports);
  runInNewContext(ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    exports,
    require: id => id.startsWith('https://esm.sh/@supabase/supabase-js@2') ? { createClient: () => activeDb }
      : id.startsWith('.') ? load(path.resolve(path.dirname(file), id)) : (() => { throw Error('Unexpected dependency'); })(),
    Deno: { env: { get: key => ({ SUPABASE_URL: 'https://database.example.invalid', SERVICE_ROLE_KEY: 'fixture-service', CRON_SECRET: 'fixture-cron' })[key] },
      serve: fn => { handlers[path.basename(path.dirname(file))] = fn; } },
    Request, Response, Headers, URL, URLSearchParams, TextEncoder, TextDecoder, Date,
    crypto: globalThis.crypto, AbortSignal, AbortController, setTimeout, clearTimeout, performance,
    fetch: async (...args) => { assert.ok(transport, 'Unexpected transport'); return transport(...args); },
    console: { log() {}, warn() {}, error(...args) { diagnostics.push(args.map(String).join(' ')); } },
  }, { filename: file });
  return exports;
}
const api = load(path.join(root, 'supabase/functions/conversions/purchase_ingest.ts'));
load(path.join(root, 'supabase/functions/retry-failed-conversions/index.ts'));
const userId = '19000000-0000-4000-8000-000000000001';
const jobId = '19000000-0000-4000-8000-000000000002';
const token = '19000000-0000-4000-8000-000000000003';
const eventTime = 1792609153;
const payload = { action: 'PURCHASE', amount: 1000, currency: 'ARS', action_event_id: 'fixture-purchase',
  event_time: eventTime, confirmed_at: new Date(eventTime * 1000).toISOString(), nested: { detail: 'a'.repeat(6000) } };
const requestContext = { clientName: 'fixture client', requestId: 'fixture-request',
  receivedAt: '2026-10-31T23:30:00Z', idempotencyKeys: ['action:fixture-purchase', 'payment:fixture-bank'] };
const input = () => ({ userId, idempotencyKey: 'action:fixture-purchase', payload: structuredClone(payload), requestContext: structuredClone(requestContext) });
const job = (overrides = {}) => ({ id: jobId, user_id: userId, idempotency_key: 'action:fixture-purchase', payload: structuredClone(payload),
  request_context: { client_name: requestContext.clientName, request_id: requestContext.requestId, received_at: requestContext.receivedAt, idempotency_keys: requestContext.idempotencyKeys },
  status: 'processing', lease_token: token, attempts: 1, ...overrides });
function rpcDb(responses = {}) {
  const calls = [];
  return { calls, async rpc(name, args) {
    calls.push({ name, args: structuredClone(args) });
    assert.ok(Object.hasOwn(responses, name), 'Unexpected RPC ' + name);
    const result = responses[name];
    return typeof result === 'function' ? result(args) : structuredClone(result);
  }, from() { throw Error('Unexpected table access'); } };
}
function workerDb(jobs, finish = true) {
  return rpcDb({ claim_purchase_ingest_jobs: { data: jobs, error: null }, finish_purchase_ingest_job: { data: finish, error: null } });
}
async function test(name, callback) {
  await callback(); results.push(name);
}
const finishArgs = db => db.calls.find(call => call.name === 'finish_purchase_ingest_job').args;

await test('enqueue persists complete payload and allowlisted context before returning receipt', async () => {
  const data = input(); data.requestContext.authorization = 'do-not-copy';
  const db = rpcDb({ enqueue_purchase_ingest_job: { data: [{ id: jobId, status: 'queued', inserted: true }], error: null } });
  const receipt = await api.enqueuePurchaseIngestJob(db, data);
  assert.equal(receipt.id, jobId); assert.equal(receipt.inserted, true);
  const sent = db.calls[0].args;
  assert.deepEqual(sent.p_payload, payload); assert.ok(JSON.stringify(sent.p_payload).length > 4000);
  assert.deepEqual(sent.p_request_context.idempotency_keys, requestContext.idempotencyKeys);
  assert.equal(sent.p_request_context.authorization, undefined);
  assert.equal(sent.p_request_context.received_at, requestContext.receivedAt);
});
for (const status of ['queued', 'processing', 'completed', 'failed']) {
  await test('duplicate receipt preserves existing ' + status + ' identity', async () => {
    const db = rpcDb({ enqueue_purchase_ingest_job: { data: [{ id: jobId, status, inserted: false }], error: null } });
    const receipt = await api.enqueuePurchaseIngestJob(db, input());
    assert.equal(receipt.id, jobId); assert.equal(receipt.status, status); assert.equal(receipt.inserted, false);
    assert.equal(db.calls.length, 1);
  });
}
for (const response of [{ data: null, error: { message: 'synthetic DB failure' } }, { data: [], error: null }]) {
  await test('enqueue never returns acknowledgment without confirmed DB receipt ' + results.length, async () => {
    const db = rpcDb({ enqueue_purchase_ingest_job: response });
    await assert.rejects(api.enqueuePurchaseIngestJob(db, input()), /purchase_ingest_/);
  });
}
await test('payload over one MiB rejected whole with 413 without RPC', async () => {
  const data = input(); data.payload.nested.detail = 'á'.repeat(600000);
  const db = rpcDb();
  await assert.rejects(api.enqueuePurchaseIngestJob(db, data), error => error instanceof api.PurchaseIngestPayloadTooLargeError && error.status === 413);
  assert.equal(db.calls.length, 0);
});
await test('oversized context and invalid aliases never reach RPC', async () => {
  for (const change of [data => { data.requestContext.clientName = 'a'.repeat(17000); },
    data => { data.requestContext.idempotencyKeys = ['']; }, data => { data.requestContext.requestId = 'bad\r\nheader'; }]) {
    const data = input(); change(data); const db = rpcDb();
    await assert.rejects(api.enqueuePurchaseIngestJob(db, data)); assert.equal(db.calls.length, 0);
  }
});
await test('worker rebuilds only in-process request with original time, full payload and trusted owner', async () => {
  const stored = job(); stored.request_context.authorization = 'do-not-copy';
  const before = structuredClone(stored); const db = workerDb([stored]);
  const stats = await api.processPurchaseIngestJobs(db, async (req, context) => {
    assert.equal(req.method, 'POST'); assert.equal(new URL(req.url).searchParams.get('name'), requestContext.clientName);
    assert.equal(req.headers.get('authorization'), null); assert.equal(req.headers.get('x-request-id'), requestContext.requestId);
    assert.deepEqual(await req.json(), payload);
    assert.equal(context.userId, userId); assert.equal(context.jobId, jobId); assert.equal(context.leaseToken, token);
    return new Response('processed', { status: 200 });
  }, { jobId, limit: 1 });
  assert.equal(stats.completed, 1); assert.deepEqual(stored, before);
  assert.equal(db.calls[0].args.p_job_id, jobId); assert.equal(finishArgs(db).p_lease_token, token);
});
await test('deferred HTTP 202 completes receipt only after handler durable handoff', async () => {
  const db = workerDb([job()]);
  const stats = await api.processPurchaseIngestJobs(db, async () => new Response('deferred', { status: 202 }));
  assert.equal(stats.completed, 1); assert.equal(finishArgs(db).p_retryable, false);
});
for (const status of [400, 401, 403, 404, 422]) {
  await test('permanent HTTP ' + status + ' finishes failed without an automatic replay', async () => {
    const db = workerDb([job()]);
    const stats = await api.processPurchaseIngestJobs(db, async () => new Response('rejected', { status }));
    assert.equal(stats.failed, 1); assert.equal(stats.completed, 0); assert.equal(finishArgs(db).p_retryable, false);
  });
}
for (const status of [408, 429, 500, 503]) {
  await test('transient HTTP ' + status + ' requests SQL backoff with same leased identity', async () => {
    const db = workerDb([job()]);
    const stats = await api.processPurchaseIngestJobs(db, async () => new Response('retry later', { status }));
    assert.equal(stats.retried, 1); assert.equal(finishArgs(db).p_job_id, jobId); assert.equal(finishArgs(db).p_retryable, true);
  });
}
await test('processor failure is retryable and does not persist exception secrets', async () => {
  const db = workerDb([job()]);
  const stats = await api.processPurchaseIngestJobs(db, async () => { throw Error('never-record-credential'); });
  assert.equal(stats.retried, 1); assert.equal(finishArgs(db).p_http_status, 503);
  assert.equal(finishArgs(db).p_response_body, 'purchase_ingest_processing_error');
});
await test('last transient attempt is reported failed to match SQL terminal policy', async () => {
  const db = workerDb([job({ attempts: 8 })]);
  const stats = await api.processPurchaseIngestJobs(db, async () => new Response('retry', { status: 503 }));
  assert.equal(stats.failed, 1); assert.equal(stats.retried, 0);
});
await test('malformed stored context is rejected without invoking business handler', async () => {
  const db = workerDb([job({ request_context: {} })]);
  const stats = await api.processPurchaseIngestJobs(db, async () => { assert.fail('Must not process invalid context'); });
  assert.equal(stats.failed, 1); assert.equal(finishArgs(db).p_http_status, 422);
});
await test('response diagnostics are bounded, without changing response classification', async () => {
  const db = workerDb([job()]);
  await api.processPurchaseIngestJobs(db, async () => new Response('a'.repeat(2000)));
  assert.equal(finishArgs(db).p_response_body.length, 1000);
});
await test('stale lease token rejection is fenced, never reported completed', async () => {
  const db = workerDb([job()], false);
  const stats = await api.processPurchaseIngestJobs(db, async () => new Response('ok'));
  assert.equal(stats.fenced, 1); assert.equal(stats.completed, 0);
});
await test('failed finish surfaces error and leaves recovery to SQL lease', async () => {
  const db = rpcDb({ claim_purchase_ingest_jobs: { data: [job()], error: null }, finish_purchase_ingest_job: { data: null, error: { message: 'offline' } } });
  await assert.rejects(api.processPurchaseIngestJobs(db, async () => new Response('ok')), /batch_incomplete/);
  assert.equal(db.calls.length, 2, 'No unfenced fallback update');
});
await test('claim failure never invokes the business handler', async () => {
  const db = rpcDb({ claim_purchase_ingest_jobs: { data: null, error: { message: 'offline' } } });
  await assert.rejects(api.processPurchaseIngestJobs(db, async () => { assert.fail('Must not run'); }), /claim_failed/);
});
await test('batch claims at most four jobs and awaits every outcome', async () => {
  let started = 0, release;
  const ready = new Promise(resolve => { release = resolve; });
  const db = workerDb([job(), job({ id: '19000000-0000-4000-8000-000000000004' })]);
  const stats = await api.processPurchaseIngestJobs(db, async () => { if (++started === 2) release(); await ready; return new Response('ok'); });
  assert.equal(db.calls[0].args.p_limit, 4); assert.equal(stats.completed, 2);
  await assert.rejects(api.processPurchaseIngestJobs(db, async () => new Response('ok'), { limit: 5 }), /invalid_claim/);
});

function privateWorkerDb({ secret = 'fixture-db-cron', fail = false } = {}) {
  const db = workerDb([]); db.authReads = 0;
  db.from = table => { assert.equal(table, 'cron_config'); db.authReads++;
    const query = { select: value => { assert.equal(value, 'value'); return query; }, eq: (key, value) => { assert.equal(key, 'key'); assert.equal(value, 'sync_phones_cron_secret'); return query; },
      maybeSingle: async () => ({ data: { value: secret }, error: fail ? { message: 'offline' } : null }) }; return query; };
  return db;
}
function workerRequest({ method = 'POST', bearer, body } = {}) {
  return new Request('https://database.example.invalid/functions/v1/conversions?process_purchase_receipts=1', {
    method, headers: bearer ? { authorization: 'Bearer ' + bearer } : {}, body,
  });
}
await test('worker rejects GET, missing bearer and body-only secret before DB claims', async () => {
  const db = privateWorkerDb();
  for (const [req, expected] of [[workerRequest({ method: 'GET' }), 405], [workerRequest(), 401], [workerRequest({ body: JSON.stringify({ cron_secret: 'fixture-cron' }) }), 401]]) {
    const response = await api.handlePurchaseIngestWorker(req, { db, processor: async () => new Response('ok') }); assert.equal(response.status, expected);
  }
  assert.equal(db.calls.length, 0); assert.equal(db.authReads, 0);
});
await test('worker accepts existing environment or database cron secret only', async () => {
  for (const bearer of ['fixture-cron', 'fixture-db-cron']) {
    const db = privateWorkerDb();
    const response = await api.handlePurchaseIngestWorker(workerRequest({ bearer }), { db, processor: async () => new Response('ok') });
    assert.equal(response.status, 200); assert.equal(db.calls.length, 1); assert.equal(db.authReads, bearer === 'fixture-cron' ? 0 : 1);
    assert.equal((await response.json()).claimed, 0);
  }
});
await test('wrong or unavailable worker authorization cannot claim jobs', async () => {
  for (const fail of [false, true]) {
    const db = privateWorkerDb({ fail });
    const response = await api.handlePurchaseIngestWorker(workerRequest({ bearer: 'unknown' }), { db, processor: async () => new Response('ok') });
    assert.equal(response.status, fail ? 503 : 401); assert.equal(db.calls.length, 0);
  }
});
await test('active event lookup uses exact tenant and event, fails closed on malformed/error result', async () => {
  for (const pending of [true, false]) {
    const db = rpcDb({ purchase_ingest_event_pending: { data: pending, error: null } });
    assert.equal(await api.hasActivePurchaseIngestEvent(db, userId, 'purchase-fixture'), pending);
    assert.equal(db.calls[0].args.p_user_id, userId); assert.equal(db.calls[0].args.p_event_id, 'purchase-fixture');
  }
  for (const response of [{ data: null, error: null }, { data: false, error: { message: 'offline' } }]) {
    const db = rpcDb({ purchase_ingest_event_pending: response });
    await assert.rejects(api.hasActivePurchaseIngestEvent(db, userId, 'purchase-fixture'), /pending_check_failed/);
  }
});

// Exercise the real retry HTTP callback at its IO boundary, rather than matching
// source text. Rows and transports are synthetic, with no production endpoints.
function retryDb({ pending, error = null, deferred = false, linkedReceipt = false, receiptError = null, receiptOwner = userId, receiptPayload = payload, profilesUnavailable = '' } = {}) {
  const calls = [], replays = [], writes = [];
  let deferredAction = '';
  const inbox = deferred ? ['LEAD', 'PURCHASE'].map((action, index) => ({ id: index + 1, user_id: userId, action, status: 'deferred',
    created_at: '2026-10-21T18:59:13Z', payload_raw: JSON.stringify({ ...payload, action }), landing_name: 'fixture' })) : [];
  if (linkedReceipt) {
    const purchase = inbox.find(row => row.action === 'PURCHASE'); assert.ok(purchase);
    purchase.purchase_ingest_job_id = jobId; purchase.payload_raw = JSON.stringify(payload).slice(0, 4000);
  }
  const receipts = linkedReceipt ? [{ id: jobId, user_id: receiptOwner, payload: structuredClone(receiptPayload) }] : [];
  const db = { calls, writes, replays, inbox, receiptReads: 0,
    async rpc(name, args) { calls.push({ name, args }); assert.equal(name, 'purchase_ingest_event_pending'); return { data: pending, error }; },
    from(table) {
      const filters = []; let mode = 'select', values, selected = '', single = false;
      const query = new Proxy({}, { get(_target, method) {
        if (method === 'then') return (resolve, reject) => Promise.resolve().then(() => {
          if (mode !== 'select') writes.push({ table, mode, values });
          if (table === 'profiles' && deferredAction === 'PURCHASE' && profilesUnavailable) {
            return { data: [], error: profilesUnavailable === 'error' ? { message: 'offline' } : null };
          }
          if (table === 'purchase_ingest_jobs') {
            db.receiptReads++;
            assert.ok(filters.some(([key, value]) => key === 'id' && value === jobId));
            assert.ok(filters.some(([key, value]) => key === 'user_id' && value === userId));
            if (receiptError) return { data: null, error: receiptError };
          }
          let rows = table === 'conversions' && selected.includes('purchase_capi_route') && !deferred
            ? [{ id: 1, user_id: userId, purchase_event_id: 'purchase-fixture' }]
            : table === 'conversion_inbox' ? inbox.filter(row => filters.every(([key, value]) => row[key] === value))
            : table === 'purchase_ingest_jobs' ? receipts.filter(row => filters.every(([key, value]) => row[key] === value))
            : table === 'profiles' ? [{ id: userId, nombre: 'fixture' }] : [];
          if (mode === 'update') rows.forEach(row => Object.assign(row, values));
          return { data: structuredClone(single ? rows[0] ?? null : rows), error: null };
        }).then(resolve, reject);
        return (...args) => {
          if (method === 'select') selected = args[0];
          else if (method === 'maybeSingle') single = true;
          else if (method === 'eq') { filters.push(args); if (table === 'conversion_inbox' && args[0] === 'action') deferredAction = args[1]; }
          else if (method === 'insert' || method === 'update') { mode = method; values = args[0]; }
          else assert.ok(['in', 'lt', 'lte', 'gt', 'gte', 'order', 'limit', 'is', 'not', 'or', 'ilike'].includes(method), 'Unexpected query method ' + String(method));
          return query;
        };
      } }); return query;
    } };
  transport = async (url, init) => {
    assert.equal(new URL(url).origin, 'https://database.example.invalid'); assert.equal(new URL(url).pathname, '/functions/v1/conversions');
    assert.equal(init.headers.Authorization, 'Bearer fixture-service');
    const replay = JSON.parse(init.body); assert.equal(replay.event_time, eventTime);
    assert.equal(replay.__deferred_retry, true); assert.ok(JSON.stringify(replay).length > 4000);
    const row = inbox.find(row => row.id === replay.__inbox_id); assert.ok(row); row.status = 'processed';
    replays.push(replay.action); return new Response('deferred handled', { status: 202 });
  };
  return db;
}
async function retry(db) {
  activeDb = db;
  return handlers['retry-failed-conversions'](new Request('https://database.example.invalid/functions/v1/retry-failed-conversions', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cron_secret: 'fixture-cron' }),
  }));
}
await test('real retry handler skips active ingest before any Purchase update or Meta send', async () => {
  const db = retryDb({ pending: true });
  const response = await retry(db); assert.equal(response.status, 200, diagnostics.join('\n'));
  assert.equal(db.calls.length, 1); assert.equal(db.writes.length, 0); assert.equal(db.replays.length, 0);
});
await test('real retry handler fails closed if active-ingest lookup is unavailable', async () => {
  const db = retryDb({ pending: null, error: { message: 'offline' } });
  const response = await retry(db); assert.equal(response.status, 500);
  assert.equal(db.calls.length, 1); assert.equal(db.writes.length, 0); assert.equal(db.replays.length, 0);
});
await test('real deferred LEAD and PURCHASE replays use service authentication and preserve full original payload', async () => {
  const db = retryDb({ deferred: true });
  const response = await retry(db); assert.equal(response.status, 200, await response.clone().text());
  assert.deepEqual(db.replays, ['LEAD', 'PURCHASE']);
});

await test('linked deferred Purchase replays full receipt despite truncated historical inbox JSON', async () => {
  const db = retryDb({ deferred: true, linkedReceipt: true });
  const historicalRaw = db.inbox.find(row => row.action === 'PURCHASE').payload_raw;
  assert.throws(() => JSON.parse(historicalRaw));
  const response = await retry(db); assert.equal(response.status, 200);
  assert.deepEqual(db.replays, ['LEAD', 'PURCHASE']); assert.equal(db.receiptReads, 1);
  assert.equal(db.inbox.find(row => row.action === 'PURCHASE').payload_raw, historicalRaw);
  assert.equal(db.writes.length, 0, 'The retry never repairs historical payload text');
});
for (const scenario of [
  { name: 'DB read failure', receiptError: { message: 'offline' } },
  { name: 'foreign receipt owner', receiptOwner: '19000000-0000-4000-8000-000000000099' },
  { name: 'malformed receipt payload', receiptPayload: null },
]) {
  await test('linked deferred Purchase keeps inbox recoverable on ' + scenario.name, async () => {
    const db = retryDb({ deferred: true, linkedReceipt: true, ...scenario });
    const before = structuredClone(db.inbox.find(row => row.action === 'PURCHASE'));
    const response = await retry(db); assert.equal(response.status, 200);
    assert.deepEqual(db.replays, ['LEAD']); assert.equal(db.receiptReads, 1, 'A failed receipt is retried by the next cron, not twenty times now');
    assert.deepEqual(db.inbox.find(row => row.action === 'PURCHASE'), before);
    assert.equal(db.writes.length, 0); assert.equal((await response.json()).deferred_purchases_failed, 1);
  });
}

for (const profilesUnavailable of ['error', 'missing']) {
  await test('linked deferred Purchase keeps its inbox and original receiver when profile is ' + profilesUnavailable, async () => {
    const db = retryDb({ deferred: true, linkedReceipt: true, profilesUnavailable });
    const before = structuredClone(db.inbox.find(row => row.action === 'PURCHASE'));
    const response = await retry(db); assert.equal(response.status, 200);
    assert.deepEqual(db.replays, ['LEAD']); assert.equal(db.receiptReads, 0);
    assert.deepEqual(db.inbox.find(row => row.action === 'PURCHASE'), before);
    assert.equal(db.writes.length, 0); assert.equal((await response.json()).deferred_purchases_failed, 1);
  });
}

// Reuse the broader real-handler fixture for races after selection and just
// before Meta. It supplies valid attribution/config, so a missing guard would
// reach its intercepted Meta transport rather than pass by skipping config.
const sourceFixture = readFileSync(path.join(root, 'scripts/check-purchase-source-url.mjs'), 'utf8');
const fixtureBoundary = sourceFixture.indexOf('const results = [];'); assert.ok(fixtureBoundary > 0);
let setup = sourceFixture.slice(0, fixtureBoundary)
  .replace("const root = fileURLToPath(new URL('../', import.meta.url));", `const root = ${JSON.stringify(root)};`);
setup += '\nexport const harness={fixture,payload,purchase,handlers,activate(state){current=state}};';
const { harness } = await import('data:text/javascript;base64,' + Buffer.from(setup).toString('base64'));
for (const scenario of ['completed-after-selection', 'completed-before-send', 'active-before-send', 'changed-owner', 'changed-event-id', 'state-read-error']) {
  await test('real retry preserves final state and does not send on ' + scenario, async () => {
    const state = harness.fixture('multi_skin'); harness.activate(state);
    const { row } = await harness.purchase(harness.payload('multi_skin', scenario));
    row.purchase_status_capi = 'error'; state.sent.length = 0; state.updates.length = 0;
    let pendingCalls = 0, freshReads = 0;
    state.db.rpc = async (name, args) => {
      assert.equal(name, 'purchase_ingest_event_pending'); assert.equal(args.p_event_id, row.purchase_event_id);
      pendingCalls++;
      if ((scenario === 'completed-after-selection' && pendingCalls === 1) || (scenario === 'completed-before-send' && pendingCalls === 2)) row.purchase_status_capi = 'enviado';
      if (scenario === 'changed-owner') row.user_id = '19000000-0000-4000-8000-000000000099';
      if (scenario === 'changed-event-id') row.purchase_event_id = 'changed-after-selection';
      return { data: scenario === 'active-before-send' && pendingCalls === 2, error: null };
    };
    const from = state.db.from.bind(state.db);
    state.db.from = table => {
      const query = from(table); let selected = '';
      const wrapped = new Proxy({}, { get(_target, method) {
        if (method === 'then') return (resolve, reject) => Promise.resolve().then(async () => {
          if (table === 'conversions' && selected === 'id, user_id, purchase_event_id, purchase_status_capi') {
            freshReads++;
            if (scenario === 'state-read-error') return { data: null, error: { message: 'offline' } };
          }
          return await query;
        }).then(resolve, reject);
        return (...args) => { if (method === 'select') selected = args[0]; query[method](...args); return wrapped; };
      } }); return wrapped;
    };
    const response = await harness.handlers['retry-failed-conversions'](new Request('https://database.example.invalid/functions/v1/retry-failed-conversions', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cron_secret: 'synthetic-cron' }),
    }));
    assert.equal(response.status, scenario === 'state-read-error' ? 500 : 200, await response.clone().text());
    assert.equal(state.sent.length, 0, scenario);
    assert.equal(state.updates.filter(update => ['purchase_status_capi', 'purchase_event_id', 'purchase_event_time'].some(key => Object.hasOwn(update.value, key))).length, 0,
      'No terminal delivery state, event identity or occurrence date is overwritten');
    assert.equal(pendingCalls, ['completed-before-send', 'active-before-send'].includes(scenario) ? 2 : 1);
    assert.equal(freshReads, scenario === 'completed-before-send' ? 2 : 1);
    assert.equal(row.purchase_status_capi, scenario.startsWith('completed-') ? 'enviado' : 'error');
  });
}

for (const missingId of ['', null]) {
  await test('legacy retry with ' + (missingId === null ? 'null' : 'empty') + ' event ID sends once after persisting its generated identity', async () => {
    const state = harness.fixture('multi_skin'); harness.activate(state);
    const { row } = await harness.purchase(harness.payload('multi_skin', 'legacy-identity'));
    const originalTime = row.purchase_event_time;
    row.purchase_event_id = missingId; row.purchase_status_capi = 'error'; state.sent.length = 0;
    const response = await harness.handlers['retry-failed-conversions'](new Request('https://database.example.invalid/functions/v1/retry-failed-conversions', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cron_secret: 'synthetic-cron' }),
    }));
    assert.equal(response.status, 200, await response.clone().text()); assert.equal(state.sent.length, 1);
    assert.ok(row.purchase_event_id); assert.equal(row.purchase_status_capi, 'enviado');
    assert.equal(state.sent[0].payload.data[0].event_id, row.purchase_event_id);
    assert.equal(row.purchase_event_time, originalTime); assert.equal(state.sent[0].payload.data[0].event_time, originalTime);
  });
}

console.log(JSON.stringify({ passed: results.length, failed: 0, productionWrites: 0, realNetworkRequests: 0,
  scope: 'Real receipt/worker module and retry handler with synthetic DB/transport. A separate PGlite suite verifies SQL state transitions, permissions and recovery; independent-session concurrency is not certified.', tests: results }, null, 2));
