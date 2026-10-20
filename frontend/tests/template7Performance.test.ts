import test from "node:test";
import assert from "node:assert/strict";
import { Script } from "node:vm";
import { optimizeTemplate7Images, template7ImageUrl, template7ImageWarmUrls, template7Logo } from "../lib/landing/template7Images";
import { imageConfigFromLanding, warmTemplate7Images } from "../lib/landing/warmTemplate7Images.server";
import { renderPublicLandingHtml, renderClassicTemplate7InlineHtml } from "../components/public-landing/renderPublicLandingHtml";
import { TEMPLATE7_CRITICAL_CSS, PUBLIC_LANDING_CSS } from "../components/public-landing/publicLandingCss";
import type { PublicLandingConfig } from "../components/public-landing/types";
import { handlePanelRevalidation, type Actor, type RevalidationBackend } from "../lib/revalidation/service.server";

const original = "https://audit.supabase.co/storage/v1/object/public/landing-images/owner/logo.avif";
const fixture = (provider: PublicLandingConfig["tracking"]["target_provider"] = "rey_de_ases"): PublicLandingConfig => ({
  schemaVersion: 1, updatedAt: "2026-10-15", id: "a0000000-0000-4000-8000-000000000001", name: "Prueba", comment: "",
  layout: { template: 7, ctaPosition: "bottom" },
  tracking: { pixelId: "123456789", postUrl: "/conversions", landingTag: "TEST", target_provider: provider },
  content: { logoUrl: original, title: ["Crear cuenta"], subtitle: ["Ahora"], ctaText: "Continuar" },
  background: { mode: "single", images: [original.replace("logo", "background")], rotateEveryHours: 24 },
  template7Capture: { whatsapp: true },
});

test("T7 optimizes old and new images without mutating their saved originals", () => {
  const config = fixture();
  const before = JSON.stringify(config);
  const optimized = optimizeTemplate7Images(config);
  assert.equal(JSON.stringify(config), before);
  assert.equal(optimized.content?.logoOriginalUrl, original);
  assert.equal(new URL(optimized.content!.logoUrl).searchParams.get("width"), "340");
  assert.match(optimized.content!.logoSrcSet!, /1x, .*2x, .*3x$/);
  assert.deepEqual(optimizeTemplate7Images(optimized), optimized);
  assert.deepEqual(optimized.background?.imagesResponsive?.map(item => Object.values(item).map(url => new URL(url).searchParams.get("width"))), [["640", "1024", "1600"]]);
});

test("image derivatives preserve proportions/alpha and do not touch foreign/private URLs", () => {
  const logo = template7Logo(original);
  for (const url of logo.variants) {
    assert.equal(new URL(url).searchParams.get("resize"), "contain");
    assert.equal(new URL(url).searchParams.has("background"), false);
  }
  for (const raw of ["https://example.com/logo.png", "https://evil.test/storage/v1/object/public/landing-images/a.png", "https://audit.supabase.co/storage/v1/object/sign/landing-images/a.png?token=secret", original + "?download=1", original.replace("https:", "http:"), "data:image/png;base64,abc", original.replace("audit.supabase.co", "audit.supabase.co.evil.test")]) {
    assert.equal(template7ImageUrl(raw, 340), raw);
  }
  assert.equal(template7ImageUrl(original, 0), original);
  assert.equal(template7ImageUrl(original, 3000), original);
});

test("templates 1-6 retain image configuration and CSS, with the current attribution runtime", () => {
  for (let template = 1; template <= 6; template++) {
    const config = { ...fixture(), layout: { template, ctaPosition: "bottom" } };
    assert.equal(optimizeTemplate7Images(config), config);
    const html = renderPublicLandingHtml({ slug: "test", config });
    assert.match(html, /src="\/public-assets\/landing-runtime-v6.js" defer/);
    assert.match(html, /href="\/public-assets\/landing-styles-v3.css"/);
    assert.doesNotMatch(html, /data-template7-critical/);
  }
});

for (const provider of ["rey_de_ases", "ases_del_norte", "ganamos_net", "multi_skin"] as const) {
  test(`${provider}: both engines ship a usable inline form and one tracking implementation`, () => {
    const config = fixture(provider);
    const pages = [renderPublicLandingHtml({ slug: "test", config }), renderClassicTemplate7InlineHtml({ slug: "test", config }, "function getOrCreateDeviceId(){return crypto.randomUUID();}")];
    for (const html of pages) {
      assert.match(html, /data-template7-critical/);
      assert.doesNotMatch(html, /<script[^>]+src="\/public-assets\/landing-runtime/);
      assert.doesNotMatch(html, /rel="stylesheet"/);
      assert.match(html, /data-template7-name/);
      assert.match(html, /data-template7-whatsapp/);
      assert.match(html, /fetchpriority="low"/);
      assert.match(html, /data-image-fallback/);
      assert.equal(html.split('function firePixelContact(').length - 1, 1);
      assert.equal(html.split("fbq('track', 'PageView')").length - 1, 1);
      assert.match(html, /form_phone: formPhone/);
      assert.match(html, /promo_code: promoCode/);
      assert.match(html, /event_id: eventId/);
      assert.match(html, /shouldSkipContact = context.shouldSkipContact/);
      for (const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) new Script(match[1]);
      const runtime = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].at(-1)![1];
      assert.doesNotMatch(runtime, /addEventListener\("DOMContentLoaded"/);
      assert.doesNotMatch(runtime, /function initTemplate4LiveDetails/);
    }
    assert.match(pages[0], /fetch\("\/api\/template7\/prepare"/);
    assert.doesNotMatch(pages[0], /device_id: getOrCreateDeviceId/);
    assert.match(pages[1], /fetch\("\/api\/template7\/start"/);
    assert.match(pages[1], /device_id: getOrCreateDeviceId/);
    assert.doesNotMatch(pages[1], /client-identity\/bootstrap|<code>lb_cid<\/code>/);
  });
}

test("inline critical CSS is a small exact subset of existing styles", () => {
  assert.ok(TEMPLATE7_CRITICAL_CSS.length < 12000);
  assert.ok(TEMPLATE7_CRITICAL_CSS.length < PUBLIC_LANDING_CSS.length / 4);
  assert.match(TEMPLATE7_CRITICAL_CSS, /public-privacy-dialog/);
  assert.match(TEMPLATE7_CRITICAL_CSS, /template7__phone-warning/);
  assert.doesNotMatch(TEMPLATE7_CRITICAL_CSS, /template6__|template4__/);
});

test("prewarming starts before image discovery/CSS and is not duplicated", () => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL, previousKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://audit.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "synthetic";
  try {
    const html = renderPublicLandingHtml({ slug: "test", config: fixture() });
    assert.ok(html.indexOf("landing-atrio?name=test") < html.indexOf("<style data-template7-critical>"));
    assert.equal(html.split("landing-atrio?name=test").length - 1, 1);
  } finally {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousKey;
  }
});

test("publication warms exactly the public variants in parallel without sending credentials", async () => {
  const config = fixture();
  assert.equal(template7ImageWarmUrls(config).length, 6);
  const seen: string[] = [];
  const result = await warmTemplate7Images({ landing_config: config }, "https://audit.supabase.co", async (input, init) => {
    seen.push(String(input));
    assert.equal(init?.method, "GET");
    assert.equal(init?.redirect, "error");
    assert.equal(new Headers(init?.headers).has("Authorization"), false);
    return new Response(new Uint8Array([1]), { headers: { "Content-Type": "image/webp" } });
  });
  assert.deepEqual(result, { total: 6, ready: 6 });
  assert.equal(new Set(seen).size, 6);
  assert.equal(imageConfigFromLanding({ config: { template: "template7", logoUrl: original } }).layout.template, 7);
});

test("warming cannot fetch another project, follow redirects or block publication on image failure", async () => {
  const row = { landing_config: fixture() };
  const denied = await warmTemplate7Images(row, "https://other.supabase.co", async () => { throw new Error("must not fetch"); });
  assert.deepEqual(denied, { total: 0, ready: 0 });
  const failed = await warmTemplate7Images(row, "https://audit.supabase.co", async () => new Response(null, { status: 500 }));
  assert.deepEqual(failed, { total: 6, ready: 0 });
});

test("publication only warms images after authorization, ownership and target checks", async () => {
  const landingId = "a0000000-0000-4000-8000-000000000001";
  const actor: Actor = { id: "owner", role: "client" };
  const calls: string[] = [];
  const backend: RevalidationBackend = {
    authenticate: async () => actor,
    landing: async () => ({ id: landingId, user_id: actor.id, name: "test", publish_target: "constructor" }),
    secret: async () => "synthetic-test-secret",
    prepareAssets: async (owner, token, landing) => {
      assert.equal(owner.id, actor.id);
      assert.equal(token, "synthetic");
      assert.equal(landing.id, landingId);
      calls.push("assets");
    },
  };
  const request = (authorized = true, target = "constructor") => new Request("https://panel.invalid/api/revalidation", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(authorized ? { Authorization: "Bearer synthetic" } : {}) },
    body: JSON.stringify({ action: "publish", landingId, publishTarget: target }),
  });
  const dependencies = {
    environment: "production" as const, backend,
    send: async () => { calls.push("revalidate"); return { ok: true, revalidated: true }; },
  };
  assert.equal((await handlePanelRevalidation(request(false), dependencies)).status, 401);
  assert.equal((await handlePanelRevalidation(request(true, "classic"), dependencies)).status, 409);
  assert.equal((await handlePanelRevalidation(request(), { ...dependencies, backend: {
    ...backend, landing: async () => ({ id: landingId, user_id: "someone-else", name: "test", publish_target: "constructor" }),
  } })).status, 403);
  assert.deepEqual(calls, []);
  assert.equal((await handlePanelRevalidation(request(), dependencies)).status, 200);
  assert.deepEqual(calls, ["assets", "revalidate"]);
});
