import assert from "node:assert/strict";
import test from "node:test";
import { checkMetaConnection, MetaConnectionError } from "../lib/meta/connection.server";

const input = { pixelId: "123456789", token: "fixture-token-private", scope: "own-account" };
test("ID and token automatically verify CAPI with a server-generated code, without metadata-read permissions", async () => {
  const calls: { url: string; options: RequestInit }[] = [];
  const result = await checkMetaConnection(input, (async (url, options) => {
    calls.push({ url: String(url), options: options! }); return Response.json({ events_received: 1 });
  }) as typeof fetch);
  assert.equal(result.mode, "test_event"); assert.equal(result.testCodeSource, "generated"); assert.match(result.message, /Conexión CAPI verificada/);
  assert.equal(calls.length, 1); assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].url, "https://graph.facebook.com/v25.0/123456789/events");
  const body=JSON.parse(String(calls[0].options.body));
  assert.match(body.test_event_code,/^TEST\d{6}$/); assert.equal(body.data[0].event_name,"ConnectionTest");
  assert.deepEqual(Object.keys(body.data[0].user_data),["external_id"]);
  assert.ok(!calls[0].url.includes(input.token));
  assert.equal(new Headers(calls[0].options.headers).get("authorization"), `Bearer ${input.token}`);
  await assert.rejects(checkMetaConnection(input, (async () => Response.json({ id: "foreign" })) as typeof fetch), MetaConnectionError);
});
test("CAPI check sends only a diagnostic test event and requires one accepted event", async () => {
  let body: any;
  const result = await checkMetaConnection({ ...input, testEventCode: "TEST_FIXTURE" }, (async (_url, options) => {
    body = JSON.parse(String(options?.body)); return Response.json({ events_received: 1 });
  }) as typeof fetch);
  assert.equal(result.mode, "test_event"); assert.equal(result.testCodeSource,"provided"); assert.equal(body.test_event_code, "TEST_FIXTURE");
  assert.equal(body.data.length, 1); assert.equal(body.data[0].event_name, "ConnectionTest");
  assert.equal(body.data[0].action_source, "system_generated"); assert.match(body.data[0].user_data.external_id[0], /^[a-f0-9]{64}$/);
  assert.deepEqual(Object.keys(body.data[0].user_data), ["external_id"]);
  for (const count of [0, 2, null, "1"]) await assert.rejects(checkMetaConnection({ ...input, testEventCode: "TEST_FIXTURE" },
    (async () => Response.json({ events_received: count })) as typeof fetch), MetaConnectionError);
});
test("only an explicit provider test-code rejection asks for the Events Manager code", async () => {
  for(const error of [{code:100,message:"Invalid test_event_code"},{code:100,message:"Invalid parameter",error_data:{blame_field_specs:[["test_event_code"]]}}]){
    await assert.rejects(checkMetaConnection(input,(async()=>Response.json({error},{status:400})) as typeof fetch),
      error=>error instanceof MetaConnectionError&&error.reason==="meta_test_code_required");
  }
  await assert.rejects(checkMetaConnection(input,(async()=>Response.json({error:{code:200,message:"Permission denied"}},{status:403})) as typeof fetch),
    error=>error instanceof MetaConnectionError&&error.reason==="meta_access_rejected");
  await assert.rejects(checkMetaConnection({...input,testEventCode:"TEST_REAL"},(async()=>Response.json({error:{code:100,message:"Invalid test_event_code"}},{status:400})) as typeof fetch),
    error=>error instanceof MetaConnectionError&&error.reason==="meta_access_rejected");
});
test("credential, permission, outage and malformed responses expose safe messages and never retry", async () => {
  for (const [status, code] of [[400, 190], [403, 200], [429, 4], [503, 2]]) {
    let calls = 0;
    try {
      await checkMetaConnection(input, (async () => { calls++; return Response.json({ error: { code, message: input.token } }, { status }); }) as typeof fetch);
      assert.fail("Expected a rejected probe");
    } catch (error) { assert.ok(error instanceof MetaConnectionError); assert.ok(!error.message.includes(input.token)); }
    assert.equal(calls, 1);
  }
  await assert.rejects(checkMetaConnection(input, (async () => new Response("not json")) as typeof fetch), MetaConnectionError);
  await assert.rejects(checkMetaConnection(input, (async () => { throw Error(input.token); }) as typeof fetch), error => error instanceof MetaConnectionError && !error.message.includes(input.token));
});
test("invalid identifiers, header injection, absent credentials and invalid test code fail before network", async () => {
  let calls = 0;
  const network = (async () => { calls++; return Response.json({}); }) as typeof fetch;
  for (const invalid of [{ pixelId: "../me" }, { token: "" }, { token: "fixture\r\nheader" }, { testEventCode: "bad code" }])
    await assert.rejects(checkMetaConnection({ ...input, ...invalid }, network), MetaConnectionError);
  assert.equal(calls, 0);
});
