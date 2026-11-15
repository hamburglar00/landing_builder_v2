import test from "node:test";
import assert from "node:assert/strict";
import { signGatewayLandingRequest, GATEWAY_LANDING_PROOF_HEADER } from "../lib/gateway-landing-contract";
import { handleGatewayLanding, type GatewayLandingDependencies, type GatewayLandingRow } from "../lib/landing/gatewayLanding.server";
import { renderPublicLandingHtml } from "../components/public-landing/renderPublicLandingHtml";
import { buildTemplate7FastRuntime } from "../components/public-landing/template7FastRuntime";
import { buildClientIdentityBootstrapScript } from "../components/public-landing/clientIdentityBootstrapScript";
import type { PublicLandingConfig } from "../components/public-landing/types";
import { buildLandingPublicUrl } from "../lib/landing/publicUrls";
import { gatewayPublicationOrigin, supportsGatewayPublication } from "../lib/landing/gatewayPublication";

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", owner = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const key = "test-key-not-production-".repeat(3), origin = "https://gateway.example.test";
const row: GatewayLandingRow = { id, user_id: owner, name: "demo", publish_target: "gateway", landing_type: "internal", pixel_id: "123",
  config: { template: "template9", ctaDestination: "atrio", targetProvider: "ganamos_net" }, landing_config: {} };
function setup(operation = "template7/destination", payload: object = { landing_id: id, landing_slug: "demo" }, resource = "api") {
  let dispatched: Request | undefined, rendered = 0;
  const body = resource === "api" ? JSON.stringify(payload) : "", cookie = `lb_cid=${id}`;
  const method = resource === "api" ? "POST" : "GET", contentType = resource === "api" ? "application/json" : "";
  const input = { backend: "builder" as const, origin, slug: "demo", provider: "ganamos_net" as const, skin: null,
    resource: resource as "api" | "document" | "asset", operation, method: method as "GET" | "POST", contentType, body, cookie,
    clientIp: "203.0.113.4", userAgent: "Fixture browser" };
  const proof = signGatewayLandingRequest(input, key);
  const headers = new Headers({ [GATEWAY_LANDING_PROOF_HEADER]: proof, Cookie: cookie, Authorization: "Bearer must-not-forward", "X-Forwarded-For": "198.51.100.8", Origin: "https://forged.invalid" });
  if (contentType) headers.set("Content-Type", contentType);
  const request = new Request(`https://builder.example.test/api/gateway-landings/ganamos_net/demo/${resource}/${operation}`, { method, headers, ...(body ? { body } : {}) });
  const deps: GatewayLandingDependencies = { env: { GANAMOS_NET_GATEWAY_HANDOFF_API_KEY: key, GANAMOS_NET_GATEWAY_ORIGIN: origin },
    landing: async () => structuredClone(row), blocked: async () => false,
    render: async () => { rendered++; return new Response("html"); },
    dispatch: async (_operation, value) => { dispatched = value; return Response.json({ ok: true }); },
  };
  return { request, deps, path: { provider: "ganamos_net", slug: "demo", resource: [resource, ...operation.split("/")] },
    input, get dispatched() { return dispatched; }, get rendered() { return rendered; } };
}
test("verified metadata preserves visitor IP/UA and CID without forwarding unrelated cookies/auth/headers", async () => {
  const f = setup(); assert.equal((await handleGatewayLanding(f.request, f.path, f.deps)).status, 200);
  assert.equal(f.dispatched!.url, origin + "/api/template7/destination");
  assert.equal(f.dispatched!.headers.get("cookie"), `lb_cid=${id}`);
  assert.equal(f.dispatched!.headers.get("x-forwarded-for"), "203.0.113.4");
  assert.equal(f.dispatched!.headers.get("user-agent"), "Fixture browser");
  assert.equal(f.dispatched!.headers.get("origin"), origin);
  assert.equal(f.dispatched!.headers.get("authorization"), null);
});
test("signature/body/cookie tampering and direct calls never reach the canonical handler", async () => {
  for (const mutate of [
    (r: Request) => r.headers.delete(GATEWAY_LANDING_PROOF_HEADER),
    (r: Request) => r.headers.set("Cookie", `lb_cid=${owner}`),
    (r: Request) => r.headers.set("Cookie", `lb_cid=${id}; gw_session=private`),
  ]) { const f = setup(); mutate(f.request); assert.ok((await handleGatewayLanding(f.request, f.path, f.deps)).status >= 400); assert.equal(f.dispatched, undefined); }
  const f = setup(); const changed = new Request(f.request, { body: JSON.stringify({ landing_id: owner }) });
  assert.equal((await handleGatewayLanding(changed, f.path, f.deps)).status, 401);
});
test("every request rechecks target, template, owner and exact host/provider/skin", async () => {
  for (const patch of [ { publish_target: "classic" }, { landing_type: "external" },
    { config: { ...row.config as object, template: "template8" } }, { config: { ...row.config as object, ctaDestination: "whatsapp" } },
    { config: { ...row.config as object, targetProvider: "ases_del_norte" } } ]) {
    const f = setup(); f.deps.landing = async () => ({ ...row, ...patch });
    assert.equal((await handleGatewayLanding(f.request, f.path, f.deps)).status, 404); assert.equal(f.dispatched, undefined);
  }
  const blocked = setup(); blocked.deps.blocked = async () => true;
  assert.equal((await handleGatewayLanding(blocked.request, blocked.path, blocked.deps)).status, 404);
  const host = setup(); host.deps.env.GANAMOS_NET_GATEWAY_ORIGIN = "https://other.example.test";
  assert.equal((await handleGatewayLanding(host.request, host.path, host.deps)).status, 404);
});
test("closed operations and payload landing scope reject other landings; empty non-multiskin attribution stays compatible", async () => {
  const wrong = setup("template7/destination", { landing_id: owner, landing_slug: "demo" });
  assert.equal((await handleGatewayLanding(wrong.request, wrong.path, wrong.deps)).status, 400);
  const prepare = setup("template7/prepare", { landing_id: id, landing_slug: "demo", attribution: { target_provider: "ganamos_net", skin_code: "" } });
  assert.equal((await handleGatewayLanding(prepare.request, prepare.path, prepare.deps)).status, 200);
  const unknown = setup(); unknown.path.resource = ["api", "template7", "preparations", "account"];
  assert.equal((await handleGatewayLanding(unknown.request, unknown.path, unknown.deps)).status, 404);
});
test("gateway document uses the same form/Meta runtime with scoped first-party endpoints and brand assets", () => {
  const config: PublicLandingConfig = { schemaVersion: 1, updatedAt: "2026-11-14", id, name: "demo", comment: "", layout: { template: 9, ctaPosition: "bottom" },
    tracking: { pixelId: "123", postUrl: "https://example.supabase.co/functions/v1/conversions", landingTag: "LP", ctaDestination: "atrio", target_provider: "ganamos_net" } };
  const html = renderPublicLandingHtml({ slug: "demo", config, engine: "gateway", canonicalUrl: origin + "/l/demo", apiBase: "/l/demo/_api", assetBase: "/l/demo/_assets", recoveryNamespace: "template7:gateway:builder:identity-recovery:v1" });
  assert.match(html, /data-template7-form/); assert.match(html, /\/l\/demo\/_assets\/public-assets\/template9\/ganamos_net_logo.webp/);
  assert.match(html, /\/l\/demo\/_assets\/vendor\/meta-capi-param-builder/);
  assert.match(html, /\/l\/demo\/_assets\/vendor\/atrio-meta-click/);
  assert.match(html, /template7:gateway:builder:identity-recovery:v1/);
  assert.match(html, /"engine":"gateway"/); assert.doesNotMatch(html, /__TEMPLATE7_REENTRY_PENDING__/);
  assert.match(buildTemplate7FastRuntime("demo", config), /cfg.apiBase/);
  const bootstrap = buildClientIdentityBootstrapScript({ landingId: id, slug: "demo" }, { apiBase: "/l/demo/_api" });
  assert.match(bootstrap, /"\/l\/demo\/_api\/client-identity\/bootstrap"/);
});
test("editor URL resolves only supported template/provider using configured public origins", () => {
  const config = { template: "template9" as const, ctaDestination: "atrio" as const, targetProvider: "ganamos_net" as const };
  assert.equal(gatewayPublicationOrigin(config, { ganamos_net: origin }), origin);
  assert.equal(supportsGatewayPublication({ ...config, template: "template8" }), false);
  assert.equal(buildLandingPublicUrl("demo", "gateway", null, origin), origin + "/l/demo");
  assert.equal(buildLandingPublicUrl("demo", "classic"), "https://landing.panelbotadmin.com/demo");
});
