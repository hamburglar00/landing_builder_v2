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

test("segunda visita conserva exactamente el UUID y no lo expone al navegador", async () => {
  const identity = getOrCreateClientIdentity(new Request(url, { headers: { Cookie: `lb_cid=${uuid}` } }));
  assert.deepEqual(identity, { deviceId: uuid, needsCookie: false });
  const response = await handleClientIdentityBootstrap(new Request(url, { method: "POST", headers: { Cookie: `lb_cid=${uuid}` } }), allow);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(response.headers.get("Set-Cookie"), null);
  const script = buildClientIdentityBootstrapScript();
  assert.match(script, /credentials: "same-origin", cache: "no-store"/);
  assert.doesNotMatch(script, /lb_cid|randomUUID|localStorage|response\.json/);
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

test("handoff no se precarga, valida token y crea intent Android con fallback", () => {
  const script = buildTemplate7HandoffRuntimeScript();
  const context = { URL, navigator: { userAgent: "Mozilla/5.0 (Linux; Android 14; wv) Instagram" } };
  const intent = runInNewContext(`${script}; template7HandoffIntent("https://gateway.example.com/start?t=once")`, context) as string;
  assert.match(intent, /^intent:\/\/gateway\.example\.com\/start\?t=once#Intent;scheme=https;package=com\.android\.chrome;/);
  assert.match(intent, /S\.browser_fallback_url=https%3A%2F%2Fgateway\.example\.com%2Fstart%3Ft%3Donce;end$/);
  assert.equal(runInNewContext(`${script}; template7WebviewKind(navigator.userAgent)`, context), "android");
  assert.equal(runInNewContext(`${script}; template7WebviewKind("Mozilla/5.0 (iPhone) Instagram")`, context), "ios");
  assert.match(script, /copialo y pegalo en Safari/);
  assert.doesNotMatch(script, /fetch\(|preload|prefetch|lb_cid/);
  assert.throws(() => runInNewContext(`${script}; template7HandoffIntent("https://gateway.example.com/start?t=one&extra=1")`, context));
});
