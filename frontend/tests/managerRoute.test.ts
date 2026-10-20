import assert from "node:assert/strict";
import test from "node:test";
import { handleManagerRoute, type ManagerRouteBackend } from "../lib/atrio/managerRoute.server";

const landingId = "11111111-1111-4111-8111-111111111111";
const atrioClientId = "22222222-2222-4222-8222-222222222222";
const advisorId = "33333333-3333-4333-8333-333333333333";
const connectionId = "44444444-4444-4444-8444-444444444444";
const payload = { landingId, atrioClientId, targetProvider: "rey_de_ases" };
const req = (value: unknown = payload, auth = true) => new Request("https://builder.test/api/atrio/manager-routes", {
  method: "POST", headers: { "Content-Type": "application/json", ...(auth ? { Authorization: "Bearer session" } : {}) }, body: JSON.stringify(value),
});
function fixture() {
  const calls: unknown[] = [];
  const backend: ManagerRouteBackend = {
    authenticate: async () => true,
    landing: async () => ({ id: landingId, user_id: "owner", workspace_currency: "ARS" }),
    advisor: async () => ({ id: atrioClientId, user_id: "owner", workspace_currency: "ARS", atrio_id: advisorId }),
    configure: async (input) => { calls.push(input); return { connection_id: connectionId, connections: [] }; },
  };
  return { backend, calls };
}
test("manager routes derive advisor identity from the authorized saved record", async () => {
  const { backend, calls } = fixture();
  assert.equal((await handleManagerRoute(req({ ...payload, connectionId }), backend)).status, 200);
  assert.deepEqual(calls, [{ advisor_id: advisorId, landing_id: landingId, target_provider: "rey_de_ases", connection_id: connectionId }]);
});
test("manager routes reject missing authentication and browser-supplied advisor IDs", async () => {
  const { backend, calls } = fixture();
  assert.equal((await handleManagerRoute(req(payload, false), backend)).status, 401);
  backend.authenticate = async () => false;
  assert.equal((await handleManagerRoute(req(), backend)).status, 401);
  backend.authenticate = async () => true;
  assert.equal((await handleManagerRoute(req({ ...payload, advisor_id: advisorId }), backend)).status, 400);
  assert.equal(calls.length, 0);
});
test("manager routes reject inaccessible landings and cross-owner/workspace advisors", async () => {
  const { backend, calls } = fixture();
  backend.landing = async () => null;
  assert.equal((await handleManagerRoute(req(), backend)).status, 403);
  backend.landing = async () => ({ id: landingId, user_id: "owner", workspace_currency: "ARS" });
  backend.advisor = async () => ({ id: atrioClientId, user_id: "other", workspace_currency: "ARS", atrio_id: advisorId });
  assert.equal((await handleManagerRoute(req(), backend)).status, 403);
  backend.advisor = async () => ({ id: atrioClientId, user_id: "owner", workspace_currency: "USD", atrio_id: advisorId });
  assert.equal((await handleManagerRoute(req(), backend)).status, 403);
  assert.equal(calls.length, 0);
});
test("manager routes reject foreign origins, malformed payloads and oversized bodies", async () => {
  const { backend, calls } = fixture();
  const crossOrigin = req(); crossOrigin.headers.set("origin", "https://foreign.test");
  assert.equal((await handleManagerRoute(crossOrigin, backend)).status, 403);
  for (const value of [{ ...payload, targetProvider: "unknown" }, { ...payload, connectionId: "bad" }, []]) {
    assert.equal((await handleManagerRoute(req(value), backend)).status, 400);
  }
  assert.equal((await handleManagerRoute(req({ ...payload, padding: "x".repeat(3000) }), backend)).status, 413);
  assert.equal(calls.length, 0);
});
