import assert from "node:assert/strict";
import test from "node:test";
import { allowBootstrap, allowTemplate7Start, allowTemplate7Warm } from "../lib/reyDeAses/rateLimit.server";

const request = new Request("https://landing.test/api/template7/start", { headers: { "X-Vercel-Forwarded-For": "192.0.2.3" } });
const cases = [
  { name: "bootstrap", limits: [120, 40], run: () => allowBootstrap(request) },
  { name: "warm", limits: [60, 6], run: () => allowTemplate7Warm(request, "device") },
  { name: "start with cookie", limits: [120, 1], run: () => allowTemplate7Start(request, "landing", "device", false) },
  { name: "start without cookie", limits: [120, 1, 1], run: () => allowTemplate7Start(request, "landing", "device", true) },
];
for (const scenario of cases) {
  test(`${scenario.name}: independent durable limits run together and every limit must allow the request`, async () => {
    const oldFetch = globalThis.fetch;
    const previous = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY };
    process.env.SUPABASE_URL = "https://rate-limit.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "synthetic-test-key";
    try {
      for (const deniedIndex of [-1, 0, scenario.limits.length - 1]) {
        const pending: { max: number; finish: (response: Response) => void }[] = [];
        globalThis.fetch = async (input, init) => {
          assert.equal(String(input), "https://rate-limit.test/rest/v1/rpc/consume_template7_rate_limit");
          const body = JSON.parse(String(init?.body));
          assert.match(body.p_bucket_key, /^[a-f0-9]{64}$/);
          return new Promise<Response>(finish => pending.push({ max: body.p_max_hits, finish }));
        };
        const result = scenario.run();
        await new Promise<void>(resolve => setImmediate(resolve));
        assert.deepEqual(pending.map(row => row.max), scenario.limits, "Every request must start before either RPC completes");
        pending.forEach((row, index) => row.finish(Response.json(index !== deniedIndex)));
        assert.equal(await result, deniedIndex === -1);
      }
      const pending: ((response: Response) => void)[] = [];
      globalThis.fetch = async () => new Promise<Response>(finish => pending.push(finish));
      const failed = scenario.run();
      const rejection = assert.rejects(failed, /rate limit database unavailable/);
      await new Promise<void>(resolve => setImmediate(resolve));
      pending.forEach((finish, index) => finish(index ? Response.json(true) : Response.json({ message: "unavailable" }, { status: 503 })));
      await rejection;
    } finally {
      globalThis.fetch = oldFetch;
      if (previous.url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = previous.url;
      if (previous.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = previous.key;
    }
  });
}
