import { metaTransportLog } from "./meta_transport_log.ts";
const eq = (a: unknown, b: unknown) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw Error(JSON.stringify({ actual: a, expected: b })); };
Deno.test("captures real HTTP status and response version, without URL credentials", () => {
  const data = metaTransportLog("https://graph.facebook.com/v25.0/123/events?access_token=private-token", 2,
    new Response("{}", { status: 201, headers: { "facebook-api-version": "v26.0" } }));
  eq(data, { meta_api_version: "v26.0", meta_http_status: 201, meta_attempt: 2 });
});
Deno.test("network failure has no invented HTTP response or version upgrade", () => {
  eq(metaTransportLog("https://graph.facebook.com/v26.0/123/events?access_token=private-token", 3),
    { meta_api_version: "v26.0", meta_http_status: null, meta_attempt: 3 });
});
Deno.test("rejects malformed metadata and preserves explicit version pins", () => {
  eq(metaTransportLog("https://graph.facebook.com/v24.0/123/events", 1,
    new Response("", { status: 429, headers: { "facebook-api-version": "untrusted-text" } })),
    { meta_api_version: "v24.0", meta_http_status: 429, meta_attempt: 1 });
  eq(metaTransportLog("not a url with private-token", -1), { meta_api_version: null, meta_http_status: null, meta_attempt: null });
});
