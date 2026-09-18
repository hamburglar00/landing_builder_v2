import test from "node:test";
import assert from "node:assert/strict";

test("safe settings, status and publication preserve client behavior without secret transport", async t => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "synthetic-anon";
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousKey;
  });
  const { supabase } = await import("../lib/supabaseClient");
  t.mock.method(supabase.auth, "getSession", async () => ({ data: { session: { access_token: "synthetic-session" } }, error: null }));
  const { getSettings, updateSettings } = await import("../lib/settingsDb");
  const { publishLandingChanges } = await import("../lib/landing/publishLanding");
  const { getRevalidationStatus, requestRevalidation } = await import("../lib/revalidation/client");
  const canary = "phase1b2-local-only-synthetic-0000000000000000";
  const landingId = "72000000-0000-4000-8000-000000000001";
  const calls: { url: string; method: string; body?: string }[] = [];
  let configured = true, fail = false;
  globalThis.fetch = async (input, init) => {
    const url = String(input), method = init?.method || "GET";
    calls.push({ url, method, body: typeof init?.body === "string" ? init.body : undefined });
    if (url.startsWith("http://127.0.0.1:54321/rest/v1/settings")) {
      if (method === "PATCH") return new Response(null, { status: 204 });
      assert.equal(new URL(url).searchParams.get("select"), "id,url_base,show_client_landing_preview");
      return Response.json({ id: 1, url_base: "https://links.example.invalid", show_client_landing_preview: true, revalidate_secret: canary });
    }
    assert.equal(url, "/api/landings/revalidate");
    assert.equal(init?.redirect, "error");
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer synthetic-session");
    if (fail) throw new Error(canary);
    return Response.json(method === "GET" ? { configured, secret: canary } : { ok: true, revalidated: true, secret: canary });
  };
  await t.test("settings projection discards an unexpected sensitive field", async () => {
    assert.deepEqual(await getSettings(), { id: 1, url_base: "https://links.example.invalid", show_client_landing_preview: true });
  });
  await t.test("unknown settings updates fail before any network call", async () => {
    const before = calls.length;
    for (const key of ["revalidate_secret", "revalidateSecret", "url"]) await assert.rejects(
      updateSettings({ urlBase: "https://mixed.example.invalid", [key]: canary }), error => !String(error).includes(canary),
    );
    assert.equal(calls.length, before);
    await updateSettings({ urlBase: "https://safe.example.invalid", showClientLandingPreview: false });
    assert.deepEqual(JSON.parse(calls.at(-1)!.body!), { url_base: "https://safe.example.invalid", show_client_landing_preview: false });
  });
  await t.test("administrative status exposes only a boolean", async () => {
    assert.equal(await getRevalidationStatus(), true); configured = false; assert.equal(await getRevalidationStatus(), false);
  });
  await t.test("public URL edits cannot change the request destination or body", async () => {
    for (const classicBaseUrl of ["https://first.example.invalid", "https://second.example.invalid"]) {
      const result = await publishLandingChanges({ landingId, name: "synthetic", publishTarget: "classic", classicBaseUrl });
      assert.deepEqual(result, { publicUrl: classicBaseUrl + "/synthetic", revalidated: true });
      assert.equal(calls.at(-1)!.url, "/api/landings/revalidate");
      assert.deepEqual(JSON.parse(calls.at(-1)!.body!), { action: "publish", landingId, publishTarget: "classic" });
    }
    assert.ok(!JSON.stringify(calls).includes(canary));
    assert.deepEqual(await requestRevalidation({ action: "test-classic", landingId, publishTarget: "classic" }), { ok: true, revalidated: true });
  });
  await t.test("classic failure remains best effort; constructor warns after saving", async () => {
    fail = true;
    assert.equal((await publishLandingChanges({ landingId, name: "synthetic", publishTarget: "classic" })).revalidated, false);
    await assert.rejects(publishLandingChanges({ landingId, name: "synthetic", publishTarget: "constructor" }), error => {
      assert.ok(String(error).includes("La landing se guard")); assert.ok(!String(error).includes(canary)); return true;
    });
  });
});
