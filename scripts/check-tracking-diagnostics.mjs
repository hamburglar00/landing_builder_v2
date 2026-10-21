// Actual Edge handler, fake database IO. Optional local API2 client: no sockets or real events.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { runInNewContext } from "node:vm";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(path.join(root, "frontend/package.json"));
const ts = require("typescript"), logs = [], storedLogs = [], queries = [];
let scenario = "foreign", handler;
const owner = "11111111-1111-4111-8111-111111111111";
const payload = { action: "PURCHASE", action_event_id: 117342, manager_id: 1010, agency_id: 257, amount: 4000, phone: "5491111111111", full_name: "Private Person" };
function createClient() {
  return { from(table) {
    let single = false;
    const chain = new Proxy({}, { get(_target, key) {
      if (key === "then") return resolve => {
        queries.push(table);
        const data = table === "profiles" ? { id: owner, nombre: "fixture" }
          : table === "gerencias" ? [{ user_id: "22222222-2222-4222-8222-222222222222", workspace_currency: "ARS" }]
          : single ? null : [];
        resolve({ data, error: table === "gerencias" && scenario === "unavailable" ? { code: "SYNTHETIC", message: "Synthetic database unavailable" } : null });
      };
      return (...args) => {
        if (key === "single" || key === "maybeSingle") single = true;
        if (key === "insert") {
          assert.equal(table, "conversion_logs", "Rejected events must never mutate conversions or claims");
          storedLogs.push(args[0]);
        }
        return chain;
      };
    } });
    return chain;
  } };
}
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} }; cache.set(file, module);
  const localRequire = id => id.startsWith("https://esm.sh/@supabase/supabase-js@2") ? { createClient }
    : id.startsWith(".") ? load(path.resolve(path.dirname(file), id)) : (() => { throw new Error("Unexpected import " + id); })();
  const js = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(`(function(require,module,exports){${js}\n})`, {
    Deno: { env: { get: key => ({ SUPABASE_URL: "https://fixture.invalid", SERVICE_ROLE_KEY: "fixture-only" })[key] }, serve: fn => { handler = fn; } },
    Request, Response, Headers, URL, URLSearchParams, crypto: globalThis.crypto, performance: globalThis.performance,
    TextEncoder, TextDecoder, AbortController, AbortSignal, setTimeout, clearTimeout,
    fetch: async () => { throw new Error("External calls forbidden"); },
    console: Object.fromEntries(["log", "warn", "error"].map(level => [level, (...args) => logs.push({ level, args })])),
  }, { filename: file })(localRequire, module, module.exports);
  return module.exports;
}
load(path.join(root, "supabase/functions/conversions/index.ts"));
assert.equal(typeof handler, "function");
const requestId = "33333333-3333-4333-8333-333333333333";
const request = (body = payload, headers = {}) => new Request("https://fixture.invalid/functions/v1/conversions?name=fixture", {
  method: "POST", headers: { "Content-Type": "application/json", "X-Request-ID": requestId, ...headers }, body: JSON.stringify(body),
});
const checks = [];
for (const structured of [false, true]) {
  const response = await handler(request(payload, structured ? { "X-Tracking-Diagnostics": "1" } : {}));
  assert.equal(response.status, 422);
  assert.equal(response.headers.get("X-Request-ID"), requestId);
  if (structured) {
    const body = await response.json();
    assert.equal(body.error_code, "tenant_identifier_mismatch");
    assert.equal(body.details.signal, "gerencia");
    assert.equal(body.details.reason, "foreign_owner");
    assert.equal(body.request_id, requestId);
  } else assert.equal(await response.text(), "Evento rechazado: los identificadores no corresponden al cliente receptor");
  const log = JSON.parse(storedLogs.at(-1).detail);
  assert.equal(log.request_id, requestId);
  assert.equal(log.action_event_id, "117342");
  assert.equal(log.reason, "foreign_owner");
  assert.equal(log.error_code, "tenant_identifier_mismatch");
  checks.push(structured ? "structured 422 with precise tenant diagnosis" : "legacy 422 unchanged with correlated database log");
}
scenario = "unavailable";
const unavailable = await handler(request(payload, { "X-Tracking-Diagnostics": "1" }));
assert.equal(unavailable.status, 503);
assert.equal((await unavailable.json()).error_code, "tenant_validation_unavailable");
checks.push("database lookup failure stays 503 and distinguishable from a permanent rejection");
scenario = "foreign";
const preflight = await handler(new Request("https://fixture.invalid/conversions", { method: "OPTIONS" }));
assert.equal(preflight.status, 200);
for (const header of ["x-request-id", "x-tracking-attempt", "x-tracking-diagnostics"]) assert.ok(preflight.headers.get("Access-Control-Allow-Headers").includes(header));
checks.push("browser preflight permits correlation and structured diagnostics headers");
const missing = await handler(new Request("https://fixture.invalid/conversions", { method: "POST", headers: { "X-Tracking-Diagnostics": "1" } }));
assert.equal(missing.status, 400); assert.equal((await missing.json()).error_code, "client_name_required");
checks.push("early errors include structured codes before creating a database client");

const apiPath = process.argv.find(arg => arg.startsWith("--api2-root="))?.slice(12);
if (apiPath) {
  const apiRequire = createRequire(path.resolve(apiPath, "package.json"));
  const source = readFileSync(path.resolve(apiPath, "app/helpers/tracking_http_diagnostics.helper.ts"), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} }; new Function("require", "module", "exports", js)(apiRequire, module, module.exports);
  const records = [], attempts = [], original = JSON.stringify(payload);
  const ok = await module.exports.postTrackingEvent("https://fixture.invalid/functions/v1/conversions?name=fixture", payload, "PURCHASE (marketing)", {
    post: async (url, body, config) => {
      assert.equal(JSON.stringify(body), original);
      const response = await handler(new Request(url, { method: "POST", headers: { "Content-Type": "application/json", ...config.headers }, body: JSON.stringify(body) }));
      attempts.push(config.headers["X-Request-ID"]);
      throw { response: { status: response.status, data: await response.json(), headers: Object.fromEntries(response.headers) } };
    }, sleep: async () => {}, log: (_level, record) => records.push(record),
  });
  assert.equal(ok, false); assert.equal(records.length, 3); assert.equal(new Set(attempts).size, 1);
  for (const record of records) {
    assert.equal(record.request_id, record.response_request_id);
    assert.equal(record.response_data.request_id, record.request_id);
    assert.equal(record.response_data.error_code, "tenant_identifier_mismatch");
    assert.equal(record.response_data.details.reason, "foreign_owner");
  }
  for (const row of storedLogs.slice(-3)) assert.equal(JSON.parse(row.detail).request_id, attempts[0]);
  for (const sensitive of [payload.phone, payload.full_name]) assert.ok(!JSON.stringify(records).includes(sensitive));
  checks.push("local API2 receives the real handler error with the same trace across all three attempts and database logs");
}
assert.ok(!queries.includes("conversions") && !queries.includes("purchase_event_claims"));
console.log(JSON.stringify({ passed: checks.length, externalCalls: 0, financialWrites: 0, checks }, null, 2));
