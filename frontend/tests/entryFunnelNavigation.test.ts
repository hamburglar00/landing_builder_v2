import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { randomUUID, webcrypto } from "node:crypto";
import { buildEntryFunnelFactoryScript } from "../lib/landing/entryFunnel.client";
import { validateEntryFunnelBatch } from "../lib/landing/entryFunnel";

const landingId = "b453a8c5-a91a-4511-ac22-28bcfa4ea97c";
const storageKey = "entry-funnel:v1:" + landingId;
function fixture(storage = new Map<string, string>(), gateway = false) {
  const listeners = new Map<string, Array<(e: any) => void>>();
  const sent: any[] = [];
  let clock = 1800000000000;
  const context: any = {
    Date: class extends Date { static now() { return clock; } },
    crypto: { randomUUID, getRandomValues: webcrypto.getRandomValues.bind(webcrypto) },
    performance: { timeOrigin: clock - 100, now: () => 100, getEntriesByType: () => [] },
    document: { readyState: "loading", visibilityState: "visible", addEventListener() {}, querySelector: () => null },
    location: { origin: "https://mkt.panelbotadmin.com" }, navigator: { sendBeacon: (_: string, blob: Blob) => { sent.push(blob); return true; } },
    sessionStorage: { getItem: (k: string) => storage.get(k), setItem: (k: string, v: string) => storage.set(k, v) },
    addEventListener: (name: string, fn: (e: any) => void) => listeners.set(name, [...(listeners.get(name) || []), fn]),
    setTimeout: () => 1, clearTimeout() {}, Blob, URL,
    fetch: async (_url: string, options: RequestInit) => {
      const batch = JSON.parse(String(options.body)); sent.push(batch);
      return context.respond(batch);
    },
    respond: (batch: any) => Response.json({ accepted: true, event_ids: batch.events.map((event: any) => event.id) }),
  };
  context.window = context;
  vm.createContext(context);
  const supplied = gateway ? { landing_id: landingId, flow_id: randomUUID(), template: 7, telemetry_origin: context.location.origin, started_at: clock - 1000, engine: "constructor", release: "a".repeat(40) } : undefined;
  const api = vm.runInContext(`(${buildEntryFunnelFactoryScript()})(${JSON.stringify({ landingId, template: gateway ? 7 : 1, telemetry: { engine: "constructor", release: "a".repeat(40) } })},${JSON.stringify(supplied)})`, context);
  return { api, context, storage, sent,
    advance: (ms: number) => { clock += ms; },
    event: (name: string, event: any) => listeners.get(name)?.forEach(fn => fn(event)),
    queue: () => JSON.parse(storage.get(storageKey + ":pending") || "{}").events || [],
    settled: async () => { await new Promise(resolve => setImmediate(resolve)); },
  };
}

test("reload and BFCache have independent navigation clocks without replacing the 24h flow", () => {
  const a = fixture(), first = a.api.peekContext();
  assert.equal(first.attempt_id, undefined, "peek never invents a CTA");
  a.advance(2000); a.api.emit("phone_wait_completed", { duration_ms: 0, phone_outcome: "ready", phone_readiness: "ready" });
  const previous = a.queue().find((e: any) => e.name === "phone_wait_completed");
  assert.equal(previous.navigation_elapsed_ms, 2100);
  a.event("pageshow", { persisted: true });
  const second = a.api.peekContext();
  assert.equal(first.flow_id, second.flow_id); assert.notEqual(first.navigation_id, second.navigation_id);
  const restored = a.queue().filter((e: any) => e.name === "navigation_started").at(-1);
  assert.equal(restored.navigation_elapsed_ms, 0); assert.equal(restored.elapsed_ms, 2000);
  const b = fixture(a.storage);
  assert.equal(b.api.flowId, first.flow_id); assert.notEqual(b.api.peekContext().navigation_id, first.navigation_id);
});

test("late phone completion preserves the originating navigation and request, with no epoch on the wire", () => {
  const b = fixture(), nav = b.api.peekContext().navigation_id, request = randomUUID();
  b.advance(100); const at = b.context.Date.now(); b.advance(1500); b.event("pageshow", { persisted: true });
  b.api.emit("stage_timing", { phase: "phone_total", duration_ms: 70, navigation_id: nav, request_id: request, occurred_at_ms: at, flow_scoped: true });
  const event = b.queue().find((e: any) => e.phase === "phone_total");
  assert.equal(event.navigation_id, nav); assert.equal(event.navigation_elapsed_ms, 200);
  assert.equal(event.elapsed_ms, 100); assert.equal(event.request_id, request);
  assert.equal(event.attempt_id, undefined); assert.equal(event.occurred_at_ms, undefined);
});

test("component releases stay independent and wallet/render outcomes use the closed contract", () => {
  const b = fixture(undefined, true), request = randomUUID(), nav = randomUUID();
  b.api.emit("wallet_result", { wallet_outcome: "not_applicable", component: "chat", component_release: "c".repeat(40), navigation_id: nav, navigation_elapsed_ms: 10, request_id: request });
  b.api.emit("welcome_visible", { component: "chat", component_release: "c".repeat(40), navigation_id: nav });
  const events = b.queue();
  assert.equal(events.find((e: any) => e.component === "gateway").component_release, undefined, "unknown gateway SHA is never the landing SHA");
  const wallet = events.find((e: any) => e.name === "wallet_result");
  assert.equal(wallet.release, "a".repeat(40)); assert.equal(wallet.component_release, "c".repeat(40));
  assert.ok(validateEntryFunnelBatch({ landing_id: landingId, flow_id: b.api.flowId, template: 7, events }));
  assert.equal(validateEntryFunnelBatch({ landing_id: landingId, flow_id: b.api.flowId, template: 7, events: [{ ...wallet, wallet_outcome: "bank-secret" }] }), null);
});

test("only acknowledged UUIDs leave the queue; empty 204 and sendBeacon never acknowledge delivery", async () => {
  const b = fixture(); b.api.emit("entry_error", { error_code: "network_error" });
  const before = b.queue().map((e: any) => e.id);
  b.context.respond = () => new Response(null, { status: 204 }); b.api.flush(); await b.settled();
  assert.deepEqual(b.queue().map((e: any) => e.id), before);
  b.api.flush(true); assert.deepEqual(b.queue().filter((e: any) => e.name !== "telemetry_loss").map((e: any) => e.id), before);
  b.context.respond = () => Response.json({ accepted: true, event_ids: [before[0], randomUUID()] });
  b.api.flush(); await b.settled();
  assert.equal(b.queue().some((e: any) => e.id === before[0]), false);
  assert.equal(b.queue().some((e: any) => e.id === before[1]), true);
  assert.equal(b.queue().filter((e: any) => e.name === "telemetry_loss").length, 1);
});

test("overflow remains bounded and loss reports cannot recursively generate retries or infinite events", async () => {
  const b = fixture();
  for (let n = 0; n < 110; n++) b.api.emit("entry_error", { error_code: "network_error" });
  assert.equal(b.queue().length, 80);
  b.api.flush(); await b.settled();
  const losses = b.queue().filter((e: any) => e.name === "telemetry_loss");
  assert.equal(losses.length, 1); assert.equal(losses[0].loss_reason, "overflow");
  assert.ok(losses[0].loss_count >= 1);
  b.context.respond = () => Response.json({ accepted: false }, { status: 429 });
  for (let n = 0; n < 4; n++) { b.api.flush(); await b.settled(); }
  assert.deepEqual(b.queue().filter((e: any) => e.name === "telemetry_loss").map((e: any) => e.loss_reason).sort(), ["overflow", "rate_limited"]);
});

test("restoring a pending queue cannot send private or free-form storage fields", () => {
  const a = fixture(), original = a.queue()[0];
  a.storage.set(storageKey + ":pending", JSON.stringify({ flow_id: a.api.flowId, events: [{ ...original, password: "private", provider: "private-account", component_release: "https://private", phone_outcome: "private-phone" }] }));
  const b = fixture(a.storage);
  const restored = b.queue().find((event: any) => event.id === original.id);
  assert.ok(restored); assert.equal(restored.navigation_id, original.navigation_id);
  assert.doesNotMatch(JSON.stringify(b.queue()), /private|password|https:\/\//);
});
