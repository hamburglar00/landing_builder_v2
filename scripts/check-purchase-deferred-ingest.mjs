// Real accepted-Purchase handler; reuses the source-URL fixture's DB/HTTP adapter.
// Only the inbox's SQL errors/uniqueness are simulated here. No network or money operations.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const fixtureSource = readFileSync(path.join(root, 'scripts/check-purchase-source-url.mjs'), 'utf8');
const boundary = fixtureSource.indexOf('const results = [];');
assert.ok(boundary > 0, 'Shared handler fixture boundary exists');
let setup = fixtureSource.slice(0, boundary);
setup = setup.replace("const root = fileURLToPath(new URL('../', import.meta.url));", `const root = ${JSON.stringify(root)};`);
assert.ok(setup.includes('exports.fixtureApi={'), 'Shared fixture exposes real handler functions');
setup = setup.replace('exports.fixtureApi={', 'exports.fixtureApi={processAcceptedPurchase,');
setup += '\nexport const harness={api,fixture,payload,owner,now,activate(state){current=state},externalRequests(){return externalRequests}};';
const { harness } = await import('data:text/javascript;base64,' + Buffer.from(setup).toString('base64'));
const jobId = '19000000-0000-4000-8000-000000000040';
const foreignOwner = '19000000-0000-4000-8000-000000000099';
const context = { jobId, userId: harness.owner, idempotencyKey: 'action:pbadmin-purchase:api2:automatic:deferred-fixture', leaseToken: '19000000-0000-4000-8000-000000000041' };
const results = [];

function fixture({ failInsert = 0, failUpdate = 0, foreignConflict = false } = {}) {
  const state = harness.fixture('multi_skin', { contact: false });
  state.tables.conversion_inbox.push({ id: '19000000-0000-4000-8000-000000000030', user_id: harness.owner,
    action: 'LEAD', status: 'deferred', phone: '00000001', created_at: new Date(harness.now * 1000).toISOString(), payload_raw: '{}' });
  if (foreignConflict) state.tables.conversion_inbox.push({ id: jobId, user_id: foreignOwner,
    action: 'PURCHASE', status: 'deferred', phone: '00000001', action_event_id: 'pbadmin-purchase:api2:automatic:deferred-fixture', promo_code: '', payload_raw: 'foreign-preserved' });
  const from = state.db.from.bind(state.db), rpc = state.db.rpc.bind(state.db);
  const counters = { insertFailures: 0, updateFailures: 0, uniqueConflicts: 0 };
  state.db.from = table => {
    const query = from(table);
    if (table !== 'conversion_inbox') return query;
    let mode = 'select', value;
    const wrapped = new Proxy({}, { get(_target, method) {
      if (method === 'then') return (resolve, reject) => Promise.resolve().then(async () => {
        if (mode === 'insert' && failInsert-- > 0) { counters.insertFailures++; return { data: null, error: { code: '08006', message: 'synthetic inbox insert unavailable' } }; }
        if (mode === 'update' && failUpdate-- > 0) { counters.updateFailures++; return { data: null, error: { code: '08006', message: 'synthetic inbox update unavailable' } }; }
        if (mode === 'insert' && state.tables.conversion_inbox.some(row =>
          (value.id && row.id === value.id) ||
          (value.action === 'PURCHASE' && row.action === 'PURCHASE' && value.action_event_id &&
            row.user_id === value.user_id && row.action_event_id === value.action_event_id &&
            (row.promo_code ?? '') === (value.promo_code ?? '') &&
            !row.coelsa_id && !row.transaction_id && !value.coelsa_id && !value.transaction_id))) {
          counters.uniqueConflicts++; return { data: null, error: { code: '23505', message: 'synthetic inbox identity conflict' } };
        }
        return await query;
      }).then(resolve, reject);
      return (...args) => {
        if (method === 'insert' || method === 'update') { mode = method; value = args[0]; }
        query[method](...args); return wrapped;
      };
    } });
    return wrapped;
  };
  state.db.rpc = async (name, args) => {
    if (name === 'claim_purchase_event') {
      const key = args.p_user_id + ':' + args.p_idempotency_keys.join('|');
      const previous = state.claims.get(key);
      if (previous?.claim_status === 'error') {
        previous.claim_status = 'processing'; return { data: { ...previous, claimed: true }, error: null };
      }
    }
    const result = await rpc(name, args);
    if (name === 'complete_purchase_event_claim' && !['processed', 'deduplicated', 'error'].includes(args.p_status)) {
      // The existing PostgreSQL RPC represents deferred (not completed) claims as error.
      [...state.claims.values()].find(row => row.claim_id === args.p_claim_id).claim_status = 'error';
    }
    return result;
  };
  harness.activate(state);
  return Object.assign(state, { counters });
}

function input() {
  return { ...harness.payload('multi_skin', 'deferred-fixture'), source_platform: 'landing', promo_code: '',
    nested: { original: 'fixture-original-'.repeat(500) } };
}
function legacyInbox(state) {
  const original = { ...input(), promo_code: 'SYNTHETIC-fixture' };
  delete original.transaction_id;
  const truncated = JSON.stringify(original).slice(0, 4000);
  assert.equal(truncated.length, 4000);
  assert.throws(() => JSON.parse(truncated), 'The legacy raw log is genuinely truncated JSON');
  const inbox = { id: '19000000-0000-4000-8000-000000000070', user_id: harness.owner,
    action: 'PURCHASE', status: 'received', phone: original.phone, action_event_id: original.action_event_id,
    promo_code: original.promo_code, coelsa_id: '', transaction_id: '', payload_raw: truncated, purchase_ingest_job_id: null };
  state.tables.conversion_inbox.push(inbox);
  return { original, inbox, truncated };
}
async function invoke(payload = input()) {
  const request = new Request('https://database.example.invalid/functions/v1/conversions?name=synthetic-client', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
  });
  return harness.api.processAcceptedPurchase(request, context);
}
function assertNoEffects(state) {
  assert.equal(state.tables.conversions.length, 0, 'Deferred Purchase has no conversion yet');
  assert.equal(state.sent.length, 0, 'Deferred Purchase cannot call Meta');
  assert.equal(harness.externalRequests(), 0, 'No real transport');
}
function purchaseInboxes(state) { return state.tables.conversion_inbox.filter(row => row.action === 'PURCHASE' && row.user_id === harness.owner); }
async function check(name, callback) { await callback(); results.push(name); }

await check('inbox INSERT failure returns retryable 503 instead of losing accepted work', async () => {
  const state = fixture({ failInsert: 1 });
  assert.equal((await invoke()).status, 503);
  assert.equal(state.counters.insertFailures, 1); assert.equal(purchaseInboxes(state).length, 0);
  assertNoEffects(state);
});
await check('inbox deferred UPDATE failure returns retryable 503', async () => {
  const state = fixture({ failUpdate: 1 });
  assert.equal((await invoke()).status, 503);
  assert.equal(state.counters.updateFailures, 1);
  assert.equal(purchaseInboxes(state).length, 1); assert.equal(purchaseInboxes(state)[0].status, 'received');
  assertNoEffects(state);
});
await check('retry after failed UPDATE resumes the same inbox and original payload', async () => {
  const state = fixture({ failUpdate: 1 });
  const original = input();
  assert.equal((await invoke(original)).status, 503);
  const inbox = purchaseInboxes(state)[0], storedPayload = inbox.payload_raw;
  assert.equal(inbox.id, jobId);
  assert.equal((await invoke(original)).status, 202);
  assert.equal(state.counters.uniqueConflicts, 1); assert.equal(purchaseInboxes(state).length, 1);
  assert.equal(inbox.status, 'deferred'); assert.equal(inbox.payload_raw, storedPayload);
  assert.equal(JSON.parse(inbox.payload_raw).event_time, original.event_time);
  assert.equal(JSON.parse(inbox.payload_raw).action_event_id, original.action_event_id);
  assertNoEffects(state);
});
await check('valid 202 handoff retains full JSON beyond the old 4000-character log limit', async () => {
  const state = fixture(); const original = input();
  assert.equal((await invoke(original)).status, 202);
  const inbox = purchaseInboxes(state)[0];
  assert.equal(inbox.id, jobId); assert.equal(inbox.purchase_ingest_job_id, jobId);
  assert.equal(inbox.status, 'deferred'); assert.ok(inbox.payload_raw.length > 4000);
  assert.deepEqual(JSON.parse(inbox.payload_raw).nested, original.nested);
  assertNoEffects(state);
});
await check('legacy action-and-promo unique conflict preserves truncated raw log and links full receipt before 202', async () => {
  const state = fixture(); const { original, inbox, truncated } = legacyInbox(state);
  const response = await invoke(original);
  assert.equal(response.status, 202); assert.equal(state.counters.uniqueConflicts, 1);
  assert.equal(purchaseInboxes(state).length, 1); assert.notEqual(inbox.id, jobId);
  assert.equal(inbox.status, 'deferred'); assert.equal(inbox.purchase_ingest_job_id, jobId);
  assert.equal(inbox.payload_raw, truncated, 'Historical inbox log is never rewritten');
  assertNoEffects(state);
});
await check('failed legacy inbox receipt-link UPDATE returns 503 and retries the same original inbox', async () => {
  const state = fixture({ failUpdate: 1 }); const { original, inbox, truncated } = legacyInbox(state);
  assert.equal((await invoke(original)).status, 503);
  assert.equal(state.counters.updateFailures, 1); assert.equal(state.counters.uniqueConflicts, 1);
  assert.equal(inbox.purchase_ingest_job_id, null); assert.equal(inbox.status, 'received');
  assert.equal(inbox.payload_raw, truncated); assert.equal(purchaseInboxes(state).length, 1);
  assert.equal((await invoke(original)).status, 202);
  assert.equal(purchaseInboxes(state).length, 1); assert.equal(inbox.purchase_ingest_job_id, jobId);
  assert.equal(inbox.status, 'deferred'); assert.equal(inbox.payload_raw, truncated);
  assertNoEffects(state);
});
await check('conflicting inbox owned by another receiver is never adopted or modified', async () => {
  const state = fixture({ foreignConflict: true });
  const foreign = state.tables.conversion_inbox.find(row => row.user_id === foreignOwner), before = structuredClone(foreign);
  assert.equal((await invoke()).status, 503);
  assert.equal(state.counters.uniqueConflicts, 1); assert.equal(purchaseInboxes(state).length, 0);
  assert.deepEqual(foreign, before); assertNoEffects(state);
});
await check('public deferred-control fields in an accepted payload cannot select another inbox', async () => {
  const state = fixture();
  const foreignId = '19000000-0000-4000-8000-000000000088';
  const foreign = { id: foreignId, user_id: foreignOwner, action: 'PURCHASE', status: 'received', payload_raw: 'foreign-preserved' };
  state.tables.conversion_inbox.push(foreign); const before = structuredClone(foreign);
  assert.equal((await invoke({ ...input(), __deferred_retry: true, __inbox_id: foreignId, purchase_ingest_job_id: foreignId })).status, 202);
  assert.equal(purchaseInboxes(state)[0].id, jobId); assert.equal(purchaseInboxes(state)[0].purchase_ingest_job_id, jobId);
  assert.deepEqual(foreign, before); assertNoEffects(state);
});

console.log(JSON.stringify({ scope: 'Real processAcceptedPurchase and handlers; simulated SQL errors/uniqueness, all HTTP mocked. This is not a PostgreSQL concurrency test.',
  passed: results.length, externalRequests: harness.externalRequests(), productionWrites: 0, results }, null, 2));
