// Exercise real initial and scheduled senders; all DB/HTTP traffic is simulated.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const fixtureSource = readFileSync(path.join(root, 'scripts/check-purchase-source-url.mjs'), 'utf8');
const boundary = fixtureSource.indexOf('const results = [];');
assert.ok(boundary > 0);
let setup = fixtureSource.slice(0, boundary)
  .replace("const root = fileURLToPath(new URL('../', import.meta.url));", `const root = ${JSON.stringify(root)};`)
  .replace('exports.fixtureApi={', 'exports.fixtureApi={sendToMetaCAPI,')
  .replace('ts.transpileModule(source,', `ts.transpileModule(source + (file.endsWith('retry-failed-conversions' + path.sep + 'index.ts') ? '\\nexports.fixtureRetry={retrySingleContactLeadCapiEvent};' : ''),`);
const responseLine = "return new Response(JSON.stringify(current.failMeta ? { error: { code: 2, is_transient: true, message: 'Synthetic failure' } } : { events_received: 1 }), { status: current.failMeta ? 503 : 200 });";
assert.ok(setup.includes(responseLine));
setup = setup.replace(responseLine, `const receipt = current.responses?.shift() ?? current.response ?? { status: 200, raw: '{"events_received":1}' }; return new Response(receipt.raw, { status: receipt.status });`);
setup += `\nexport const harness={api,handlers,fixture,config,owner,now,activate(state){current=state},retry:load(path.join(root,'supabase/functions/retry-failed-conversions/index.ts')).fixtureRetry.retrySingleContactLeadCapiEvent};`;
const { harness: h } = await import('data:text/javascript;base64,' + Buffer.from(setup).toString('base64'));
const cases = [
  ['empty', '', 200, true], ['invalid JSON', '<html>OK</html>', 200, true],
  ['null', 'null', 200, true], ['missing count', '{}', 200, true],
  ['string count', '{"events_received":"1"}', 200, true],
  ['zero count', '{"events_received":0}', 200, true],
  ['wrong count', '{"events_received":2}', 200, true],
  ['permanent error with count', '{"events_received":1,"error":{"code":190}}', 200, false],
  ['transient error', '{"error":{"is_transient":true}}', 200, true],
  ['rate limit', '{"error":{"code":4}}', 429, true],
  ['bad credentials', '{"error":{"code":190}}', 400, false],
];
let checks = 0;
for (const event of ['Contact', 'Lead', 'CompleteRegistration', 'Purchase']) {
  const stage = event === 'CompleteRegistration' ? 'registration' : event.toLowerCase();
  for (const [label, raw, status, retryable] of cases) {
    const state = h.fixture('rey_de_ases'), row = state.tables.conversions[0]; h.activate(state);
    const cfg = { ...h.config, meta_ads_only_capi: false, send_contact_capi: true, send_lead_capi: true, send_complete_registration_capi: true };
    Object.assign(row, { [`${stage}_event_id`]: `receipt-${stage}`, [`${stage}_event_time`]: h.now - 120,
      [`${stage}_status_capi`]: '', valor: 1000, purchase_type: 'first' });
    state.response = { raw, status };
    const ok = await h.api.sendToMetaCAPI(state.db, cfg, [], row, row.id, event, row[`${stage}_event_id`], h.now - 120,
      event === 'Purchase' ? { value: 1000, currency: 'ARS', purchase_type: 'first' } : undefined);
    assert.equal(ok, false, `${event}/${label}`);
    assert.equal(row[`${stage}_status_capi`], 'error', `${event}/${label}`);
    assert.equal(state.sent.length, retryable ? 3 : 1, `${event}/${label}`);
    const first = state.sent[0].payload;
    for (const attempt of state.sent) assert.deepEqual(attempt.payload, first, 'Uncertain sends must reuse the identical batch');
    if (event === 'Contact' || event === 'Lead') {
      assert.equal(row[`${stage}_capi_retryable`], retryable);
      const stats = Object.fromEntries(['contact','lead'].flatMap(k => ['Retried','Succeeded','Failed','Skipped'].map(v => [k+v,0])));
      await h.retry(state.db, row, event, new Map([[h.owner,cfg]]), new Map(), new Map(), new Map(), stats);
      assert.equal(row[`${stage}_status_capi`], 'error', 'Cron cannot turn an unknown receipt into sent');
      assert.equal(row[`${stage}_capi_retryable`], retryable);
      assert.equal(stats[`${stage}Succeeded`], 0);
      row[`${stage}_capi_last_retry_at`] = null;
      state.response = { status: 200, raw: '{"events_received":1}' };
      await h.retry(state.db, row, event, new Map([[h.owner,cfg]]), new Map(), new Map(), new Map(), stats);
      assert.equal(row[`${stage}_status_capi`], 'enviado');
      assert.deepEqual(state.sent.at(-1).payload.data[0], first.data[0], 'Cron preserves identity, occurrence time and data');
    }
    checks++;
  }
}
for (const raw of ['', 'null', '{}', '{"events_received":"1"}', '{"events_received":0}', '{"events_received":2}']) {
  const state = h.fixture('rey_de_ases'), row = state.tables.conversions[0]; h.activate(state);
  Object.assign(row, { purchase_event_id: 'purchase-receipt-retry', purchase_event_time: h.now - 120,
    purchase_status_capi: 'error', purchase_type: 'first', valor: 1000, estado: 'purchase' });
  state.response = { status: 200, raw };
  const request = () => new Request('https://database.example.invalid/functions/v1/retry-failed-conversions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cron_secret: 'synthetic-cron' }) });
  assert.equal((await h.handlers['retry-failed-conversions'](request())).status, 200);
  assert.equal(row.purchase_status_capi, 'error');
  assert.equal(state.sent.length, 1);
  const uncertain = structuredClone(state.sent[0].payload);
  state.response = { status: 200, raw: '{"events_received":1}' };
  assert.equal((await h.handlers['retry-failed-conversions'](request())).status, 200);
  assert.equal(row.purchase_status_capi, 'enviado');
  assert.deepEqual(state.sent.at(-1).payload, uncertain);
  checks++;
}
// Business Messaging omits event_id: an ambiguous receipt cannot safely replay.
// Exercise both the initial sender and the scheduled sender using a real route.
for (const event of ['Lead', 'Purchase']) for (const entry of ['initial', 'cron']) {
  for (const raw of ['', '{}', '{"events_received":0}', '{"events_received":2}']) {
    const state = h.fixture('rey_de_ases'), row = state.tables.conversions[0]; h.activate(state);
    const stage = event.toLowerCase();
    const cfg = { ...h.config, meta_ads_only_capi: false, send_lead_capi: true };
    state.tables.conversions_config[0] = cfg;
    const cloud = { user_id: h.owner, active: true, phone_number_id: 'fixture-phone',
      whatsapp_business_account_id: '19000003', meta_messaging_dataset_id: '19000004',
      meta_access_token: 'fixture-only', meta_api_version: 'v25.0' };
    state.tables.whatsapp_cloud_api_configs.push(cloud);
    Object.assign(row, { source_platform: 'whatsapp_cloud_api', ctwa_clid: 'synthetic-ctwa-id',
      event_source_url: 'whatsapp-cloud-api://fixture-phone', estado: stage,
      [`${stage}_event_id`]: `business-${stage}`, [`${stage}_event_time`]: h.now - 120,
      [`${stage}_status_capi`]: 'error', lead_capi_retryable: true, valor: 1000, purchase_type: 'first' });
    state.response = { status: 200, raw };
    const cronRequest = () => new Request('https://database.example.invalid/functions/v1/retry-failed-conversions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cron_secret: 'synthetic-cron' }) });
    if (entry === 'initial') {
      assert.equal(await h.api.sendToMetaCAPI(state.db, cfg, [], row, row.id, event, row[`${stage}_event_id`], h.now - 120,
        event === 'Purchase' ? { value: 1000, currency: 'ARS', purchase_type: 'first' } : undefined), false);
    } else if (event === 'Lead') {
      const stats = Object.fromEntries(['contact','lead'].flatMap(k => ['Retried','Succeeded','Failed','Skipped'].map(v => [k+v,0])));
      await h.retry(state.db, row, event, new Map([[h.owner,cfg]]), new Map(), new Map(), new Map([[h.owner,[cloud]]]), stats);
      assert.equal(stats.leadSucceeded, 0);
    } else {
      assert.equal((await h.handlers['retry-failed-conversions'](cronRequest())).status, 200);
    }
    assert.equal(state.sent.length, 1, `${event}/${entry}: unknown Business Messaging receipt must not replay immediately`);
    assert.equal(state.sent[0].payload.data[0].action_source, 'business_messaging');
    assert.ok(!('event_id' in state.sent[0].payload.data[0]), 'This route has no stable deduplication key');
    assert.equal(row[`${stage}_status_capi`], 'unconfirmed_meta_receipt');
    if (event === 'Lead') assert.equal(row.lead_capi_retryable, false);
    assert.equal((await h.handlers['retry-failed-conversions'](cronRequest())).status, 200);
    assert.equal(state.sent.length, 1, `${event}/${entry}: manual-review rows must be excluded from scheduled replay`);
    checks++;
  }
}
console.log(JSON.stringify({ status: 'passed', senderAndRetryScenarios: checks, realNetworkRequests: 0 }));
