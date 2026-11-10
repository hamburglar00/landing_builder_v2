import assert from "node:assert/strict";
import { randomUUID, webcrypto } from "node:crypto";
import test from "node:test";
import vm from "node:vm";
import { gzipSync } from "node:zlib";
import { buildLandingEntryFunnelScript, publicEntryFunnelMetadata } from "../lib/landing/entryFunnel.bootstrap";
import { buildEntryFunnelFactoryScript } from "../lib/landing/entryFunnel.client";
import { renderTemplate7RuntimeAsset } from "../components/public-landing/template7RuntimeAsset";
import { validateEntryFunnelBatch, validateEntryFunnelContext, type EntryFunnelTemplate } from "../lib/landing/entryFunnel";

const landingId = "b453a8c5-a91a-4511-ac22-28bcfa4ea97c";
const key = "entry-funnel:v1:" + landingId;
type Handler = (event: any) => void;

function browser(options: {
  template?: EntryFunnelTemplate; engine?: "classic" | "constructor"; stored?: Record<string, unknown>;
  blockedStorage?: boolean; uuidFallback?: boolean; rejectBeacon?: boolean; throwBeacon?: boolean; webdriver?: boolean;
} = {}) {
  const engine = options.engine || "constructor", template = options.template || 1;
  const origin = engine === "classic" ? "https://landing.panelbotadmin.com" : "https://mkt.panelbotadmin.com";
  const storage = new Map<string, string>(options.stored ? [[key, JSON.stringify(options.stored)]] : []);
  const windowListeners = new Map<string, Handler[]>(), documentListeners = new Map<string, Handler[]>();
  const frames: Array<() => void> = [], timers: Array<{ fn: () => void; delay: number }> = [];
  const beacons: Array<{ url: string; body: Blob }> = [], requests: Array<{ url: string; init: RequestInit }> = [];
  const listen = (map: Map<string, Handler[]>) => (name: string, handler: Handler) => {
    map.set(name, [...(map.get(name) || []), handler]);
  };
  const cta = { disabled: false, getAttribute: () => null, getClientRects: () => [1] };
  const form = { getClientRects: () => [1] };
  const document = {
    readyState: "loading", visibilityState: "visible", body: {}, addEventListener: listen(documentListeners),
    querySelector: (selector: string) => selector.includes("-form]") ? form : selector.includes("-cta]") ? cta : null,
  };
  const context: Record<string, any> = {
    document, location: { origin, href: origin + "/fixture?fbclid=private-advertising-id" },
    crypto: { ...(options.uuidFallback ? {} : { randomUUID }), getRandomValues: webcrypto.getRandomValues.bind(webcrypto) },
    performance: { timeOrigin: Date.now() - 50, now: () => 50, getEntriesByType: () => [] },
    sessionStorage: {
      getItem: (name: string) => { if (options.blockedStorage) throw new Error("restricted"); return storage.get(name) || null; },
      setItem: (name: string, value: string) => { if (options.blockedStorage) throw new Error("restricted"); storage.set(name, value); },
    },
    navigator: { webdriver: options.webdriver || false, sendBeacon: (url: string, body: Blob) => {
      if (options.throwBeacon) throw new Error("restricted");
      beacons.push({ url, body }); return !options.rejectBeacon;
    } },
    fetch: (url: string, init: RequestInit) => { requests.push({ url, init }); return Promise.resolve({ ok: true }); },
    addEventListener: listen(windowListeners), requestAnimationFrame: (fn: () => void) => { frames.push(fn); return frames.length; },
    setTimeout: (fn: () => void, delay: number) => { timers.push({ fn, delay }); return timers.length; }, clearTimeout: () => {},
    MutationObserver: class { observe() {} disconnect() {} }, getComputedStyle: () => ({ visibility: "visible", opacity: "1" }),
    Blob, URL,
  };
  context.window = context;
  vm.createContext(context);
  const script = buildLandingEntryFunnelScript({ landingId, template, engine });
  vm.runInContext(script, context);
  const dispatch = (map: Map<string, Handler[]>, name: string, event = {}) => {
    for (const handler of map.get(name) || []) handler(event);
  };
  return {
    context, storage, beacons, requests, timers, script, cta,
    frame: () => { while (frames.length) frames.shift()!(); },
    windowEvent: (name: string, event = {}) => dispatch(windowListeners, name, event),
    documentEvent: (name: string, event = {}) => dispatch(documentListeners, name, event),
    install: () => vm.runInContext(`(${buildEntryFunnelFactoryScript()})(${JSON.stringify({ landingId, template })})`, context),
    batches: async () => Promise.all(beacons.map(async item => JSON.parse(await item.body.text()))),
  };
}

test("T1–T6 bootstrap stays small and does not inline the full observer runtime", () => {
  const script = buildLandingEntryFunnelScript({ landingId, template: 1, engine: "classic" });
  assert.ok(Buffer.byteLength(script) < 7000, "keep the inline document bootstrap bounded");
  assert.ok(gzipSync(script).length < 2600, "full telemetry must stay in the cacheable asset");
  assert.doesNotMatch(script, /PerformanceObserver|largest-contentful-paint|provider_create/);
  assert.ok(Buffer.byteLength(script) < Buffer.byteLength(buildEntryFunnelFactoryScript()) / 3);
});

test("all twelve classic/constructor T1–T6 variants capture pre-runtime abandonment under one flow", async () => {
  for (const engine of ["classic", "constructor"] as const) for (const template of [1, 2, 3, 4, 5, 6] as const) {
    const b = browser({ engine, template, webdriver: true });
    assert.equal(b.context.__entryFunnel, undefined, "the full runtime is not installed inline");
    assert.equal(b.requests.length + b.beacons.length, 0, "opening a document makes no telemetry request");
    b.frame();
    b.context.document.visibilityState = "hidden";
    b.documentEvent("visibilitychange");
    b.windowEvent("pagehide");
    const batches = await b.batches();
    assert.equal(batches.length, 2);
    assert.deepEqual(batches[1], batches[0], "repeat unload notifications retain event IDs for server deduplication");
    const batch = batches[0], early = b.context.__ENTRY_FUNNEL_EARLY__;
    assert.ok(validateEntryFunnelBatch(batch));
    assert.ok(validateEntryFunnelContext(early.context));
    assert.equal(batch.flow_id, early.context.flow_id);
    assert.equal(batch.flow_id, JSON.parse(b.storage.get(key)!).flow_id);
    assert.equal(batch.template, template);
    assert.deepEqual(batch.events.map((event: any) => event.name), ["page_visible", "form_visible", "visibility_hidden"]);
    assert.ok(batch.events.every((event: any) => event.engine === engine && event.source === "synthetic"));
    assert.equal(b.storage.has(key + ":pending"), false, "only the complete runtime owns its pending queue");
  }
});

test("late runtime adopts the early flow and replays original UUIDs without a second click listener", async () => {
  const b = browser(); b.frame();
  const input = { value: "Private name", matches: () => true, checkValidity: () => true };
  b.documentEvent("focusin", { target: input });
  b.documentEvent("input", { target: input });
  b.documentEvent("click", { target: { closest: () => b.cta } });
  b.windowEvent("pagehide");
  const early = (await b.batches())[0], earlyFlow = early.flow_id;
  const api = b.install();
  assert.equal(api.flowId, earlyFlow);
  assert.equal(b.context.__ENTRY_FUNNEL_EARLY__, undefined);
  b.documentEvent("DOMContentLoaded"); b.frame();
  api.flush(true);
  const adopted = (await b.batches())[1];
  assert.equal(adopted.flow_id, earlyFlow);
  assert.ok(validateEntryFunnelBatch(adopted));
  assert.equal(new Set(adopted.events.map((event: any) => event.id)).size, adopted.events.length);
  for (const event of early.events.filter((event: any) => event.name !== "visibility_hidden")) {
    const replay = adopted.events.filter((row: any) => row.id === event.id);
    assert.equal(replay.length, 1, event.name + " keeps its original deduplication ID");
    assert.equal(replay[0].elapsed_ms, event.elapsed_ms);
  }
  b.documentEvent("click", { target: { closest: () => b.cta } });
  api.flush(true);
  const latest = (await b.batches()).at(-1)!;
  assert.equal(latest.events.filter((event: any) => event.name === "cta_clicked").length, 2);
  assert.equal(api.context().attempt_number, 2, "only the full runtime creates the next attempt after adoption");
  assert.doesNotMatch(JSON.stringify(latest), /Private name|private-advertising-id/);
});

test("runtime asset failures report closed diagnostics and ignore third-party scripts and private fields", async () => {
  const b = browser(); b.frame();
  b.context.__ENTRY_FUNNEL_EARLY__.context.password = "private-password";
  b.context.__ENTRY_FUNNEL_METADATA__.token = "private-token";
  b.windowEvent("error", { target: { matches: () => false }, message: "Meta secret", filename: "https://private.invalid" });
  assert.equal(b.beacons.length, 0);
  b.windowEvent("error", { target: { matches: (selector: string) => selector === "script[data-public-landing-runtime]" }, message: "private-provider-body" });
  const batch = (await b.batches())[0];
  assert.ok(validateEntryFunnelBatch(batch));
  const error = batch.events.find((event: any) => event.name === "entry_error");
  assert.equal(error.error_code, "network_error");
  assert.equal(error.error_stage, "runtime");
  assert.equal(error.engine, "constructor");
  assert.doesNotMatch(JSON.stringify(batch), /private|password|token|filename|message/);
  const api = b.install(); api.flush(true);
  const adopted = (await b.batches()).at(-1)!;
  assert.equal(adopted.events.find((event: any) => event.name === "entry_error").id,
    batch.events.find((event: any) => event.name === "entry_error").id);
  const before = b.beacons.length;
  b.timers.find(timer => timer.delay === 10000)!.fn();
  b.windowEvent("error", { target: { matches: () => true } });
  assert.equal(b.beacons.length, before, "early error/timeout handlers stop after factory adoption");
});

test("asset timeout remains bounded and a late factory still adopts its diagnostic UUID", async () => {
  const b = browser(); b.frame();
  b.timers.find(timer => timer.delay === 10000)!.fn();
  const timedOut = (await b.batches())[0];
  assert.equal(timedOut.events.find((event: any) => event.name === "entry_error").error_code, "request_timeout");
  assert.ok(validateEntryFunnelBatch(timedOut));
  const api = b.install(); api.flush(true);
  assert.equal((await b.batches()).at(-1)!.flow_id, timedOut.flow_id);
});

test("restricted storage and UUID fallback preserve the flow; rejected beacons use same-origin keepalive", async () => {
  const b = browser({ blockedStorage: true, uuidFallback: true, rejectBeacon: true }); b.frame();
  b.windowEvent("pagehide");
  assert.equal(b.requests.length, 1);
  const request = b.requests[0], batch = JSON.parse(String(request.init.body));
  assert.equal(request.url, "/api/entry-funnel");
  assert.equal(request.init.credentials, "same-origin");
  assert.equal(request.init.keepalive, true);
  assert.equal(request.init.cache, "no-store");
  assert.ok(validateEntryFunnelBatch(batch));
  assert.ok(validateEntryFunnelContext(b.context.__ENTRY_FUNNEL_EARLY__.context));
  const api = b.install();
  assert.equal(api.flowId, batch.flow_id, "in-memory adoption also works without sessionStorage");
});

test("throwing beacons fall back and the public early queue cannot broaden diagnostic fields", () => {
  const b = browser({ throwBeacon: true }); b.frame();
  const events = b.context.__ENTRY_FUNNEL_EARLY__.events;
  events.push({ id: randomUUID(), name: "private-name", at: Date.now() });
  events.push({ id: "private-token", name: "page_visible", at: Date.now() });
  events.push({ id: randomUUID(), name: "entry_error", at: Date.now(), navigation_id: b.context.__ENTRY_FUNNEL_NAVIGATION__.id, navigation_started_at: b.context.__ENTRY_FUNNEL_NAVIGATION__.started_at, error_code: "private-error", password: "private-password" });
  b.windowEvent("pagehide");
  assert.equal(b.requests.length, 1);
  const batch = JSON.parse(String(b.requests[0].init.body));
  assert.ok(validateEntryFunnelBatch(batch));
  assert.equal(batch.events.find((event: any) => event.name === "entry_error").error_code, "unknown");
  assert.doesNotMatch(JSON.stringify(batch), /private|password|token/);
});

test("storage reuse matches engine, template, origin and release while discarding private properties", () => {
  const metadata = publicEntryFunnelMetadata("constructor");
  const stored = { ...metadata, flow_id: randomUUID(), landing_id: landingId, template: 1,
    telemetry_origin: "https://mkt.panelbotadmin.com", started_at: Date.now() - 1000,
    attempt_id: randomUUID(), attempt_number: 2, account_kind: "existing", password: "private", entry_strategy: "combined_login" };
  const b = browser({ stored });
  assert.equal(b.context.__ENTRY_FUNNEL_EARLY__.context.flow_id, stored.flow_id);
  assert.equal(b.context.__ENTRY_FUNNEL_EARLY__.context.attempt_id, stored.attempt_id);
  assert.doesNotMatch(b.storage.get(key)!, /password|private|combined_login/);
  for (const invalid of [
    { engine: "classic" }, { template: 2 }, { telemetry_origin: "https://foreign.invalid" },
    { started_at: Date.now() - 86400001 }, { started_at: Date.now() + 60000 }, { flow_id: "not-a-uuid" },
  ]) assert.notEqual(browser({ stored: { ...stored, ...invalid } }).context.__ENTRY_FUNNEL_EARLY__.context.flow_id, stored.flow_id);
  const oldRelease = process.env.VERCEL_GIT_COMMIT_SHA;
  try {
    process.env.VERCEL_GIT_COMMIT_SHA = "a".repeat(40);
    assert.notEqual(browser({ stored: { ...stored, release: "b".repeat(40) } }).context.__ENTRY_FUNNEL_EARLY__.context.flow_id, stored.flow_id);
  } finally {
    if (oldRelease === undefined) delete process.env.VERCEL_GIT_COMMIT_SHA; else process.env.VERCEL_GIT_COMMIT_SHA = oldRelease;
  }
});

test("T7/T8/T9 form runtime adopts the early head buffer and emits one unload batch with its original IDs", async () => {
  for (const template of [7, 8, 9] as const) {
    const b = browser({ template }); b.frame();
    const early = b.context.__ENTRY_FUNNEL_EARLY__, nav = b.context.__ENTRY_FUNNEL_NAVIGATION__;
    const ids = early.events.map((event: any) => event.id);
    const asset = renderTemplate7RuntimeAsset("fixture", { id: landingId, schemaVersion: 1, updatedAt: "", name: "fixture", comment: "", layout: { template, ctaPosition: "bottom" }, tracking: { pixelId: "", postUrl: "", landingTag: "fixture" } });
    vm.runInContext(asset.config.replace(/^<script[^>]*>/, "").replace(/<\/script>$/, ""), b.context);
    assert.equal(b.context.__ENTRY_FUNNEL_EARLY__, early);
    assert.equal(early.context.navigation_id, nav.id);
    assert.deepEqual(early.events.map((event: any) => event.id), ids);
    b.context.t7EarlyStage("name_started");
    b.windowEvent("pagehide");
    assert.equal(b.beacons.length, 1, "the form adapter does not install a second unload sender");
    const batch = (await b.batches())[0];
    assert.ok(validateEntryFunnelBatch(batch));
    assert.ok(batch.events.every((event: any) => event.navigation_id === nav.id));
    assert.equal(batch.events.filter((event: any) => event.name === "name_started").length, 1);
  }
});

test("a validated early submit carries its attempt through handoff, beacon and late runtime without a second attempt", async () => {
  const b = browser({ template: 9 }); b.frame();
  const early = b.context.__ENTRY_FUNNEL_EARLY__;
  early.record("cta_clicked");
  const first = early.beginAttempt();
  assert.equal(first.attempt_number, 1); assert.equal(first.navigation_id, b.context.__ENTRY_FUNNEL_NAVIGATION__.id);
  early.flush();
  const original = (await b.batches())[0].events.find((event: any) => event.name === "cta_clicked");
  assert.equal(original.attempt_id, first.attempt_id);
  const api = b.install();
  assert.equal(api.peekContext().attempt_id, first.attempt_id);
  assert.equal(api.peekContext().attempt_number, 1);
  const replayed = JSON.parse(b.storage.get(key + ":pending")!).events.find((event: any) => event.name === "cta_clicked");
  assert.equal(replayed.id, original.id); assert.equal(replayed.attempt_id, original.attempt_id);
});

test("two validated submits before the shared runtime keep two distinct attempts and stable event UUIDs", () => {
  const b = browser({ template: 9 }); b.frame();
  const early = b.context.__ENTRY_FUNNEL_EARLY__, first = early.beginAttempt(), second = early.beginAttempt();
  assert.notEqual(first.attempt_id, second.attempt_id); assert.equal(second.attempt_number, 2);
  assert.equal(early.events.filter((event: any) => event.name === "cta_clicked").length, 2);
  const api = b.install();
  assert.equal(api.peekContext().attempt_id, second.attempt_id); assert.equal(api.peekContext().attempt_number, 2);
});
