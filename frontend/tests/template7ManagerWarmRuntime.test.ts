import test from "node:test";
import assert from "node:assert/strict";
import { Script } from "node:vm";
import { buildTemplate7FastRuntime } from "../components/public-landing/template7FastRuntime";
import { buildTemplate7HandoffRuntimeScript } from "../components/public-landing/template7HandoffScript";
import { buildTemplate7BoundedRequestScript } from '../components/public-landing/template7BoundedRequest';

const advisor = { atrioClientId: "client", atrioId: "advisor", atrioSlug: "gera" };
async function runWarm(value: object, classic = false, warmResult: object = {ready: true}, supersede = false) {
  const source = buildTemplate7FastRuntime("test", { id: "landing", name: "test", layout: { template: 7 } } as never,
    classic ? "function getOrCreateDeviceId(){return 'device';}" : "");
  const start = source.indexOf("      function template7RecoveryAttribution()");
  const end = source.indexOf("      function init() {", start);
  assert.ok(start > 0 && end > start);
  const requests: { url: string; payload: object }[] = [], redirects: string[] = [];
  const transitionStart = source.indexOf("      function template7TransitionUrl(raw) {");
  const transitionEnd = source.indexOf("      function failTemplate7(", transitionStart);
  const state = { template7EntryGeneration: 0 };
  const fetch = async (url: string, init: { body: string }) => {
    requests.push({ url, payload: JSON.parse(init.body) });
    if (supersede && !url.includes('/warm')) state.template7EntryGeneration++;
    return { ok: true, json: async () => url.includes('/warm') ? warmResult : {handoff_url:`https://casino.test/${classic ? 'start' : 'prepare'}?t=opaque`} };
  };
  new Script(buildTemplate7HandoffRuntimeScript() + source.slice(transitionStart, transitionEnd) + source.slice(start, end) + "\nwarmTemplate7Entry();").runInNewContext({
    Promise, URL, cfg: { landingId: "landing", slug: "test", targetProvider: "ganamos_net" },
    window: { location: { assign: (url: string) => redirects.push(url) } },
    ensureAtrioPromise: async () => ({...value}), getOrCreateDeviceId: () => "device",
    template7DestinationKey: () => 'test',
    fetch, fetchWithEntryRecovery: fetch, template7Transition: null, clickLocked: false,
    get template7EntryGeneration() { return state.template7EntryGeneration; },
    set template7EntryGeneration(value: number) { state.template7EntryGeneration = value; },
    document: {querySelector: () => null}, setTemplate7Error: () => {},
    queryParams: () => new URLSearchParams('landing=diana&fbclid=original-click&utm_source=facebook&new_meta_field=x&target_provider=evil&advisor_id=foreign'),
    collectMetaTrackingParams: () => ({fbc:'fb.1.123.original-click',fbp:'fb.1.123.original-browser'}), landingResolution:'url_parameter',
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
  assert.deepEqual(Reflect.get(requests[0].payload,"attribution"),{landing:'test',landing_resolution:'url_parameter',target_provider:'ganamos_net',skin_code:'',fbp:'fb.1.123.original-browser',fbc:'fb.1.123.original-click',utm_source:'facebook'});
  assert.deepEqual(redirects, ["https://casino.test/prepare?t=opaque"]);
});
test("classic pool recovery preserves its stable device identifier and start endpoint", async () => {
  const { requests, redirects } = await runWarm({ ...advisor, preparationReady: true, existingName: "Existing", promoCode: "PROMO" }, true);
  assert.equal(requests.length, 1); assert.equal(requests[0].url, "/api/template7/start");
  assert.equal(Reflect.get(requests[0].payload, "device_id"), "device");
  assert.deepEqual(redirects, ["https://casino.test/prepare?t=opaque"], "classic also enters through the visible transition");
});

test("a late automatic recovery cannot navigate after a newer entry supersedes it", async () => {
  for (const classic of [false, true]) {
    const {requests,redirects}=await runWarm({...advisor,preparationReady:true,existingName:"Benja",promoCode:"ORIGINAL"},classic,{ready:true},true);
    assert.equal(requests.length,1);
    assert.deepEqual(redirects,[]);
  }
});

test('classic without a manager pool resumes the remembered pending entry without another name', async () => {
  const {requests,redirects} = await runWarm(advisor,true,{ready:true,existing_name:'Benja',promo_code:'ORIGINAL'});
  assert.deepEqual(requests.map(request=>request.url),['/api/template7/warm','/api/template7/start']);
  assert.equal(Reflect.get(requests[1].payload,'name'),'Benja');
  assert.equal(Reflect.get(requests[1].payload,'promo_code'),'ORIGINAL');
  assert.equal(Reflect.get(requests[1].payload,'device_id'),'device');
  assert.deepEqual(redirects,['https://casino.test/prepare?t=opaque']);
});

test("a pending or completed valid destination survives soft timeouts without another request", async () => {
  let release!: (value: object | null) => void;
  const pending = new Promise<object | null>(resolve => { release = resolve; });
  const source = buildTemplate7FastRuntime("test", { id: "landing", name: "test", layout: { template: 7 } } as never);
  const start = source.indexOf("      function template7DestinationKey()");
  const end = source.indexOf("      function sendTrackBestEffort(", start);
  let requests = 0;
  const window = { __PUBLIC_LANDING_ATRIO_PROMISES: { test: pending } };
  const api = new Script(source.slice(start, end) + "\n({ ensure: ensureAtrioPromise, clear: clearPrewarmedAtrioPromise })").runInNewContext({
    window, cfg: { slug: "test", landingId: "landing" }, Promise,
    fetch: async () => { requests++; return { ok: true, json: async () => advisor }; },
  });
  assert.equal(api.ensure(), pending);
  api.clear(); assert.equal(api.ensure(), pending); assert.equal(requests, 0);
  release(advisor); await pending; await Promise.resolve();
  api.clear(); assert.equal(api.ensure(), pending); assert.equal(requests, 0);
});

test("only a settled invalid destination is replaced and the replacement is shared", async () => {
  const source = buildTemplate7FastRuntime("test", { id: "landing", name: "test", layout: { template: 7 } } as never);
  const start = source.indexOf("      function template7DestinationKey()");
  const end = source.indexOf("      function sendTrackBestEffort(", start);
  let requests = 0;
  const api = new Script(buildTemplate7BoundedRequestScript() + source.slice(start, end) + "\n({ ensure: ensureAtrioPromise, clear: clearPrewarmedAtrioPromise })").runInNewContext({
    window: { setTimeout, clearTimeout, __PUBLIC_LANDING_ATRIO_PROMISES: { test: Promise.resolve(null) } }, cfg: { slug: "test", landingId: "landing" }, Promise, AbortController,
    fetch: async () => { requests++; return { ok: true, json: async () => advisor }; },
  });
  await api.ensure(); api.clear(); const retry = api.ensure(); assert.equal(api.ensure(), retry);
  await retry; assert.equal(requests, 1);
});
test("a landing without a pool retains its original prewarm path", async () => {
  const { requests, redirects } = await runWarm(advisor);
  assert.equal(requests.length, 1); assert.equal(requests[0].url, "/api/template7/warm");
  assert.deepEqual(redirects, []);
});
