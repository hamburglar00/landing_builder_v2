import assert from "node:assert/strict";
import test from "node:test";
import { Script, runInNewContext } from "node:vm";
import { buildLandingConfig } from "../lib/landing/buildLandingConfig";
import { DEFAULT_CONFIG } from "../lib/landing/mocks";
import type { PublicLandingConfig } from "../components/public-landing/types";
import { renderPublicLandingHtml } from "../components/public-landing/renderPublicLandingHtml";
import { handleDemoPage, type DemoPageDependencies } from "../lib/reyDeAses/demoRoute.server";
import { createDemoSession, demoSessionCookie, readDemoConfig, verifyDemoSession } from "../lib/reyDeAses/demo.server";

const landingId = "11111111-1111-4111-8111-111111111111";
const advisorId = "33333333-3333-4333-8333-333333333333";
const deviceId = "77777777-7777-4777-8777-777777777777";
const pageUrl = "https://example.com/l/landing-7/testing";

function config() {
  const result = readDemoConfig({
    TEMPLATE7_DEMO_ENABLED: "true",
    TEMPLATE7_DEMO_SESSION_SECRET: "s".repeat(32),
    TEMPLATE7_DEMO_LANDING_IDS: landingId,
    TEMPLATE7_DEMO_ADVISOR_IDS: advisorId,
    TEMPLATE7_DEMO_DEVICE_ID: deviceId,
    TEMPLATE7_DEMO_REY_USERNAME: "demo-user",
    TEMPLATE7_DEMO_REY_PASSWORD: "demo-pass",
  });
  assert.ok(result);
  return result;
}

function pageDeps(overrides: Partial<DemoPageDependencies> = {}): DemoPageDependencies {
  const built = buildLandingConfig({
    id: landingId, name: "landing-7", comment: "", pixelId: "123456", postUrl: "https://example.com/post",
    landingTag: "LP", config: { ...DEFAULT_CONFIG, template: "template7", ctaDestination: "atrio" },
  });
  return {
    config,
    async landing() { return { id: landingId, name: "landing-7", config: { template: "template7", ctaDestination: "atrio", targetProvider: "rey_de_ases" }, landing_config: { layout: { template: 7 } } }; },
    async publicConfig() { return built as PublicLandingConfig; },
    ...overrides,
  };
}

test("/testing deshabilitado, landing no permitida o no Template 7 responden 404", async () => {
  assert.equal((await handleDemoPage(new Request(pageUrl), "landing-7", pageDeps({ config: () => null }))).status, 404);
  assert.equal((await handleDemoPage(new Request(pageUrl), "landing-7", pageDeps({ landing: async () => ({
    id: deviceId, name: "landing-7", config: { template: "template7", ctaDestination: "atrio" }, landing_config: { layout: { template: 7 } },
  }) }))).status, 404);
  assert.equal((await handleDemoPage(new Request(pageUrl), "landing-7", pageDeps({ landing: async () => ({
    id: landingId, name: "landing-7", config: { template: "template2", ctaDestination: "atrio" }, landing_config: { layout: { template: 2 } },
  }) }))).status, 404);
  assert.equal((await handleDemoPage(new Request(pageUrl), "landing-7", pageDeps({ landing: async () => ({
    id: landingId, name: "landing-7", config: { template: "template7", ctaDestination: "atrio" }, landing_config: { layout: { template: 7 } },
  }) }))).status, 404);
  assert.equal(readDemoConfig({ TEMPLATE7_DEMO_ENABLED: "true", TEMPLATE7_DEMO_SESSION_SECRET: "short" }), null);
});

test("la opción demo no altera el HTML normal de las plantillas 1–6", () => {
  for (const template of ["template1", "template2", "template3", "template4", "template5", "template6"] as const) {
    const built = buildLandingConfig({
      id: landingId, name: "otra-landing", comment: "", pixelId: "123456", postUrl: "",
      landingTag: "LP", config: { ...DEFAULT_CONFIG, template },
    }) as PublicLandingConfig;
    assert.equal(renderPublicLandingHtml({ slug: "otra-landing", config: built }),
      renderPublicLandingHtml({ slug: "otra-landing", config: built, demoMode: false }));
  }
});

test("/testing abre directo, crea la sesión firmada y nunca devuelve credenciales", async () => {
  const response = await handleDemoPage(new Request(pageUrl), "landing-7", pageDeps());
  assert.equal(response.status, 200);
  assert.match(await response.text(), /class="public-landing template7"/);
  const cookie = response.headers.get("Set-Cookie") || "";
  assert.match(cookie, /^t7_demo=[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+; Max-Age=14400; Path=\/; HttpOnly; SameSite=Lax/);
  const encoded = cookie.match(/^t7_demo=([A-Za-z0-9_-]+)\./)?.[1] || "";
  assert.deepEqual(Object.keys(JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"))).sort(),
    ["version", "landing_id", "landing_slug", "issued_at", "expires_at"].sort());
  assert.match(demoSessionCookie("token", true), /; Secure;/);
  assert.doesNotMatch(cookie, /demo-user|demo-pass|s{32}/);
});

test("/testing limpia query strings, rechaza POST y reemplaza una cookie inválida", async () => {
  const getQuery = await handleDemoPage(new Request(`${pageUrl}?access_key=leaked`), "landing-7", pageDeps());
  assert.equal(getQuery.status, 303);
  assert.equal(getQuery.headers.get("Location"), "/l/landing-7/testing");
  const post = await handleDemoPage(new Request(pageUrl, { method: "POST" }), "landing-7", pageDeps());
  assert.equal(post.status, 405);
  const invalid = await handleDemoPage(new Request(pageUrl, { headers: { Cookie: "t7_demo=invalid" } }), "landing-7", pageDeps());
  assert.equal(invalid.status, 200);
  assert.match(invalid.headers.get("Set-Cookie") || "", /^t7_demo=[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+;/);
});

test("sesión adulterada, vencida o de otra landing se rechaza", () => {
  const token = createDemoSession(landingId, "landing-7", config(), 1_760_000_000_000);
  assert.equal(verifyDemoSession(token, landingId, "landing-7", config(), 1_760_000_001_000), true);
  assert.equal(verifyDemoSession(token + "x", landingId, "landing-7", config(), 1_760_000_001_000), false);
  assert.equal(verifyDemoSession(token, landingId, "otra", config(), 1_760_000_001_000), false);
  assert.equal(verifyDemoSession(token, landingId, "landing-7", config(), 1_760_020_000_000), false);
});

test("/testing reutiliza el renderer sin Pixel, PageView, CAPI ni Contact", async () => {
  const response = await handleDemoPage(new Request(pageUrl), "landing-7", pageDeps());
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /class="public-landing template7"/);
  assert.match(html, /X-Template7-Demo-Context/);
  assert.match(html, /data-template7-name/);
  assert.doesNotMatch(html, /connect\.facebook\.net\/en_US\/fbevents\.js|fbq\('track', 'PageView'\)/);
  assert.doesNotMatch(html, /sendTrackBestEffort|firePixelContact|recordLandingJourneyStart|test_event_code|atrio-click|\/api\/track/);
  assert.match(html, /<meta name="robots" content="noindex,nofollow">/);
  for (const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) new Script(match[1]);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(response.headers.get("Referrer-Policy"), "no-referrer");
});

test("clic demo ejecuta solo landing-atrio, start real y navegación al handoff", async () => {
  const built = buildLandingConfig({
    id: landingId, name: "landing-7", comment: "", pixelId: "123456", postUrl: "https://example.com/post",
    landingTag: "LP", config: { ...DEFAULT_CONFIG, template: "template7", ctaDestination: "atrio" },
  });
  const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const oldAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://db.example.com";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "public-test-key";
  const response = await handleDemoPage(new Request(pageUrl),
    "landing-7", pageDeps({ publicConfig: async () => built as PublicLandingConfig }));
  const html = await response.text();
  if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl;
  if (oldAnon === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = oldAnon;
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
  const runtime = scripts.find((script) => script.includes("X-Template7-Demo-Context"));
  assert.ok(runtime);
  const listeners: Record<string, () => void> = {};
  const input = { value: "Martín", focus() {}, addEventListener() {} };
  const label = { textContent: "" };
  const button = {
    disabled: true,
    addEventListener(type: string, callback: () => void) { listeners[type] = callback; },
    querySelector() { return label; },
    getAttribute(name: string) { return name.includes("loading") ? "Abriendo..." : "Crear mi cuenta"; },
  };
  const error = { textContent: "", hidden: true };
  const form = { addEventListener() {} };
  const seen: string[] = [];
  let navigated = "";
  const context = {
    URL, AbortController, navigator: { userAgent: "Mozilla/5.0 Chrome" },
    document: {
      readyState: "complete", querySelector(selector: string) {
        if (selector === "[data-template7-name]") return input;
        if (selector === ".template7__cta[data-public-landing-cta]") return button;
        if (selector === "[data-template7-form]") return form;
        if (selector === "[data-template7-error]") return error;
        return null;
      },
      querySelectorAll() { return []; },
    },
    window: {
      __LB_IDENTITY_READY__: Promise.resolve(true), setTimeout, clearTimeout,
      addEventListener() {}, location: { assign(url: string) { navigated = url; } },
    },
    fetch: async (url: string, init?: RequestInit) => {
      seen.push(String(url));
      if (String(url).includes("/landing-atrio")) return { ok: true, json: async () => ({ atrioClientId: "22222222-2222-4222-8222-222222222222", atrioId: advisorId, atrioSlug: "gera" }) };
      assert.equal(url, "/api/template7/start");
      assert.equal(new Headers(init?.headers).get("X-Template7-Demo-Context"), "testing");
      const payload = JSON.parse(String(init?.body));
      assert.equal(payload.name, "Martín");
      assert.equal(payload.landing_id, landingId);
      assert.equal(payload.demo, undefined);
      assert.equal(payload.test_event_code, undefined);
      return { ok: true, json: async () => ({ handoff_url: "https://gateway.example.com/start?t=demo" }) };
    },
  };
  runInNewContext(runtime, context);
  assert.equal(button.disabled, false);
  listeners.click();
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(seen.length, 2);
  assert.equal(navigated, "https://gateway.example.com/start?t=demo");
});
