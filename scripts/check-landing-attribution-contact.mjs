// Execute the actual Edge resolver and CONTACT handler with in-memory database IO.
// Every network request is forbidden; no real accounts, conversions or Meta events.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { runInNewContext } from "node:vm";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(path.join(root, "frontend/package.json"));
const ts = require("typescript");
const entry = path.join(root, "supabase/functions/conversions/index.ts");
const owner = "11111111-1111-4111-8111-111111111111";
const landingId = "22222222-2222-4222-8222-222222222222";
const modules = new Map();
function load(file) {
  if (modules.has(file)) return modules.get(file);
  const exports = {}; modules.set(file, exports);
  const source = readFileSync(file, "utf8") + (file === entry ? "\nexports.fixtureApi = { handleContact, resolveLandingForInbound };" : "");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(code, {
    exports,
    require: id => id.startsWith("https://esm.sh/@supabase/supabase-js@2") ? {}
      : id.startsWith(".") ? load(path.resolve(path.dirname(file), id))
      : (() => { throw new Error(`Unexpected dependency: ${id}`); })(),
    Deno: { env: { get: () => undefined }, serve() {} },
    Request, Response, Headers, URL, URLSearchParams, crypto: globalThis.crypto, performance,
    TextEncoder, TextDecoder, AbortController, AbortSignal, setTimeout, clearTimeout,
    fetch: () => { throw new Error("External calls forbidden"); },
    console: { log() {}, warn() {}, error() {} },
  }, { filename: file });
  return exports;
}
const { handleContact, resolveLandingForInbound } = load(entry).fixtureApi;
const baseLanding = { id: landingId, name: "fixture", user_id: owner, workspace_currency: "ARS", pixel_id: "123", landing_config: null };
const config = { user_id: owner, pixel_id: "987", meta_currency: "ARS", send_contact_capi: false, geo_use_ipapi: false };
const makePayload = () => {
  const now = Date.now();
  return { action: "CONTACT", source_platform: "landing", landing_id: landingId, landing_name: "fixture", event_id: "fixture-contact", event_source_url: "https://example.invalid/fixture",
    meta_pixel_id: "123", currency: "ARS", fbc: `fb.1.${now}.fixtureClick`, fbp: "fixture-fbp", from_meta_ads: true,
    landing_attribution: { version: 2, landing_id: landingId, workspace_currency: "ARS", pixel_id: "123", entry_source: "url", fbc_source: "url", captured_at: now, legacy_fbc_quarantined: false } };
};
function database(landing = baseLanding, duplicate = false) {
  const state = { inserted: [], queries: [], logs: [] };
  const db = { from(table) {
    let mode = "select", columns = "", value, single = false;
    const filters = [];
    const chain = new Proxy({}, { get(_target, key) {
      if (key === "then") return resolve => {
        state.queries.push({ table, mode, columns, filters });
        let data = single ? null : [];
        if (table === "landings") data = landing && filters.every(([column, expected]) => landing[column] === expected) ? landing : null;
        if (table === "conversions" && mode === "insert") { state.inserted.push(value); data = { id: "fixture-conversion" }; }
        if (table === "conversions" && mode === "select" && duplicate && filters.some(([column]) => column === "contact_event_id")) data = { id: "existing-conversion" };
        if (table === "conversion_logs" && mode === "insert") state.logs.push(value);
        resolve({ data, error: null });
      };
      return (...args) => {
        if (key === "select") columns = args[0];
        if (key === "single" || key === "maybeSingle") single = true;
        if (key === "eq") filters.push(args);
        if (key === "insert" || key === "update") { mode = key; value = args[0]; }
        return chain;
      };
    } });
    return chain;
  } };
  return { db, state };
}

let checks = 0;
for (const scenario of ["valid", "metadata-pixel-mismatch", "unresolved", "published-pixel", "legacy", "duplicate"]) {
  const p = makePayload();
  if (scenario === "metadata-pixel-mismatch") { p.landing_attribution.pixel_id = "999"; p.utm_campaign = "explicit-campaign"; }
  if (scenario === "legacy") delete p.landing_attribution;
  const row = scenario === "unresolved" ? null : scenario === "published-pixel" ? { ...baseLanding, pixel_id: "999", landing_config: { tracking: { pixelId: "123" } } } : baseLanding;
  const { db, state } = database(row, scenario === "duplicate");
  const resolved = await resolveLandingForInbound(db, owner, p, "fixture");
  const response = await handleContact(db, p, resolved, config, []);
  assert.equal(response.status, 200, `${scenario} must not fail Contact`);
  if (scenario === "duplicate") {
    assert.equal(state.inserted.length, 0, "Duplicate must not recreate or rewrite attribution");
    assert.match(await response.text(), /Duplicado/);
  } else {
    assert.equal(state.inserted.length, 1);
    const inserted = state.inserted[0];
    const rejected = scenario === "metadata-pixel-mismatch" || scenario === "unresolved";
    assert.equal(inserted.fbc, rejected ? "" : p.fbc, scenario);
    assert.equal(inserted.from_meta_ads, !rejected);
    assert.equal(inserted.fbp, p.fbp);
    assert.equal(inserted.contact_event_id, p.event_id);
    assert.equal(inserted.utm_campaign, p.utm_campaign ?? "");
    assert.equal(JSON.parse(inserted.contact_payload_raw).fbc, rejected ? "" : p.fbc);
    assert.equal(Boolean(resolved.attribution_scope_resolved), scenario !== "unresolved");
  }
  const lookups = state.queries.filter(q => q.table === "landings");
  assert.ok(lookups.every(q => q.filters.some(([column, value]) => column === "user_id" && value === owner)));
  assert.ok(lookups.every(q => q.columns.includes("landing_config") === (scenario !== "legacy")));
  checks++;
}
for (const action of ["LEAD", "PURCHASE", "COMPLETEREGISTRATION"]) {
  const { db, state } = database();
  await resolveLandingForInbound(db, owner, { ...makePayload(), action }, "fixture");
  assert.ok(state.queries.every(q => !q.columns.includes("landing_config")), "Other actions must not load the extra published payload");
  checks++;
}
console.log(JSON.stringify({ passed: checks, externalRequests: 0, productionWrites: 0, scope: "Actual Edge CONTACT handler and tenant-scoped landing resolver; database IO mocked, no database-trigger or live Meta claim." }, null, 2));
