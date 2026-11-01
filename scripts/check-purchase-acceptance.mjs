// Real HTTP entrypoint and payment handlers; all database/network IO is isolated.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { runInNewContext } from "node:vm";

const root = fileURLToPath(new URL("../", import.meta.url));
const ts = createRequire(path.join(root, "frontend/package.json"))("typescript");
const owner = "11111111-1111-4111-8111-111111111111";
const requestId = "33333333-3333-4333-8333-333333333333";
const claimId = "44444444-4444-4444-8444-444444444444";
const payload = {
  action: "PURCHASE", action_event_id: "fixture-action", agency_id: 257,
  phone: "5491111111111", amount: 4000, currency: "ARS",
  confirmed_at: "2026-10-21T18:59:13Z", event_source_url: "https://landing.example.test/fixture",
  fbc: "fixture-attribution", extra: "x".repeat(8000), tail: "must survive storage",
};
const queries = [], clients = [], jobs = new Map(), claims = new Map(), logs = [], backgrounds = [];
let handler, scenario = "normal", elapsed = 0, gate, storedResolve, externalCalls = 0;
let recoveredConversion = null;
const context = { jobId: claimId, userId: owner, idempotencyKey: "action:fixture-action", leaseToken: requestId };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function createClient(_url, _key, options = {}) {
  const db = {
    options,
    from(table) {
      let operation = "select", value, single = false;
      const filters = [];
      const chain = new Proxy({}, { get(_target, method) {
        if (method === "then") return (resolve, reject) => Promise.resolve().then(async () => {
          queries.push({ table, operation, filters });
          if (table === "profiles") return { data: { id: owner, nombre: "fixture" }, error: null };
          if (table === "gerencias") return { data: [{ user_id: scenario === "foreign" ? requestId : owner }], error: null };
          if (table === "conversions_config" || table === "conversions_pixel_configs") {
            assert.fail("Public acknowledgment must precede config, attribution and Meta work");
          }
          if (table === "conversions") return { data: recoveredConversion, error: null };
          if (table === "conversion_logs") return { data: null, error: null };
          if (table === "conversion_inbox" && operation === "insert") return { data: { id: claimId, ...value }, error: null };
          return { data: single ? null : [], error: null };
        }).then(resolve, reject);
        return (...args) => {
          if (method === "insert" || method === "update") { operation = method; value = args[0]; }
          if (method === "single" || method === "maybeSingle") single = true;
          if (method === "eq") filters.push(args);
          return chain;
        };
      } });
      return chain;
    },
    async rpc(name, args) {
      queries.push({ rpc: name, args });
      if (name === "enqueue_purchase_ingest_job") {
        if (scenario === "deadline") {
          elapsed = 8001;
          await options.global.fetch("https://database.fixture.invalid");
        }
        if (scenario === "db_error") return { data: null, error: { message: "fixture unavailable" } };
        const key = args.p_user_id + ":" + args.p_idempotency_key;
        const inserted = !jobs.has(key);
        if (inserted) jobs.set(key, { id: crypto.randomUUID(), status: "queued", payload: structuredClone(args.p_payload), request_context: args.p_request_context });
        if (scenario === "commit_then_disconnect") return { data: null, error: { message: "fixture connection lost after commit" } };
        storedResolve?.();
        if (gate) await gate.promise;
        return { data: [{ id: jobs.get(key).id, status: jobs.get(key).status, inserted }], error: null };
      }
      if (name === "claim_purchase_ingest_jobs") {
        assert.equal(options.global, undefined, "Background queue IO must not retain the admission deadline");
        return { data: [], error: null };
      }
      if (name === "claim_purchase_event") {
        const key = args.p_user_id + ":" + args.p_idempotency_keys.join("|");
        if (!claims.has(key)) claims.set(key, args.p_candidate_event_id);
        return { data: [{ claimed: scenario !== "claim_busy", claim_id: claimId, event_id: claims.get(key), claim_status: "processing", conversion_id: null }], error: null };
      }
      throw Error("Unexpected RPC " + name);
    },
  };
  clients.push(db);
  return db;
}
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} }; cache.set(file, module);
  let source = readFileSync(file, "utf8");
  if (file.endsWith(path.join("conversions", "index.ts"))) source += `\nexports.fixture = {handlePurchase, handleSimplePurchase, claimPurchaseEvent, insertInboundEvent, markIngest:(db,ctx)=>purchaseIngestRequests.set(db,ctx)};`;
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(`(function(require,module,exports){${code}\n})`, {
    Deno: { env: { get: key => ({ SUPABASE_URL: "https://database.fixture.invalid", SERVICE_ROLE_KEY: "fixture-service-key" })[key] }, serve: fn => { handler = fn; } },
    EdgeRuntime: { waitUntil: task => backgrounds.push(task) },
    Request, Response, Headers, URL, URLSearchParams, crypto: globalThis.crypto,
    performance: { now: () => elapsed }, TextEncoder, TextDecoder, AbortController, AbortSignal,
    setTimeout, clearTimeout,
    fetch: () => { externalCalls++; throw Error("Network forbidden in acceptance fixture"); },
    console: Object.fromEntries(["log", "warn", "error"].map(level => [level, (...args) => logs.push({ level, args })])),
  }, { filename: file })(id => id.startsWith("https://esm.sh/@supabase/supabase-js@2") ? { createClient }
    : id.startsWith(".") ? load(path.resolve(path.dirname(file), id))
    : (() => { throw Error("Unexpected import " + id); })(), module, module.exports);
  return module.exports;
}
const api = load(path.join(root, "supabase/functions/conversions/index.ts")).fixture;
const request = (body = payload, headers = {}) => new Request("https://fixture.invalid/functions/v1/conversions?name=fixture", {
  method: "POST", headers: { "content-type": "application/json", "x-request-id": requestId, ...headers }, body: JSON.stringify(body),
});
const checks = [];

// The response cannot precede durable commit, including a slow database insert.
gate = deferred(); const stored = deferred(); storedResolve = stored.resolve;
let settled = false;
const initial = handler(request()).then(response => { settled = true; return response; });
await stored.promise;
assert.equal(settled, false);
gate.resolve(); gate = undefined; storedResolve = undefined;
const accepted = await initial;
assert.equal(accepted.status, 202);
assert.equal(accepted.headers.get("x-request-id"), requestId);
const receipt = await accepted.json();
assert.equal(receipt.accepted, true);
await Promise.all(backgrounds.splice(0));
const job = [...jobs.values()][0];
assert.equal(job.payload.extra.length, 8000); assert.equal(job.payload.tail, payload.tail);
assert.equal(job.payload.event_time, Math.floor(Date.parse(payload.confirmed_at) / 1000));
for (const key of ["action_event_id", "amount", "currency", "fbc", "event_source_url"]) assert.equal(job.payload[key], payload[key]);
assert.equal(job.request_context.request_id, requestId);
assert.ok(!JSON.stringify(job.request_context).includes("fixture-service-key"));
checks.push("202 only after durable full payload commit; dates, IDs and attribution preserved; independent background DB");

const repeated = await handler(request({ ...payload, amount: 9999 }));
assert.equal(repeated.status, 202); assert.equal((await repeated.json()).receipt_id, receipt.receipt_id);
assert.equal(jobs.size, 1); assert.equal(job.payload.amount, 4000);
checks.push("same action retry preserves the first receipt and immutable payload");

scenario = "commit_then_disconnect";
assert.equal((await handler(request({ ...payload, action_event_id: "lost-ack" }))).status, 503);
const before = jobs.size;
scenario = "normal";
assert.equal((await handler(request({ ...payload, action_event_id: "lost-ack" }))).status, 202);
assert.equal(jobs.size, before);
checks.push("lost database acknowledgment recovers the committed receipt without duplication");

for (const mode of ["db_error", "deadline"]) {
  scenario = mode; elapsed = 0;
  const response = await handler(request({ ...payload, action_event_id: mode }, { "x-tracking-diagnostics": "1" }));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).retryable, true);
  assert.ok(![...jobs.values()].some(row => row.payload.action_event_id === mode));
}
checks.push("unavailable database or exhausted total 8 second admission budget returns retryable 503 instead of false acceptance");
scenario = "normal"; elapsed = 0;

assert.equal((await handler(request({ ...payload, amount: 0 }))).status, 400);
assert.equal((await handler(request({ ...payload, extra: "x".repeat(1024 * 1024) }))).status, 413);
scenario = "foreign";
assert.equal((await handler(request())).status, 422);
scenario = "normal";
checks.push("invalid purchase, oversized payload and foreign receiver remain rejected before queueing");

const beforeForged = jobs.size;
assert.equal((await handler(request({ ...payload, action_event_id: "forged", __deferred_retry: true, __inbox_id: claimId }))).status, 202);
assert.equal(jobs.size, beforeForged + 1);
const forgedWorker = new Request("https://fixture.invalid/functions/v1/conversions?process_purchase_receipts=1", { method: "POST", body: "{}" });
assert.equal((await handler(forgedWorker)).status, 401);
checks.push("payload retry flags and public worker URL cannot grant processing authority");

// Execute both business handlers to prove a live competing claim is not a
// terminal success, and recovery does not create a second conversion after a crash.
for (const process of [api.handlePurchase, api.handleSimplePurchase]) {
  const db = createClient(); api.markIngest(db, context);
  scenario = "claim_busy";
  const busy = await process(db, payload, { user_id: owner, name: "fixture", id: claimId }, {}, [], {});
  assert.equal(busy.status, 503);
  scenario = "normal"; recoveredConversion = { id: requestId };
  const ctx = {};
  const recovered = await process(db, payload, { user_id: owner, name: "fixture", id: claimId }, {}, [], ctx);
  assert.equal(recovered.status, 200); assert.equal(ctx.conversionId, requestId); assert.equal(ctx.inboxStatus, "deduplicated");
}
recoveredConversion = null;
checks.push("both purchase handlers keep busy claims retryable and recover a persisted conversion by its original event ID");

const unprotectedDb = createClient();
api.markIngest(unprotectedDb, { ...context, idempotencyKey: "unprotected:fixture-receipt" });
const firstClaim = await api.claimPurchaseEvent(unprotectedDb, owner, { amount: 1000 });
const nextClaim = await api.claimPurchaseEvent(unprotectedDb, owner, { amount: 1000 });
assert.equal(firstClaim.eventId, nextClaim.eventId);
assert.equal(firstClaim.protectedBy[0], "unprotected:fixture-receipt");
checks.push("emitters without payment IDs still resume one receipt with a stable internal Meta event ID");

const apiPath = process.argv.find(arg => arg.startsWith("--api2-root="))?.slice(12);
if (apiPath) {
  const apiRequire = createRequire(path.resolve(apiPath, "package.json"));
  const source = readFileSync(path.resolve(apiPath, "app/helpers/tracking_http_diagnostics.helper.ts"), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", code)(apiRequire, module, module.exports);
  let attempts = 0;
  const original = JSON.stringify(payload);
  const ok = await module.exports.postTrackingEvent("https://fixture.invalid/functions/v1/conversions?name=fixture", payload, "PURCHASE", {
    post: async (url, body, config) => {
      attempts++;
      assert.equal(JSON.stringify(body), original);
      const response = await handler(new Request(url, { method: "POST", headers: { "content-type": "application/json", ...config.headers }, body: JSON.stringify(body) }));
      return { status: response.status, data: await response.json(), headers: Object.fromEntries(response.headers) };
    },
    sleep: async () => assert.fail("Accepted 202 must not schedule API2 retry"),
    log: () => {},
  });
  assert.equal(ok, true); assert.equal(attempts, 1);
  checks.push("actual local API2 tracking client accepts the Builder 202 with one attempt and no transport retry");
}

await Promise.all(backgrounds.splice(0));
assert.equal(externalCalls, 0);
assert.ok(!queries.some(query => query.table === "conversions" && query.operation !== "select"));
console.log(JSON.stringify({ passed: checks.length, externalCalls, financialWrites: 0, checks }, null, 2));
