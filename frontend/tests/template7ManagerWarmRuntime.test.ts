import test from "node:test";
import assert from "node:assert/strict";
import { Script } from "node:vm";
import { buildTemplate7FastRuntime, buildTemplate7RuntimeConfig } from "../components/public-landing/template7FastRuntime";
import { buildTemplate7HandoffRuntimeScript } from "../components/public-landing/template7HandoffScript";
import { buildTemplate7BoundedRequestScript } from '../components/public-landing/template7BoundedRequest';
import { TEMPLATE7_RETURN_HINT_SCRIPT } from "../components/public-landing/template7ReturnHint";

test("a previous preparation only hides its own form, releases on lookup failure and tolerates a missing asset", async () => {
  const storage = new Map<string, string>();
  const localStorage = { getItem: (key: string) => storage.get(key), setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) };
  const cfg = { creationScreen: true, landingId: "diana-id", slug: "diana", targetProvider: "multi_skin", skinCode: "ganamos_plus", atrioClientId: "client", atrioId: "advisor" };
  function visit(settings = cfg) {
    const flags = new Set<string>(), timers = new Map<number, () => void>();
    const title = { textContent: "Creando tu cuenta" }, description = { textContent: "Estamos preparando tu acceso." }, progress = { hidden: false };
    const overlay = { dataset: {}, hidden: true, querySelectorAll: () => [], querySelector: (s: string) => s === "[data-entry-title]" ? title : s === "[data-entry-description]" ? description : progress };
    const document = { documentElement: { setAttribute: (s: string) => flags.add(s), removeAttribute: (s: string) => flags.delete(s) }, getElementById: () => overlay };
    const window = { __PUBLIC_LANDING_RUNTIME_CONFIG__: settings, addEventListener(){},
      __T7_REMEMBER_RETURN_VIEW__(){ throw Error("Missing handoff marker"); },
      __T7_RETURN_CHECK__: null as null | { paint(): void; claim(): void; dismiss(): void },
    };
    new Script(TEMPLATE7_RETURN_HINT_SCRIPT).runInNewContext({ window, document, localStorage,
      setTimeout(fn: () => void, ms: number){ timers.set(ms, fn); return ms; }, clearTimeout: (ms: number) => timers.delete(ms) });
    return { flags, timers, title, description, progress, overlay, window };
  }
  const first = visit();
  assert.equal(first.flags.size, 0);
  assert.equal(storage.size, 0);
  first.window.__T7_REMEMBER_RETURN_VIEW__();
  for (const different of [{ slug: "otra", landingId: "otro-id" }, { skinCode: "otro" }, { atrioId: "otro" }, { creationScreen: false }]) {
    assert.equal(visit({ ...cfg, ...different }).flags.size, 0);
  }
  const returning = visit();
  assert.deepEqual([...returning.flags], ["data-t7-return-check"]);
  returning.window.__T7_RETURN_CHECK__!.paint();
  assert.equal(returning.overlay.hidden, false);
  assert.equal(returning.progress.hidden, true);
  assert.equal(returning.title.textContent, "");
  assert.equal(returning.description.textContent, "");
  returning.timers.get(300)!();
  assert.equal(returning.title.textContent, "Verificando tu cuenta…");
  assert.equal(returning.description.textContent, "");
  returning.window.__T7_RETURN_CHECK__!.paint();
  assert.equal(returning.title.textContent, "Verificando tu cuenta…");
  returning.window.__T7_RETURN_CHECK__!.claim();
  assert.equal(returning.timers.has(4000), false);
  const warm = buildTemplate7FastRuntime("diana", { id: "diana-id", layout: { template: 7 } } as never);
  const begin = warm.indexOf("      function template7RecoveryAttribution()");
  const end = warm.indexOf("      function init() {", begin);
  for (const failed of [undefined, { ...advisor, preparationReady: true, existingName: "Diana", promoCode: "ORIGINAL" }]) {
    returning.window.__T7_REMEMBER_RETURN_VIEW__();
    const failedPage = visit();
    failedPage.window.__T7_RETURN_CHECK__!.paint();
    new Script(warm.slice(begin, end) + "\nwarmTemplate7Entry();").runInNewContext({
      window: failedPage.window, cfg, template7EntryGeneration: 0, template7DestinationKey: () => cfg.slug,
      ensureAtrioPromise: async () => failed, fetchWithEntryRecovery: async () => { throw Error("offline"); },
      collectMetaTrackingParams: () => ({}), queryParams: () => new URLSearchParams(), landingResolution: "",
      template7Transition: null, document: { querySelector: () => null }, setTemplate7Error() {},
    });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(failedPage.flags.size, 0);
    assert.equal(failedPage.overlay.hidden, true);
    assert.equal(failedPage.timers.size, 0);
  }
  returning.window.__T7_REMEMBER_RETURN_VIEW__();
  const stuck = visit();
  stuck.window.__T7_RETURN_CHECK__!.paint();
  stuck.timers.get(4000)!();
  assert.equal(stuck.flags.size, 0);
  assert.equal(stuck.overlay.hidden, true);
  assert.equal(visit().flags.size, 0);
});

test("only signed T7/T9 preparations in credentials mode carry the correct visual hint", () => {
  for (const classic of [false, true]) for (const template of [7, 8, 9]) {
    for (const mode of ["direct", "credentials"] as const) {
      const page = { id: "landing", layout: { template }, gatewayEntry: { mode, seconds: 4 } };
      const identity = classic ? "function getOrCreateDeviceId(){return 'device';}" : "";
      const cfg = buildTemplate7RuntimeConfig("fixture", page as never, identity);
      const source = buildTemplate7FastRuntime("fixture", page as never, identity);
      const begin = source.indexOf("function template7CheckedHandoff(raw)");
      const end = source.indexOf("function showTemplate7HandoffFallback(", begin);
      assert.ok(begin >= 0 && end > begin);
      const code = source.slice(begin, end) + "\nnavigateTemplate7Handoff(destination, submitted);";
      if (template !== 8 && mode === "credentials") {
        const hasSavedName = source.slice(source.indexOf("function template7HasSavedName("), source.indexOf("function warmTemplate7Entry()"));
        const submit = source.match(/\.then\((function \(handoffUrl\) \{ if \(entryAttempt === template7EntryGeneration\) navigateTemplate7Handoff\(handoffUrl,[^;]+; \})\)/);
        assert.ok(submit);
        const destination = "https://casino.test/prepare?t=p1.reserved";
        for (const [atrioData, fragment] of [[{ preparationReady: true }, "#creando-cuenta"],
          [{ preparationReady: true, existingName: "Diana", promoCode: "PROMO" }, "#verificando-cuenta"]] as const) {
          let next = "";
          const window = { location: { assign: (url: string) => { next = url; } } };
          new Script(source.slice(begin, end) + hasSavedName + "\n(" + submit[1] + ")(destination);")
            .runInNewContext({ window, cfg, URL, destination, atrioData, entryAttempt: 1, template7EntryGeneration: 1 });
          assert.equal(next, destination + fragment);
        }
      }
      for (const [path, submitted] of [["/prepare?t=p1.token", true], ["/prepare?t=p1.token", false],
        ["/start?t=p1.token", true], ["/prepare?t=handoff", true]] as const) {
        const destination = "https://casino.test" + path;
        let actual = "";
        const window = { location: { assign: (value: string) => { actual = value; } } };
        new Script(code).runInNewContext({ cfg, window, URL, destination, submitted });
        const hasPresentation = template !== 8 && mode === "credentials" && path === "/prepare?t=p1.token";
        const expectedFragment = hasPresentation ? (submitted ? "#creando-cuenta" : "#verificando-cuenta") : "";
        assert.equal(actual, destination + expectedFragment);
        assert.throws(() => new Script(code).runInNewContext({ cfg, window, URL, destination: destination + "#foreign", submitted }), /invalid handoff/);
      }
    }
  }
});

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
test("classic pool recovery preserves its stable device identifier and preparation endpoint", async () => {
  const { requests, redirects } = await runWarm({ ...advisor, preparationReady: true, existingName: "Existing", promoCode: "PROMO" }, true);
  assert.equal(requests.length, 1); assert.equal(requests[0].url, "/api/template7/prepare");
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
  assert.deepEqual(requests.map(request=>request.url),['/api/template7/warm','/api/template7/prepare']);
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
