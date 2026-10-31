// Execute the real Edge timestamp entrypoint and CAPI age policy with fake IO.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { runInNewContext } from "node:vm";

const root = fileURLToPath(new URL("../", import.meta.url));
const ts = createRequire(path.join(root, "frontend/package.json"))("typescript");
const entry = path.join(root, "supabase/functions/conversions/index.ts");
const received = 1_793_471_725;
let requests = 0;
class Clock extends Date { static now() { return received * 1000; } }
const modules = new Map();
function load(file) {
  if (modules.has(file)) return modules.get(file);
  const exports = {}; modules.set(file, exports);
  const raw = readFileSync(file, "utf8");
  const purchaseTimeStatements = file === entry
    ? [...raw.matchAll(/const purchaseEventTime = toValidEventTime\([\s\S]*?\);/g)].map(match => match[0]) : [];
  if (file === entry) assert.equal(purchaseTimeStatements.length, 2, "Cover both real PURCHASE handler selectors");
  const source = raw + (file === entry
    ? `\nexports.fixtureApi = { ensurePayloadEventTime, sendToMetaCAPI, isEventTimeTooOldForMetaCapi, purchaseTimeSelectors: [${purchaseTimeStatements.map(statement => `(p) => { ${statement} return purchaseEventTime; }`).join(",")}] };` : "");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(code, {
    exports,
    require: id => id.startsWith("https://esm.sh/@supabase/supabase-js@2") ? {}
      : id.startsWith(".") ? load(path.resolve(path.dirname(file), id))
      : (() => { throw Error(`Unexpected dependency ${id}`); })(),
    Deno: { env: { get: () => undefined }, serve() {} }, Date: Clock,
    Request, Response, Headers, URL, URLSearchParams, crypto: globalThis.crypto, performance,
    TextEncoder, TextDecoder, AbortController, AbortSignal, setTimeout, clearTimeout,
    fetch: () => { requests++; throw Error("Network prohibited in timestamp fixture"); },
    console: { log() {}, warn() {}, error() {} },
  }, { filename: file });
  return exports;
}
const api = load(entry).fixtureApi;
const config = { user_id: "fixture-owner", pixel_id: "123", meta_access_token: "fixture-not-a-token", meta_currency: "ARS", meta_api_version: "v25.0", send_purchase_capi: true, send_first_purchase_capi: true, send_repeat_purchase_capi: true, include_purchase_type_capi: true, meta_ads_only_capi: true };
function database() {
  const updates = [], logs = [];
  const db = { from(table) {
    let operation, value;
    const chain = new Proxy({}, { get(_target, key) {
      if (key === "then") return resolve => {
        if (operation === "update") { assert.equal(table, "conversions"); updates.push(value); }
        if (operation === "insert") { assert.equal(table, "conversion_logs"); logs.push(value); }
        resolve({ data: { observaciones: "" }, error: null });
      };
      return (...args) => {
        if (key === "update" || key === "insert") { operation = key; value = args[0]; }
        return chain;
      };
    } });
    return chain;
  } };
  return { db, updates, logs };
}

for (const [purchaseType, original] of [["first", 1_792_609_028], ["repeat", 1_792_609_153]]) {
  const originalIso = new Date(original * 1000).toISOString();
  const payload = { action: "PURCHASE", confirmed_at: originalIso, timestamp: original * 1000, dateTime: originalIso, action_event_id: `fixture-${purchaseType}`, transaction_id: `payment-${purchaseType}` };
  const normalized = api.ensurePayloadEventTime(payload, received);
  assert.equal(normalized.event_time, original);
  assert.equal(normalized.action_event_id, payload.action_event_id);
  assert.equal(api.ensurePayloadEventTime(normalized, received + 86400).event_time, original);
  const conflicting = api.ensurePayloadEventTime({ ...payload, event_time: original, purchase_event_time: received }, received);
  const handlerTimes = api.purchaseTimeSelectors.map(selectTime => selectTime(conflicting));
  for (const time of handlerTimes) assert.equal(time, original, "Both real handler selectors must respect explicit original event_time over a conflicting alias");
  for (const fromMeta of [true, false]) {
    const { db, updates, logs } = database();
    const row = { id: "fixture-row", user_id: "fixture-owner", source_platform: "landing", currency: "ARS", valor: 1000, pixel_id: "123", from_meta_ads: fromMeta, purchase_type: purchaseType, purchase_payload_raw: JSON.stringify(normalized), purchase_capi_route: "website", purchase_capi_route_reason: "source_not_click_to_whatsapp" };
    const processed = await api.sendToMetaCAPI(db, config, [], row, row.id, "Purchase", "stable-event", handlerTimes[purchaseType === "first" ? 0 : 1], { value: 1000, currency: "ARS", purchase_type: purchaseType });
    assert.equal(processed, true, "Intentional CAPI skip remains successfully processed");
    assert.ok(updates.some(update => update.purchase_status_capi === (fromMeta ? "skipped_old_event_time" : "skipped_not_meta_ads")));
    assert.ok(logs.length > 0);
  }
}
assert.equal(api.isEventTimeTooOldForMetaCapi(received - 7 * 86400), false);
assert.equal(api.isEventTimeTooOldForMetaCapi(received - 7 * 86400 - 1), true);
assert.equal(requests, 0);
console.log(JSON.stringify({ passed: 10, externalRequests: requests, productionWrites: 0, scope: "Real timestamp entrypoint, both PURCHASE time selectors, first/repeat CAPI age and origin policies; DB mocked, historical rows unchanged." }, null, 2));
