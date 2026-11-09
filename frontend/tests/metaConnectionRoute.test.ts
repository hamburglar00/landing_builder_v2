import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { POST } from "../app/api/meta/connection/route";
function fixture(t: TestContext) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://builder.fixture.invalid";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "synthetic-public-key";
  const uid = crypto.randomUUID(), calls: string[] = [];
  const state = { role: "client", authenticated: true, anonymous: false, metaFail: false };
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, options?: RequestInit) => {
    const url = String(input); calls.push(url);
    if (url.includes("/auth/v1/user")) return Response.json(state.authenticated ? { id: uid, aud: "authenticated", role: "authenticated", email: "fixture@example.invalid", is_anonymous: state.anonymous } : { message: "invalid" }, { status: state.authenticated ? 200 : 401 });
    if (url.includes("/rest/v1/profiles")) { assert.ok(url.includes(uid)); return Response.json({ role: state.role }); }
    assert.ok(url.startsWith("https://graph.facebook.com/"), "only the official provider can receive the supplied token");
    assert.ok(!url.includes("synthetic-private-token"));
    assert.equal(new Headers(options?.headers).get("authorization"), "Bearer synthetic-private-token");
    assert.equal(options?.method,"POST");
    const body=JSON.parse(String(options?.body));assert.match(body.test_event_code,/^TEST\d{6}$/);assert.equal(body.data[0].event_name,"ConnectionTest");
    return state.metaFail ? Response.json({ error: { code: 190, message: "synthetic-private-token" } }, { status: 400 }) : Response.json({ events_received: 1 });
  });
  const post = (body: unknown = {}, headers: Record<string,string> = {}) => POST(new Request("https://builder.fixture.invalid/api/meta/connection", { method: "POST", headers: { authorization: "Bearer synthetic-session", "content-type": "application/json", origin: "https://builder.fixture.invalid", ...headers }, body: JSON.stringify({ pixelId: "123456789", token: "synthetic-private-token", ...body as object }) }));
  return { state, calls, post };
}
test("connection probe requires a verified, non-anonymous client or admin and never trusts browser scope", async t => {
  const { state, calls, post } = fixture(t);
  for (const role of ["client", "admin"]) { state.role = role; const response = await post({ userId: "foreign" }); assert.equal(response.status,200); assert.equal(response.headers.get("cache-control"),"private, no-store"); }
  const contacted = calls.filter(url => url.includes("graph.facebook.com")).length;
  state.role = "advisor"; assert.equal((await post()).status,403);
  state.anonymous = true; assert.equal((await post()).status,401);
  state.anonymous = false; state.authenticated = false; assert.equal((await post()).status,401);
  assert.equal(calls.filter(url => url.includes("graph.facebook.com")).length,contacted);
});
test("cross-origin, absent auth and malformed media are rejected before provider calls", async t => {
  const { post, calls } = fixture(t);
  assert.equal((await post({}, { origin:"https://foreign.invalid" })).status,403);
  assert.equal((await post({}, { authorization:"" })).status,401);
  assert.equal((await post({}, { "content-type":"text/plain" })).status,415);
  assert.deepEqual(calls,[]);
});
test("provider errors never expose tokens and excessive requests are bounded", async t => {
  const { state, post, calls } = fixture(t); state.metaFail = true;
  for (let i=0;i<8;i++) { const response=await post(); assert.equal(response.status,422); assert.ok(!JSON.stringify(await response.json()).includes("synthetic-private-token")); }
  assert.equal((await post()).status,429); assert.equal(calls.filter(url=>url.includes("graph.facebook.com")).length,8);
});
