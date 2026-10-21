import {
  describeTrackingException,
  observeTrackingRequest,
  TrackingDiagnostics,
} from "./tracking_diagnostics.ts";

Deno.test("internal exceptions retain a bounded diagnosis without credentials or quoted payloads", () => {
  const error = Object.assign(
    new Error(
      "duplicate value 'Private Person' password=private-secret token=private-token user@example.test 5491111111111",
    ),
    { code: "23505" },
  );
  const details = describeTrackingException(error);
  assert(details.exception_code === "23505");
  assert(String(details.error_message).includes("duplicate value"));
  for (
    const secret of [
      "Private Person",
      "private-secret",
      "private-token",
      "user@example.test",
      "5491111111111",
    ]
  ) assert(!JSON.stringify(details).includes(secret));
});

const id = "11111111-1111-4111-8111-111111111111";
const assert = (condition: unknown, message = "Assertion failed") => {
  if (!condition) throw new Error(message);
};
const request = (headers: Record<string, string> = {}) =>
  new Request("https://fixture.test/conversions", { method: "POST", headers });

Deno.test("structured errors opt in; legacy statuses and text stay unchanged", async () => {
  for (const structured of [false, true]) {
    const response = await observeTrackingRequest(
      request({
        "x-request-id": id,
        ...(structured ? { "x-tracking-diagnostics": "1" } : {}),
      }),
      async (trace) => {
        trace.failure = {
          error_code: "tenant_identifier_mismatch",
          message: "Cliente incorrecto",
          retryable: false,
          details: { signal: "gerencia", reason: "foreign_owner" },
        };
        return new Response("Legacy rejection", { status: 422 });
      },
      () => {},
    );
    assert(response.status === 422);
    assert(response.headers.get("x-request-id") === id);
    assert(
      response.headers.get("x-tracking-error-code") ===
        "tenant_identifier_mismatch",
    );
    if (structured) {
      const body = await response.json();
      assert(
        body.request_id === id && body.details.signal === "gerencia" &&
          body.details.reason === "foreign_owner",
      );
    } else assert(await response.text() === "Legacy rejection");
  }
});

Deno.test("success, deduplication and deferred responses retain exact bytes", async () => {
  for (
    const [status, body] of [[200, "Evento Purchase enviado"], [
      200,
      "Duplicado ignorado",
    ], [202, "En espera"]] as const
  ) {
    const response = await observeTrackingRequest(
      request({ "x-tracking-diagnostics": "1" }),
      async () => new Response(body, { status }),
      () => {},
    );
    assert(response.status === status && await response.text() === body);
  }
});

Deno.test("invalid request IDs and attempts cannot inject log data", () => {
  const trace = new TrackingDiagnostics(
    request({
      "x-request-id": "password=must-not-appear",
      "x-tracking-attempt": "999",
    }),
  );
  assert(trace.requestId !== "password=must-not-appear" && trace.attempt === 1);
  trace.setEvent({
    action: "PURCHASE",
    action_event_id: 22,
    manager_id: 1042,
    phone: "5491111111111",
    full_name: "Private Person",
    access_token: "private-token",
  });
  const record = JSON.stringify(trace.reference());
  for (const secret of ["5491111111111", "Private Person", "private-token"]) {
    assert(!record.includes(secret));
  }
});

Deno.test("existing database log fields survive added correlation metadata", () => {
  const trace = new TrackingDiagnostics(request({ "x-request-id": id }));
  trace.setEvent({ action: "PURCHASE", action_event_id: 123 });
  const detail = JSON.parse(
    trace.annotateDetail(
      JSON.stringify({ signal: "gerencia", reason: "foreign_owner" }),
    ),
  );
  assert(detail.request_id === id && detail.action_event_id === "123");
  assert(detail.signal === "gerencia" && detail.reason === "foreign_owner");
  assert(
    JSON.parse(trace.annotateDetail("Original plain text")).detail ===
      "Original plain text",
  );
});

Deno.test("concurrent requests never share correlation or event state", async () => {
  const records: Record<string, unknown>[] = [];
  await Promise.all(
    [1, 2].map((event) =>
      observeTrackingRequest(request(), async (trace) => {
        trace.setEvent({ action: "PURCHASE", action_event_id: event });
        await Promise.resolve();
        return new Response("ok");
      }, (record) => records.push(record))
    ),
  );
  assert(records[0].request_id !== records[1].request_id);
  assert(new Set(records.map((record) => record.action_event_id)).size === 2);
});

Deno.test("logging failure never turns an accepted event into another delivery", async () => {
  let calls = 0;
  const response = await observeTrackingRequest(request(), async () => {
    calls++;
    return new Response("Accepted");
  }, () => {
    throw new Error("Logger unavailable");
  });
  assert(
    calls === 1 && response.status === 200 &&
      await response.text() === "Accepted",
  );
});

Deno.test("unknown actions and unexpected exceptions never echo credentials", async () => {
  const headers = { "x-tracking-diagnostics": "1" };
  const invalid = await observeTrackingRequest(
    request(headers),
    async () =>
      new Response("Action desconocida: secret-token", { status: 400 }),
    () => {},
  );
  const unexpected = await observeTrackingRequest(
    request(headers),
    async () => {
      throw new Error("password=private");
    },
    () => {},
  );
  assert(!(await invalid.text()).includes("secret-token"));
  assert(!(await unexpected.text()).includes("private"));
});
