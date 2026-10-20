import test from "node:test";
import assert from "node:assert/strict";
import { Script } from "node:vm";
import { buildTemplate7FastRuntime } from "../components/public-landing/template7FastRuntime";

const advisor = { atrioClientId: "client", atrioId: "advisor", atrioSlug: "gera" };
async function runWarm(value: object, classic = false) {
  const source = buildTemplate7FastRuntime("test", { id: "landing", name: "test", layout: { template: 7 } } as never,
    classic ? "function getOrCreateDeviceId(){return 'device';}" : "");
  const start = source.indexOf("      function warmTemplate7Entry()");
  const end = source.indexOf("      function init() {", start);
  assert.ok(start > 0 && end > start);
  const requests: { url: string; payload: object }[] = [], redirects: string[] = [];
  new Script(source.slice(start, end) + "\nwarmTemplate7Entry();").runInNewContext({
    Promise, URL, cfg: { landingId: "landing", slug: "test", targetProvider: "ganamos_net" },
    window: { location: { replace: (url: string) => redirects.push(url) } },
    ensureAtrioPromise: async () => value, getOrCreateDeviceId: () => "device",
    fetch: async (url: string, init: { body: string }) => {
      requests.push({ url, payload: JSON.parse(init.body) });
      return { ok: true, json: async () => url.includes("/warm") ? { ready: true } : { handoff_url: "https://casino.test/prepare?t=opaque" } };
    },
  });
  await new Promise(resolve => setImmediate(resolve));
  return { requests, redirects };
}
test("pool selection already reserves entry: a new visitor sends no duplicate warm request", async () => {
  const result = await runWarm({ ...advisor, preparationReady: true });
  assert.deepEqual(result, { requests: [], redirects: [] });
});
test("returning pool visitor uses existing identity/name and promo without another warm", async () => {
  const { requests, redirects } = await runWarm({ ...advisor, preparationReady: true, existingName: "Existing", promoCode: "PROMO" });
  assert.equal(requests.length, 1); assert.equal(requests[0].url, "/api/template7/prepare");
  assert.equal(Reflect.get(requests[0].payload, "name"), "Existing");
  assert.equal(Reflect.get(requests[0].payload, "promo_code"), "PROMO");
  assert.equal(Reflect.has(requests[0].payload, "device_id"), false);
  assert.deepEqual(redirects, ["https://casino.test/prepare?t=opaque"]);
});
test("classic pool recovery preserves its stable device identifier and start endpoint", async () => {
  const { requests } = await runWarm({ ...advisor, preparationReady: true, existingName: "Existing", promoCode: "PROMO" }, true);
  assert.equal(requests.length, 1); assert.equal(requests[0].url, "/api/template7/start");
  assert.equal(Reflect.get(requests[0].payload, "device_id"), "device");
});
test("a landing without a pool retains its original prewarm path", async () => {
  const { requests, redirects } = await runWarm(advisor);
  assert.equal(requests.length, 1); assert.equal(requests[0].url, "/api/template7/warm");
  assert.deepEqual(redirects, []);
});
