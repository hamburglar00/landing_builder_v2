import assert from "node:assert/strict";
import { randomUUID, webcrypto } from "node:crypto";
import test from "node:test";
import vm from "node:vm";
import { buildLandingEntryFunnelScript } from "../lib/landing/entryFunnel.bootstrap";
import { buildEntryFunnelFactoryScript } from "../lib/landing/entryFunnel.client";
import { validateEntryFunnelBatch, validateEntryFunnelContext } from "../lib/landing/entryFunnel";
import { entryFunnelGatewayOrigins } from "../lib/landing/entryFunnel.origins.server";

const landingId = "b453a8c5-a91a-4511-ac22-28bcfa4ea97c";
const origin = "https://gateway.example.com", apiBase = "/l/diana/_api", telemetryPath = apiBase + "/entry-funnel";
test("gateway context requires an explicitly trusted origin and closed collector path", () => {
  const context = { landing_id: landingId, flow_id: randomUUID(), template: 9, engine: "gateway", telemetry_origin: origin, telemetry_path: telemetryPath, started_at: Date.now() };
  assert.equal(validateEntryFunnelContext(context), null);
  assert.deepEqual(validateEntryFunnelContext(context, Date.now(), [origin]), context);
  assert.ok(validateEntryFunnelContext({...context,telemetry_path:"/l/nexobet/nx-test/_api/entry-funnel"}, Date.now(), [origin]));
  for (const path of [undefined, "/api/entry-funnel", "https://evil.test/l/diana/_api/entry-funnel", "//evil.test", "/l/../_api/entry-funnel", "/l/a%2Fb/_api/entry-funnel", "/l/other/diana/_api/entry-funnel", "/l/nexobet/other/diana/_api/entry-funnel", telemetryPath + "?secret=1", telemetryPath + "#x"]) {
    assert.equal(validateEntryFunnelContext({ ...context, telemetry_path: path }, Date.now(), [origin]), null);
  }
  assert.equal(validateEntryFunnelContext({ ...context, engine: "constructor" }, Date.now(), [origin]), null);
  const { telemetry_path: _, ...classic } = context;
  assert.ok(validateEntryFunnelContext({ ...classic, engine: "constructor", telemetry_origin: "https://constructor.panelbotadmin.com" }));
  assert.equal(validateEntryFunnelContext({ ...context, telemetry_origin: origin + "@evil.test" }, Date.now(), [origin]), null);
});

test("trusted gateway catalog derives only configured provider origins and enumerated skins", () => {
  const origins = entryFunnelGatewayOrigins({ REY_GATEWAY_ORIGIN: "https://rey.test", ASES_DEL_NORTE_GATEWAY_ORIGIN: "https://ases.test/path", GANAMOS_NET_GATEWAY_ORIGIN: "https://net.test", MULTI_SKIN_GATEWAY_BASE_DOMAIN: "skins.test" });
  assert.ok(origins.includes("https://rey.test")); assert.ok(origins.includes("https://net.test"));
  assert.ok(origins.includes("https://ganamosplus.skins.test")); assert.ok(origins.includes("https://jugamos.skins.test"));
  assert.equal(origins.includes("https://fake.skins.test"), false); assert.equal(origins.includes("https://ases.test/path"), false);
});

test("bootstrap and full runtime retain one gateway flow and send only through its local collector", async () => {
  const storage = new Map<string,string>(), sent: Array<{ url: string; blob: Blob }> = [];
  const listeners = new Map<string,Function[]>();
  const context: any = {
    crypto: { randomUUID, getRandomValues: webcrypto.getRandomValues.bind(webcrypto) },
    performance: { timeOrigin: Date.now()-50, now: () => 50, getEntriesByType: () => [] },
    location: { origin }, navigator: { sendBeacon: (url: string,blob: Blob) => { sent.push({url,blob}); return true; } },
    sessionStorage: { getItem: (key: string) => storage.get(key), setItem: (key: string,value: string) => storage.set(key,value) },
    document: { readyState: "loading", visibilityState: "visible", addEventListener() {}, querySelector: () => null },
    addEventListener: (name: string, fn: Function) => listeners.set(name,[...(listeners.get(name)||[]),fn]),
    requestAnimationFrame: (fn: Function) => fn(), setTimeout: () => 1, clearTimeout() {}, Blob, URL,
  };
  context.window=context; vm.createContext(context);
  vm.runInContext(buildLandingEntryFunnelScript({ landingId, template:9, engine:"gateway", apiBase }),context);
  const early=context.__ENTRY_FUNNEL_EARLY__; early.flush();
  assert.equal(early.context.telemetry_path,telemetryPath); assert.equal(sent[0].url,telemetryPath);
  const api=vm.runInContext(`(${buildEntryFunnelFactoryScript()})(${JSON.stringify({landingId,template:9,apiBase,telemetry:{engine:"gateway"}})})`,context);
  assert.equal(api.flowId,early.context.flow_id); assert.equal(api.peekContext().telemetry_path,telemetryPath);
  api.emit("cta_clicked"); api.flush(true);
  assert.ok(sent.every(item=>item.url===telemetryPath));
  for(const item of sent) assert.ok(validateEntryFunnelBatch(JSON.parse(await item.blob.text())));
  const transfer=api.peekContext(); api.stop(); context.__entryFunnel=undefined; context.__ENTRY_FUNNEL_EARLY__=undefined;
  const gateway=vm.runInContext(`(${buildEntryFunnelFactoryScript()})({},${JSON.stringify(transfer)},"/api/entry-funnel")`,context);
  gateway.emit("chat_usable"); gateway.flush(true);
  assert.equal(sent.at(-1)?.url,"/api/entry-funnel","post-handoff caller controls authenticated proxy endpoint");
  assert.equal(gateway.peekContext().telemetry_path,telemetryPath);
});

test("invalid gateway API base cannot generate a collector or silently use legacy routing", () => {
  for(const apiBase of [undefined,"https://evil.test","/api","/l/a%2Fb/_api"]) assert.throws(()=>buildLandingEntryFunnelScript({landingId,template:9,engine:"gateway",apiBase}));
  assert.throws(()=>buildLandingEntryFunnelScript({landingId,template:9,engine:"constructor",apiBase}));
});
