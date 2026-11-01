// Real PURCHASE handlers and retry callback; only database/transport IO is simulated.
// No credentials, network, provider operations or production database are used.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { runInNewContext } from 'node:vm';

const root = fileURLToPath(new URL('../', import.meta.url));
const ts = createRequire(path.join(root, 'frontend/package.json'))('typescript');
const now = Math.floor(Date.now() / 1000);
class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now * 1000])); } static now() { return now * 1000; } }
const owner = '19000000-0000-4000-8000-000000000001';
const landingId = '19000000-0000-4000-8000-000000000002';
const pixel = '19000001', sourceUrl = 'https://landing.example.invalid/gast';
const config = { user_id: owner, pixel_id: pixel, meta_access_token: 'fixture-not-a-token', meta_api_version: 'v25.0', meta_currency: 'ARS',
  send_contact_capi: false, send_lead_capi: false, send_purchase_capi: true, send_first_purchase_capi: true, send_repeat_purchase_capi: true,
  include_purchase_type_capi: true, repeat_purchase_capi_window_days: 30, meta_ads_only_capi: true, send_geo_capi: false, geo_use_ipapi: false };
let current, nextId = 100, externalRequests = 0;
const handlers = {}, modules = new Map();
function load(file) {
  file = path.resolve(file);
  assert.ok(file.startsWith(path.join(root, 'supabase/functions') + path.sep));
  if (modules.has(file)) return modules.get(file);
  const exports = {}; modules.set(file, exports);
  const entry = path.join(root, 'supabase/functions/conversions/index.ts');
  const source = readFileSync(file, 'utf8') + (file === entry ? '\nexports.fixtureApi={handlePurchase,handleSimplePurchase,completePurchaseEventClaim};' : '');
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, require: id => id.startsWith('https://esm.sh/@supabase/supabase-js@2') ? { createClient: () => current.db }
      : id.startsWith('.') ? load(path.resolve(path.dirname(file), id)) : (() => { throw Error('Unexpected dependency ' + id); })(),
    Deno: { env: { get: key => ({ SUPABASE_URL: 'https://database.example.invalid', SERVICE_ROLE_KEY: 'synthetic-only', CRON_SECRET: 'synthetic-cron' })[key] }, serve: fn => { handlers[path.basename(path.dirname(file))] = fn; } },
    Date: Clock, Request, Response, Headers, URL, URLSearchParams, performance, TextEncoder, TextDecoder, AbortController, AbortSignal,
    crypto: { subtle: globalThis.crypto.subtle, randomUUID: () => '19000000-0000-4000-8000-' + String(nextId++).padStart(12, '0') },
    setTimeout: (fn, _ms) => setTimeout(fn, 0), clearTimeout,
    fetch: async (input, init) => {
      const url = new URL(String(input));
      if (url.hostname !== 'graph.facebook.com') { externalRequests++; throw Error('Unexpected external request: ' + url.hostname); }
      assert.equal(init.method, 'POST');
      current.sent.push({ url: url.origin + url.pathname, payload: JSON.parse(init.body) });
      return new Response(JSON.stringify(current.failMeta ? { error: { code: 2, is_transient: true, message: 'Synthetic failure' } } : { events_received: 1 }), { status: current.failMeta ? 503 : 200 });
    },
    console: { log() {}, warn(...args) { current?.diagnostics.push(args.join(' ')); }, error(...args) { current?.diagnostics.push(args.join(' ')); } },
  }, { filename: file });
  return exports;
}
const api = load(path.join(root, 'supabase/functions/conversions/index.ts')).fixtureApi;
load(path.join(root, 'supabase/functions/retry-failed-conversions/index.ts'));

function splitTerms(text) {
  let depth = 0, start = 0; const result = [];
  for (let i = 0; i < text.length; i++) { if (text[i] === '(') depth++; if (text[i] === ')') depth--; if (text[i] === ',' && depth === 0) { result.push(text.slice(start, i)); start = i + 1; } }
  result.push(text.slice(start)); return result;
}
function field(row, key) { return key.includes('->>') ? row[key.split('->>')[0]]?.[key.split('->>')[1]] : row[key]; }
function compare(row, key, op, expected) {
  const value = field(row, key);
  if (op === 'eq') return String(value) === String(expected);
  if (op === 'neq') return value !== null && value !== undefined && String(value) !== String(expected);
  if (op === 'is') return expected === null || expected === 'null' ? value == null : String(value) === String(expected);
  if (op === 'in') return expected.map(String).includes(String(value));
  if (op === 'ilike') return new RegExp('^' + String(expected).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.') + '$', 'i').test(String(value ?? ''));
  if (op === 'gt') return value > expected;
  if (op === 'gte') return value >= expected;
  if (op === 'lt') return value < expected;
  if (op === 'lte') return value <= expected;
  throw Error('Unsupported fixture operator ' + op);
}
function expression(row, text) {
  if (text.startsWith('and(') || text.startsWith('or(')) {
    const values = splitTerms(text.slice(text.indexOf('(') + 1, -1)).map(term => expression(row, term));
    return text.startsWith('and(') ? values.every(Boolean) : values.some(Boolean);
  }
  const match = /^([^.]*)\.(eq|neq|is|in|gt|gte|lt|lte)\.(.*)$/.exec(text);
  assert.ok(match, 'Unsupported fixture expression ' + text);
  return compare(row, match[1], match[2], match[2] === 'in' ? match[3].slice(1, -1).split(',') : match[3]);
}
function fixture(provider, { contact = true, rootUrl = false, rawOnly = false } = {}) {
  const landing = { id: landingId, name: 'diana', user_id: owner, workspace_currency: 'ARS', pixel_id: pixel, landing_tag: 'SYNTHETIC' };
  const base = { id: '19000000-0000-4000-8000-000000000003', user_id: owner, landing_id: landingId, landing_name: 'diana',
    phone: '00000001', email: 'synthetic@example.invalid', fn: '', ln: '', ct: '', st: '', zip: '', country: '', currency: 'ARS', estado: 'contact', valor: 0,
    source_platform: 'landing', pixel_id: pixel, meta_pixel_id: pixel, pixel_attribution_source: 'contact',
    fbc: `fb.1.${(now - 3600) * 1000}.SyntheticClick`, fbp: `fb.1.${(now - 3600) * 1000}.123456789`, from_meta_ads: true,
    promo_code: 'SYNTHETIC-fixture', atrio_id: '19000000-0000-4000-8000-000000000004', external_id: 'synthetic-player',
    event_source_url: rootUrl ? 'https://landing.example.invalid/' : rawOnly ? '' : sourceUrl,
    contact_payload_raw: JSON.stringify({ event_source_url: sourceUrl, meta_pixel_id: pixel }), contact_event_id: 'fixture-contact', contact_event_time: now - 600,
    created_at: new Date((now - 600) * 1000).toISOString(), observaciones: '', client_ip: '', agent_user: 'synthetic-agent',
    contact_status_capi: 'enviado', lead_status_capi: '', purchase_status_capi: '', provider };
  const state = { landing, base, sent: [], queries: [], updates: [], diagnostics: [], claims: new Map(), failMeta: false };
  const tables = { conversions: contact ? [{ ...base }] : [], landings: [landing], settings: [{ id: 1, url_base: 'https://landing.example.invalid/' }],
    conversions_config: [config], conversions_pixel_configs: [], conversion_logs: [], conversion_inbox: [], profiles: [{ id: owner, nombre: 'synthetic-client' }],
    gerencias: [], gerencia_phones: [], landings_gerencias: [], whatsapp_cloud_api_assignments: [], chatrace_client_configs: [], whatsapp_cloud_api_configs: [],
    ar_name_inferred_sex: [], ar_phone_area_codes: [], cron_config: [], conversion_log_lead_backfill_replays: [] };
  const db = { async rpc(name, args) {
    if (name === 'purchase_ingest_event_pending') return { data: false, error: null };
    if (name === 'claim_purchase_event') {
      const key = args.p_user_id + ':' + args.p_idempotency_keys.join('|');
      const previous = state.claims.get(key);
      if (previous) return { data: { ...previous, claimed: false }, error: null };
      const claim = { claimed: true, claim_id: 'claim-' + state.claims.size, event_id: args.p_candidate_event_id, claim_status: 'processing' };
      state.claims.set(key, claim); return { data: claim, error: null };
    }
    if (name === 'complete_purchase_event_claim') {
      const claim = [...state.claims.values()].find(row => row.claim_id === args.p_claim_id); assert.ok(claim);
      Object.assign(claim, { conversion_id: args.p_conversion_id, claim_status: args.p_status }); return { data: null, error: null };
    }
    throw Error('Unexpected RPC ' + name);
  }, from(table) {
    assert.ok(Object.hasOwn(tables, table), 'Unexpected table ' + table);
    const predicates = [], orders = []; let limit = Infinity, single = false, mode = 'select', value, columns;
    const query = new Proxy({}, { get(_target, method) {
      if (method === 'then') return (resolve, reject) => Promise.resolve().then(() => {
        state.queries.push({ table, mode, columns });
        let rows = tables[table].filter(row => predicates.every(fn => fn(row)));
        for (const [key, options] of orders.toReversed()) rows.sort((a, b) => (field(a, key) > field(b, key) ? 1 : field(a, key) < field(b, key) ? -1 : 0) * (options?.ascending === false ? -1 : 1));
        rows = rows.slice(0, limit);
        if (mode === 'update') { state.updates.push({ table, value: structuredClone(value), ids: rows.map(row => row.id) }); rows.forEach(row => Object.assign(row, value)); }
        if (mode === 'insert') { rows = (Array.isArray(value) ? value : [value]).map(row => ({ id: '19000000-0000-4000-8000-' + String(nextId++).padStart(12, '0'), created_at: new Date(now * 1000).toISOString(), ...row })); tables[table].push(...rows); }
        return { data: structuredClone(single ? rows[0] ?? null : rows), error: null, count: rows.length };
      }).then(resolve, reject);
      return (...args) => {
        if (method === 'select') columns = args[0];
        else if (method === 'insert' || method === 'update') { mode = method; value = args[0]; }
        else if (method === 'single' || method === 'maybeSingle') single = true;
        else if (method === 'limit') limit = args[0];
        else if (method === 'order') orders.push(args);
        else if (['eq', 'neq', 'is', 'in', 'gt', 'gte', 'lt', 'lte', 'ilike'].includes(method)) predicates.push(row => compare(row, args[0], method, args[1]));
        else if (method === 'not') predicates.push(row => !compare(row, args[0], args[1], args[2]));
        else if (method === 'or') predicates.push(row => splitTerms(args[0]).some(term => expression(row, term)));
        else throw Error('Unsupported query method ' + String(method));
        return query;
      };
    } }); return query;
  } };
  return Object.assign(state, { db, tables });
}
function payload(provider, operation = 'first', explicitUrl) { return { action: 'PURCHASE', source_platform: 'atrio', target_provider: provider,
  atrio_id: '19000000-0000-4000-8000-000000000004', phone: '00000001', promo_code: 'SYNTHETIC-fixture', amount: 1000, currency: 'ARS',
  action_event_id: 'pbadmin-purchase:api2:automatic:' + operation, transaction_id: 'synthetic-bank-' + operation, event_time: now - 120,
  ...(explicitUrl === undefined ? {} : { event_source_url: explicitUrl }) }; }
async function purchase(p, simple = false) {
  const ctx = {}; const response = await api[simple ? 'handleSimplePurchase' : 'handlePurchase'](current.db, p, { ...current.landing, name: '', id: '' }, config, [], ctx);
  assert.equal(response.status, 200, await response.clone().text());
  await api.completePurchaseEventClaim(current.db, ctx, 'processed');
  return { response, row: current.tables.conversions.find(row => row.id === ctx.conversionId) };
}
function checkEvent(row, expectedUrl, expectedFbc = current.base.fbc) {
  assert.ok(row, 'Purchase row persisted'); assert.equal(row.event_source_url, expectedUrl);
  assert.equal(row.purchase_event_time, now - 120); assert.equal(row.pixel_id, pixel);
  assert.equal(row.fbc, expectedFbc); assert.equal(row.valor, 1000); assert.equal(row.currency, 'ARS');
  assert.equal(row.purchase_status_capi, 'enviado');
  const sent = current.sent.at(-1); assert.equal(sent.url, `https://graph.facebook.com/v25.0/${pixel}/events`);
  const event = sent.payload.data[0]; assert.equal(event.event_source_url, expectedUrl);
  assert.equal(event.event_id, row.purchase_event_id); assert.equal(event.event_time, now - 120);
  assert.equal(event.user_data.fbc, expectedFbc); assert.equal(event.custom_data.value, 1000);
  return event;
}
const results = [];
for (const provider of ['rey_de_ases', 'ases_del_norte', 'ganamos_net', 'multi_skin']) {
  current = fixture(provider);
  const first = await purchase(payload(provider)); checkEvent(first.row, sourceUrl);
  assert.equal(first.row.purchase_type, 'first');
  const frozen = structuredClone(first.row), sends = current.sent.length;
  await purchase(payload(provider));
  assert.equal(current.sent.length, sends); assert.deepEqual(first.row, frozen);
  const repeat = await purchase(payload(provider, 'repeat')); checkEvent(repeat.row, sourceUrl);
  assert.equal(repeat.row.purchase_type, 'repeat'); assert.notEqual(repeat.row.purchase_event_id, first.row.purchase_event_id);
  const identity = repeat.row.purchase_event_id, fbc = repeat.row.fbc;
  repeat.row.purchase_status_capi = 'error'; repeat.row.event_source_url = 'https://landing.example.invalid/';
  repeat.row.contact_payload_raw = JSON.stringify({ event_source_url: sourceUrl });
  const sendsBeforeRetry = current.sent.length;
  const retry = await handlers['retry-failed-conversions'](new Request('https://database.example.invalid/functions/v1/retry-failed-conversions', {
    method: 'POST', body: JSON.stringify({ cron_secret: 'synthetic-cron' }), headers: { 'Content-Type': 'application/json' },
  }));
  assert.equal(retry.status, 200, (await retry.clone().text()) + ' ' + JSON.stringify(current.diagnostics));
  assert.equal(current.sent.length, sendsBeforeRetry + 1, 'Retry sends exactly one Purchase');
  const retryEvent = current.sent.at(-1).payload.data[0];
  assert.equal(retryEvent.event_source_url, sourceUrl); assert.equal(retryEvent.event_id, identity); assert.equal(retryEvent.event_time, now - 120);
  assert.equal(retryEvent.user_data.fbc, fbc); assert.equal(repeat.row.purchase_status_capi, 'enviado');
  assert.equal(repeat.row.event_source_url, 'https://landing.example.invalid/', 'Retry repairs only the wire, never historical URL');
  results.push({ provider, checks: ['first', 'repeat', 'duplicate', 'retry'], status: 'passed' });
}
for (const scenario of ['raw-contact', 'explicit-root', 'simple']) {
  current = fixture('multi_skin', { rootUrl: scenario === 'raw-contact' });
  const expected = scenario === 'explicit-root' ? 'https://explicit.example.invalid/' : sourceUrl;
  const result = await purchase(payload('multi_skin', scenario, scenario === 'explicit-root' ? expected : undefined), scenario === 'simple');
  checkEvent(result.row, expected); results.push({ scenario, status: 'passed' });
}
for (const explicit of [true, false]) {
  current = fixture('multi_skin', { contact: false });
  const input = { ...payload('multi_skin', 'created-first', explicit ? sourceUrl : undefined), source_platform: 'landing', meta_pixel_id: pixel };
  const { row } = await purchase(input);
  assert.equal(current.tables.conversions.length, 1);
  assert.equal(row.purchase_type, 'first'); assert.equal(row.event_source_url, explicit ? sourceUrl : '');
  assert.equal(row.purchase_event_time, now - 120); assert.equal(row.pixel_id, pixel); assert.equal(row.fbc, '');
  assert.equal(row.valor, 1000); assert.equal(row.currency, 'ARS');
  assert.equal(row.purchase_status_capi, 'skipped_not_meta_ads'); assert.equal(current.sent.length, 0);
  assert.equal(JSON.parse(row.purchase_payload_raw).action_event_id, input.action_event_id);
  results.push({ scenario: explicit ? 'created-first-explicit-url' : 'created-first-no-trusted-url', status: 'passed' });
}
assert.equal(externalRequests, 0);
const report = { scope: 'Real PURCHASE and simple handlers plus real retry HTTP callback; in-memory DB/claim and all HTTP mocked. Provider labels exercise the shared handler, not provider APIs or SQL concurrency.',
  passed: results.reduce((total, result) => total + (result.checks?.length ?? 1), 0), externalRequests, productionWrites: 0, results };
if (process.argv.includes('--write-report')) writeFileSync(path.join(root, 'docs/validation/purchase-source-url-handler-20261031.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
