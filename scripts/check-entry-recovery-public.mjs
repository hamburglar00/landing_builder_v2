// Production HTTP checks only. Never execute landing scripts, submit a name,
// authenticate with a provider or persist a funnel/Meta conversion.
import assert from "node:assert/strict";

const gateways = ["https://www.reydeases.fun", "https://www.asesdelnorte.online", "https://www.ganamosnet.icu",
  "https://multi-skin-gateway.vercel.app", "https://ganamosnet.global", "https://multi-skin-gateway.meta-ip-collector.workers.dev"];
const selected = process.argv.find(value => value.startsWith("--origin="))?.slice(9);
const checks = [];
async function read(url, init) {
  const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(20000), ...init });
  const body = await response.text();
  return { response, body };
}
for (const origin of gateways.filter(value => !selected || value === selected)) {
  const page = await read(origin + "/prepare?t=public-fixture&landing=diana&new_meta_parameter=ok&new_meta_parameter=other");
  assert.equal(page.response.status, 200, origin + " prepare");
  assert(page.body.includes('"/api/entry/renew"'), origin + " updated preparation runtime");
  assert(page.body.includes("retryCapability"), origin + " in-memory retry nonce");
  checks.push({ origin, check: "prepare-with-unknown-parameters", ok: true });
  const client = await read(origin + "/gateway-client.js");
  assert.equal(client.response.status, 200);
  assert(client.body.includes("/api/chat/renew") && client.body.includes("iframe_loaded"), origin + " current chat runtime");
  checks.push({ origin, check: "chat-renewal-and-diagnostics-runtime", ok: true });
  for (const [path, payload, expected] of [["/api/entry/renew", { nonce: "a".repeat(64) }, 410], ["/api/chat/renew", { token: "invalid-fixture" }, 409]]) {
    for (const foreign of [false, true]) {
      const { response, body } = await read(origin + path, { method: "POST", headers: { origin: foreign ? "https://foreign.invalid" : origin, "content-type": "application/json" }, body: JSON.stringify(payload) });
      assert.equal(response.status, foreign ? 403 : expected, origin + path + (foreign ? " foreign" : " unauthenticated"));
      assert(!response.headers.has("set-cookie"), "rejected request cannot authenticate");
      assert(!/password|handoff_url|chat_url/.test(body), "no access data on rejected request");
      checks.push({ origin, check: path + (foreign ? ":foreign-origin" : ":no-authority"), ok: true });
    }
  }
}
console.log(JSON.stringify({ mode: "HTTP-only, no player or conversion writes", checks }, null, 2));
