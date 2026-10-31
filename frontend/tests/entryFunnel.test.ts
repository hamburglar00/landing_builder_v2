import assert from "node:assert/strict";
import test from "node:test";
import { validateEntryFunnelBatch, validateEntryFunnelContext } from "../lib/landing/entryFunnel";
import { handleEntryFunnel } from "../lib/landing/entryFunnel.server";
const landing = "b453a8c5-a91a-4511-ac22-28bcfa4ea97c";
const flow = "ac8e34e0-6443-4661-8695-42c61620f400";
const event = { id: "19817f1f-a0a4-4cd9-a8a9-d9c6733dda41", name: "name_started", elapsed_ms: 500 };
const batch = { landing_id: landing, flow_id: flow, template: 7, events: [event] };
const request = (body: unknown, origin = "https://landing.panelbotadmin.com") => new Request("https://landing.panelbotadmin.com/api/entry-funnel", {
  method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body),
});

test("funnel input never accepts partial names, URLs, auth, advertising identifiers or arbitrary errors", () => {
  assert.deepEqual(validateEntryFunnelBatch(batch), batch);
  for (const key of ["name_partial", "name", "token", "password", "url", "fbclid", "fbc", "user_id", "owner_id", "ip"]) {
    assert.equal(validateEntryFunnelBatch({ ...batch, [key]: "secret" }), null);
    assert.equal(validateEntryFunnelBatch({ ...batch, events: [{ ...event, [key]: "secret" }] }), null);
  }
  assert.equal(validateEntryFunnelBatch({ ...batch, events: [{ ...event, error_code: "user=secret" }] }), null);
  assert.equal(validateEntryFunnelBatch({ ...batch, events: [{ ...event, name: "Purchase" }] }), null);
});
test("strict field bounds and finite skin catalog", () => {
  for (const elapsed_ms of [-1, 1.4, 86400001, "1", null]) assert.equal(validateEntryFunnelBatch({ ...batch, events: [{ ...event, elapsed_ms }] }), null);
  assert.equal(validateEntryFunnelBatch({ ...batch, events: Array(21).fill(event) }), null);
  assert.equal(validateEntryFunnelBatch({ ...batch, events: [{ ...event, skin: "foreign" }] }), null);
  assert.ok(validateEntryFunnelBatch({ ...batch, events: [{ ...event, skin: "fortu_bet", provider: "multi_skin" }] }));
  assert.equal(validateEntryFunnelBatch({ ...batch, template: "7" }), null);
});
test("stage diagnostics accept bounded timings and closed errors without free-form properties", () => {
  const details = { ...event, name: "entry_error", error_stage: "wallet", error_code: "request_timeout", status: 504, duration_ms: 3000 };
  assert.deepEqual(validateEntryFunnelBatch({ ...batch, events: [details] })?.events, [details]);
  for (const name of ["iframe_loaded", "chat_bootstrap_ready", "welcome_ready", "wallet_ready"]) assert.ok(validateEntryFunnelBatch({ ...batch, events: [{ ...event, name, duration_ms: 0 }] }));
  for (const duration_ms of [-1, 0.5, 86400001, "12", null]) assert.equal(validateEntryFunnelBatch({ ...batch, events: [{ ...details, duration_ms }] }), null);
  for (const error_stage of ["url=https://private", "provider-body", null]) assert.equal(validateEntryFunnelBatch({ ...batch, events: [{ ...details, error_stage }] }), null);
});
test("context only permits diagnostic UUIDs, current lifetime and fixed collector origins", () => {
  const ctx = { landing_id: landing, flow_id: flow, template: 7, telemetry_origin: "https://landing.panelbotadmin.com", started_at: Date.now() };
  assert.deepEqual(validateEntryFunnelContext(ctx), ctx);
  for (const telemetry_origin of ["https://evil.test", "https://landing.panelbotadmin.com@evil.test", "https://landing.panelbotadmin.com/path"]) assert.equal(validateEntryFunnelContext({ ...ctx, telemetry_origin }), null);
  assert.equal(validateEntryFunnelContext({ ...ctx, started_at: Date.now() - 86400001 }), null);
  assert.equal(validateEntryFunnelContext({ ...ctx, flow_id: "authentication-token" }), null);
  assert.deepEqual(validateEntryFunnelContext({ ...ctx, password: "ignored-not-copied" }), ctx);
});
test("collector only writes same-origin bounded allowlisted batches; response never returns data", async () => {
  let written = 0;
  const backend = { async write(value: unknown) { written++; assert.deepEqual(value, batch); return true; } };
  let result = await handleEntryFunnel(request(batch), backend);
  assert.equal(result.status, 204); assert.equal(await result.text(), "");
  assert.equal(result.headers.get("Cache-Control"), "no-store");
  assert.equal((await handleEntryFunnel(request(batch, "https://evil.test"), backend)).status, 400);
  assert.equal((await handleEntryFunnel(request({ ...batch, token: "secret" }), backend)).status, 400);
  assert.equal((await handleEntryFunnel(request({ value: "a".repeat(17000) }), backend)).status, 413);
  assert.equal(written, 1);
});
test("beacons are accepted; database refusal and outages remain bounded diagnostics responses", async () => {
  const beacon = new Request("https://landing.panelbotadmin.com/api/entry-funnel", { method: "POST", headers: { Origin: "https://landing.panelbotadmin.com", "Content-Type": "text/plain;charset=UTF-8" }, body: JSON.stringify(batch) });
  assert.equal((await handleEntryFunnel(beacon, { async write() { return true; } })).status, 204);
  assert.equal((await handleEntryFunnel(request(batch), { async write() { return false; } })).status, 429);
  assert.equal((await handleEntryFunnel(request(batch), { async write() { throw new Error("sensitive database detail"); } })).status, 503);
});
