import assert from "node:assert/strict";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { handleClientIdentityBootstrap } from "../lib/reyDeAses/bootstrap.server";
import { CLIENT_ID_MAX_AGE_SECONDS, getOrCreateClientIdentity, withClientIdentityCookie } from "../lib/reyDeAses/clientIdentity.server";
import { buildClientIdentityBootstrapScript } from "../components/public-landing/clientIdentityBootstrapScript";
import { buildTemplate7HandoffRuntimeScript } from "../components/public-landing/template7HandoffScript";

const uuid = "44444444-4444-4444-8444-444444444444";
const url = "https://landing.example.com/api/client-identity/bootstrap";
const allow = { async allow() { return true; } };

test("bootstrap inicial fija cookie segura y responde solo ok", async () => {
  const response = await handleClientIdentityBootstrap(new Request(url, { method: "POST" }), allow);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await response.json(), { ok: true });
  const cookie = response.headers.get("Set-Cookie") || "";
  assert.match(cookie, /^lb_cid=[0-9a-f-]{36}; Max-Age=63072000; Path=\/; HttpOnly; SameSite=Lax/);
  assert.match(cookie, /Priority=High/);
  assert.doesNotMatch(cookie, /Domain=/);
  assert.equal(CLIENT_ID_MAX_AGE_SECONDS, 2 * 365 * 24 * 60 * 60);
  assert.match(withClientIdentityCookie(new Response(), { deviceId: uuid, needsCookie: true }, true).headers.get("Set-Cookie") || "", /; Secure;/);
});

test("Multi Skin preparation keeps its signed flow and closed skin while duplicate/foreign skins fail",()=>{
  const script=buildTemplate7HandoffRuntimeScript(),context={URL,cfg:{targetProvider:'multi_skin'}};
  const url='https://gateway.example.com/prepare?t=p1.valid&skin=bet30&ef=e1.signed&fbclid=click';
  assert.equal(runInNewContext(script+`;template7CheckedHandoff(${JSON.stringify(url)}).href`,context),'https://gateway.example.com/prepare?t=p1.valid&ef=e1.signed&skin=bet30');
  for(const bad of [url+'&skin=ganamos_plus',url.replace('skin=bet30','skin=unknown')])assert.throws(()=>runInNewContext(script+`;template7CheckedHandoff(${JSON.stringify(bad)})`,context));
  assert.equal(runInNewContext(script+`;template7CheckedHandoff(${JSON.stringify(url.replace('/prepare','/start')+'&provider=evil&return_to=https://evil.test')}).href`,context),'https://gateway.example.com/start?t=p1.valid&ef=e1.signed');
});

test("segunda visita conserva exactamente el UUID y no lo expone al navegador", async () => {
  const identity = getOrCreateClientIdentity(new Request(url, { headers: { Cookie: `lb_cid=${uuid}` } }));
  assert.deepEqual(identity, { deviceId: uuid, needsCookie: false });
  const response = await handleClientIdentityBootstrap(new Request(url, { method: "POST", headers: { Cookie: `lb_cid=${uuid}` } }), allow);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(response.headers.get("Set-Cookie"), null);
  const script = buildClientIdentityBootstrapScript();
  assert.match(script, /credentials: "same-origin", cache: "no-store"/);
  assert.doesNotMatch(script, /lb_cid|randomUUID/);
  assert.match(script, /template7:identity-recovery:v1/);
});

test("una cookie perdida se recupera con el mismo UUID sin exponerlo en el respaldo", async () => {
  const deps = { ...allow, recoverySecret: "test-secret-".repeat(8) };
  const first = await handleClientIdentityBootstrap(new Request(url,{method:"POST",headers:{Cookie:`lb_cid=${uuid}`}}),deps);
  const {recovery_token} = await first.json();
  assert.ok(recovery_token.startsWith('ir1.'));
  assert.ok(!recovery_token.includes(uuid));
  assert.ok(!Buffer.from(recovery_token.slice(4),'base64url').toString().includes(uuid));
  const restored = await handleClientIdentityBootstrap(new Request(url,{method:"POST",headers:{'Content-Type':'application/json'},body:JSON.stringify({recovery_token})}),deps);
  assert.match(restored.headers.get('set-cookie') || '',new RegExp('^lb_cid='+uuid+';'));
  const otherOrigin = await handleClientIdentityBootstrap(new Request('https://other.test/api/client-identity/bootstrap',{method:'POST',body:JSON.stringify({recovery_token})}),deps);
  assert.ok(!(otherOrigin.headers.get('set-cookie') || '').includes(uuid));
});

test("cookies inválidas o duplicadas nunca se adoptan como identidad", () => {
  for (const cookie of ["lb_cid=invalid", `lb_cid=${uuid}; lb_cid=${uuid}`]) {
    const identity = getOrCreateClientIdentity(new Request(url, { headers: { Cookie: cookie } }));
    assert.equal(identity.needsCookie, true);
    assert.notEqual(identity.deviceId, uuid);
  }
});

test("bootstrap limita peticiones y falla sin filtrar detalles", async () => {
  const limited = await handleClientIdentityBootstrap(new Request(url, { method: "POST" }), { async allow() { return false; } });
  assert.equal(limited.status, 429);
  assert.deepEqual(await limited.json(), { error: "rate_limited" });
  const unavailable = await handleClientIdentityBootstrap(new Request(url, { method: "POST" }), { async allow() { throw Error("database secret"); } });
  assert.equal(unavailable.status, 503);
  assert.deepEqual(await unavailable.json(), { error: "service_unavailable" });
});

async function runCombinedBootstrap(destinationStatus = 200, bootstrapOk = true) {
  const calls: { path: string; body: Record<string, unknown> }[] = [];
  const stored: Record<string, string> = {};
  const browser = {
    setTimeout, clearTimeout,
  } as Record<string, unknown>;
  const destination = { atrioClientId: "client", atrioId: "advisor", atrioSlug: "gera", preparationReady: true };
  const source = buildClientIdentityBootstrapScript({ landingId: uuid, slug: "landing" }).replace(/^<script>|<\/script>$/g, "");
  runInNewContext(source, {
    window: browser, Promise, AbortController,
    localStorage: { getItem: (key: string) => stored[key] || "", setItem: (key: string, value: string) => { stored[key] = value; } },
    fetch: async (path: string, init: { body: string; credentials: string }) => {
      assert.equal(init.credentials, "same-origin");
      calls.push({ path, body: JSON.parse(init.body) });
      if (path === "/api/client-identity/bootstrap") return { ok: bootstrapOk, json: async () => ({ ok: bootstrapOk, recovery_token: "ir1.encrypted" }) };
      return { ok: destinationStatus === 200, json: async () => destination };
    },
  });
  const ready = await browser.__LB_IDENTITY_READY__;
  const selected = await (browser.__PUBLIC_LANDING_ATRIO_PROMISES as Record<string, Promise<unknown>>).landing;
  return { ready, selected, calls, stored, browser, destination };
}

test("el destino verifica la cookie en la misma solicitud que prepara el manager", async () => {
  const result = await runCombinedBootstrap();
  assert.equal(result.ready, true);
  assert.deepEqual(result.selected, result.destination);
  assert.deepEqual(result.calls.map(call => call.path), ["/api/client-identity/bootstrap", "/api/template7/destination"]);
  assert.deepEqual(result.calls[1].body, { landing_id: uuid, landing_slug: "landing" });
  assert.equal(result.stored["template7:identity-recovery:v1"], "ir1.encrypted");
  assert.ok(result.calls.every(call => call.body.verify !== true));
});

test("la cookie bloqueada o un destino no disponible impiden confirmar el ingreso", async () => {
  for (const status of [409, 403, 503]) {
    const result = await runCombinedBootstrap(status);
    assert.equal(result.ready, false);
    assert.equal(result.selected, null);
  }
  const failedIdentity = await runCombinedBootstrap(200, false);
  assert.equal(failedIdentity.ready, false);
  assert.deepEqual(failedIdentity.calls.map(call => call.path), ["/api/client-identity/bootstrap"]);
});

test("reintentar bootstrap reemplaza la promesa de destino sin crear otra identidad en el navegador", async () => {
  const result = await runCombinedBootstrap();
  const original = (result.browser.__PUBLIC_LANDING_ATRIO_PROMISES as Record<string, Promise<unknown>>).landing;
  assert.equal(await (result.browser.__LB_BOOTSTRAP_IDENTITY__ as () => Promise<boolean>)(), true);
  assert.notEqual((result.browser.__PUBLIC_LANDING_ATRIO_PROMISES as Record<string, Promise<unknown>>).landing, original);
  assert.deepEqual(result.calls[2].body, { recovery_token: "ir1.encrypted" });
});

test("handoff no se precarga, valida token y crea intent Android con fallback", () => {
  const script = buildTemplate7HandoffRuntimeScript();
  const context = { URL, navigator: { userAgent: "Mozilla/5.0 (Linux; Android 14; wv) Instagram" } };
  const intent = runInNewContext(`${script}; template7HandoffIntent("https://gateway.example.com/start?t=once")`, context) as string;
  assert.match(intent, /^intent:\/\/gateway\.example\.com\/start\?t=once#Intent;scheme=https;package=com\.android\.chrome;/);
  assert.match(intent, /S\.browser_fallback_url=https%3A%2F%2Fgateway\.example\.com%2Fstart%3Ft%3Donce;end$/);
  assert.equal(runInNewContext(`${script}; template7WebviewKind(navigator.userAgent)`, context), "android");
  assert.equal(runInNewContext(`${script}; template7WebviewKind("Mozilla/5.0 (iPhone) Instagram")`, context), "ios");
  assert.match(script, /catch \(error\) \{ showTemplate7HandoffFallback/);
  assert.doesNotMatch(script, /fetch\(|preload|prefetch|lb_cid/);
  assert.equal(runInNewContext(`${script}; template7HandoffIntent("https://gateway.example.com/start?t=one&extra=1")`, context),runInNewContext(`${script}; template7HandoffIntent("https://gateway.example.com/start?t=one")`, context));
});

test("Facebook and Instagram handoffs stay in the current browser and exclude marketing from access URLs", () => {
  for(const ua of ['Mozilla/5.0 Android FBAN/FB4A','Mozilla/5.0 iPhone Instagram','Mozilla/5.0 Chrome']) {
    const navigations:string[]=[];
    const context={URL,Date,navigator:{userAgent:ua},window:{location:{assign:(url:string)=>navigations.push(url)},localStorage:{setItem:()=>{}}}};
    const destination='https://gateway.example.com/prepare?t=once&ef=e1.signed-fixture&fbclid=meta-click&utm_source=facebook&new_meta_field=x&new_meta_field=y&return_to=https://evil.test&provider=evil';
    runInNewContext(buildTemplate7HandoffRuntimeScript()+`;navigateTemplate7Handoff(${JSON.stringify(destination)})`,context);
    assert.deepEqual(navigations,['https://gateway.example.com/prepare?t=once&ef=e1.signed-fixture']);
  }
  const context={URL};
  for(const suffix of ['&ef=','&ef=one&ef=two','&ef='+ 'a'.repeat(2004)]) {
    assert.throws(()=>runInNewContext(buildTemplate7HandoffRuntimeScript()+`;template7CheckedHandoff(${JSON.stringify('https://gateway.example.com/prepare?t=once'+suffix)})`,context));
  }
});
