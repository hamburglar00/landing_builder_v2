import assert from "node:assert/strict";
import test from "node:test";
import { fetchWithEntryRecovery } from "../lib/reyDeAses/request-recovery";
import { resolveTargetAccount, TargetIntegrationError } from "../lib/reyDeAses/integrations.server";

test("partial JSON, body errors and body timeouts resume the same entry request", async () => {
  const originalFetch = globalThis.fetch, originalTimer = globalThis.setTimeout;
  globalThis.setTimeout = ((callback: () => void, ms: number) => originalTimer(callback, ms === 45000 ? 25 : 0)) as typeof setTimeout;
  try {
    for (const scenario of ["truncated", "stream-error", "body-timeout", "always-truncated"]) {
      let calls = 0;
      const bodies: unknown[] = [];
      globalThis.fetch = async (_url, init) => {
        calls++; bodies.push(init?.body);
        if (calls > 1 && scenario !== "always-truncated") return Response.json({ username: "fixture" });
        if (scenario === "truncated" || scenario === "always-truncated") return new Response('{"username":');
        return new Response(new ReadableStream({ start(controller) {
          controller.enqueue(new TextEncoder().encode('{"username":'));
          if (scenario === "stream-error") controller.error(new TypeError("socket closed"));
          else init?.signal?.addEventListener("abort", () => controller.error(new DOMException("timeout", "AbortError")), { once: true });
        }}));
      };
      if (scenario === "always-truncated") await assert.rejects(fetchWithEntryRecovery("/entry", { body: "same-intent" }));
      else assert.deepEqual(await (await fetchWithEntryRecovery("/entry", { body: "same-intent" })).json(), { username: "fixture" });
      assert.equal(calls, scenario === "always-truncated" ? 4 : 2);
      assert.deepEqual([...new Set(bodies)], ["same-intent"]);
    }
    let forbiddenCalls = 0;
    globalThis.fetch = async () => {
      forbiddenCalls++;
      return new Response(new ReadableStream({ start(c) { c.error(new Error("body lost")); } }), { status: 403 });
    };
    assert.equal((await fetchWithEntryRecovery("/entry", { body: "same-intent" })).status, 403);
    assert.equal(forbiddenCalls, 1, "Permanent HTTP failure never retries even if its body is broken");
  } finally { globalThis.fetch = originalFetch; globalThis.setTimeout = originalTimer; }
});

test("entry recovery keeps the exact request, respects Retry-After and stops on permanent errors", async () => {
  const originalFetch = globalThis.fetch, originalTimer = globalThis.setTimeout;
  const body = JSON.stringify({ token: "p1.fixture-same-intent" });
  const requests: string[] = [], waits: number[] = [];
  // Abort deadlines stay real; retry delays are recorded and accelerated.
  globalThis.setTimeout = ((callback: () => void, ms: number) => {
    if (ms !== 45000) waits.push(ms);
    return originalTimer(callback, ms === 45000 ? ms : 0);
  }) as typeof setTimeout;
  try {
    const outcomes = [new TypeError("connection lost"), Response.json({}, { status: 429, headers: { "Retry-After": "2" } }), Response.json({}, { status: 503 }), Response.json({ ok: true })];
    globalThis.fetch = async (_url, init) => {
      requests.push(String(init?.body));
      const result = outcomes.shift()!;
      if (result instanceof Error) throw result;
      return result;
    };
    assert.equal((await fetchWithEntryRecovery("/entry", { method: "POST", body })).status, 200);
    assert.deepEqual(requests, [body, body, body, body]);
    assert.deepEqual(waits, [500, 2000, 3500]);
    for (const [status, payload] of [[403, {}], [410, {}], [503, { retryable: false }], [503, { error: "integration_pending" }]] as const) {
      let calls = 0;
      globalThis.fetch = async () => { calls++; return Response.json(payload, { status }); };
      assert.equal((await fetchWithEntryRecovery("/entry", { body })).status, status);
      assert.equal(calls, 1);
    }
    let calls = 0;
    globalThis.fetch = async () => { calls++; return Response.json({}, { status: 503 }); };
    assert.equal((await fetchWithEntryRecovery("/entry", { body })).status, 503);
    assert.equal(calls, 4, "No unbounded retry loop");
  } finally { globalThis.fetch = originalFetch; globalThis.setTimeout = originalTimer; }
});

test("API2 failure classification crosses the private integration without leaking error bodies", async () => {
  const original = globalThis.fetch;
  const keys = ["API2_ORIGIN", "API2_API_KEY", "API2_API_SECRET"] as const;
  const values = keys.map(key => process.env[key]);
  Object.assign(process.env, { API2_ORIGIN: "https://api.fixture.test", API2_API_KEY: "fixture", API2_API_SECRET: "fixture" });
  try {
    for (const [status, retryable] of [[409, true], [503, true], [500, false], [403, false]] as const) {
      globalThis.fetch = async () => Response.json({ code: "fixture", error: { message: "private upstream detail", retryable } }, { status });
      await assert.rejects(resolveTargetAccount({ external_user_id: "fixture", name: "Fixture", advisor_id: "fixture", advisor_slug: "fixture", agency_id: 280, manager_id: 1044, target_provider: "ganamos_net" }), error => {
        assert.ok(error instanceof TargetIntegrationError);
        assert.equal(error.retryable, retryable);
        assert.equal(error.message, "upstream_unavailable");
        return true;
      });
    }
  } finally {
    globalThis.fetch = original;
    keys.forEach((key, index) => { if (values[index] === undefined) delete process.env[key]; else process.env[key] = values[index]; });
  }
});
