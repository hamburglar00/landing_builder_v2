import assert from "node:assert/strict";
import test from "node:test";
import { getPublicLandingPhone } from "../components/public-landing/getLandingPhone";
import { getPublicLandingConfig } from "../components/public-landing/getLandingConfig";

test("Phase 0: landing transport preserves cache, empty/error and network contracts", async (t) => {
  const oldFetch = globalThis.fetch;
  const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const oldKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.invalid";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "synthetic-key";
  t.after(() => {
    globalThis.fetch = oldFetch;
    if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = oldKey;
  });
  await t.test("phone: one request, encoded name, no-store, preserves reservation", async () => {
    const payload = { phone: "000000001", reservation_id: "synthetic-reservation" };
    let calls = 0;
    globalThis.fetch = async (url, init) => {
      calls++;
      assert.equal(new URL(String(url)).searchParams.get("name"), "synthetic & landing");
      assert.equal(init?.cache, "no-store");
      assert.equal(init?.method, "GET");
      return Response.json(payload);
    };
    assert.deepEqual(await getPublicLandingPhone("synthetic & landing"), payload);
    assert.equal(calls, 1);
  });
  await t.test("phone: empty and HTTP failures return null; transport failures propagate", async () => {
    for (const status of [200, 403, 404, 409, 500, 503]) {
      globalThis.fetch = async () => Response.json({}, { status });
      assert.equal(await getPublicLandingPhone("synthetic"), null);
    }
    globalThis.fetch = async () => { throw new Error("synthetic-network-error"); };
    await assert.rejects(getPublicLandingPhone("synthetic"), /synthetic-network-error/);
    globalThis.fetch = async () => new Response("invalid json");
    await assert.rejects(getPublicLandingPhone("synthetic"), SyntaxError);
  });
  await t.test("configuration: force-cache and exact invalidation tag", async () => {
    globalThis.fetch = async (_url, init) => {
      assert.equal(init?.cache, "force-cache");
      assert.deepEqual((init as RequestInit & { next: unknown }).next, { tags: ["landing-config:synthetic"] });
      return Response.json({ name: "synthetic", currency: "PYG" });
    };
    assert.deepEqual(await getPublicLandingConfig("synthetic"), { name: "synthetic", currency: "PYG" });
  });
  await t.test("configuration: 404/missing name null, other failures throw", async () => {
    for (const status of [200, 404]) {
      globalThis.fetch = async () => Response.json({}, { status });
      assert.equal(await getPublicLandingConfig("synthetic"), null);
    }
    globalThis.fetch = async () => Response.json({}, { status: 503 });
    await assert.rejects(getPublicLandingConfig("synthetic"), /builder-config responded 503/);
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    await assert.rejects(getPublicLandingConfig("synthetic"), /Missing Supabase/);
    await assert.rejects(getPublicLandingPhone("synthetic"), /Missing Supabase/);
  });
});
