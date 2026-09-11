import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";

const dataApiUrl = process.env.META_AUDIENCE_DATA_API_TEST_URL;
const accessToken = process.env.META_AUDIENCE_DATA_API_TEST_JWT;

test("Data API entrega más de 1.000 compradores sin truncar ni duplicar", {
  skip: !dataApiUrl || !accessToken ? "requiere el fixture local de Data API" : false,
}, async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = dataApiUrl;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "local-data-api-test";
  const token = accessToken as string;

  const rewriteDataApiPath: typeof fetch = async (input, init) => {
    const originalUrl = typeof input === "string" || input instanceof URL ? String(input) : input.url;
    const rewrittenUrl = new URL(originalUrl);
    rewrittenUrl.pathname = rewrittenUrl.pathname.replace(/^\/rest\/v1/, "");
    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${token}`);
    return fetch(rewrittenUrl, { ...init, headers });
  };
  const client = createClient(dataApiUrl as string, "local-data-api-test", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: rewriteDataApiPath,
      headers: { Authorization: `Bearer ${token}` },
    },
  });
  const { fetchMetaAudienceBuyersWithClient } = await import("../lib/metaAudienceDb");
  const people = await fetchMetaAudienceBuyersWithClient(client, {
    currency: "ARS",
    range: {
      start: new Date("2026-01-01T00:00:00Z"),
      end: new Date("2026-12-31T23:59:59.999Z"),
    },
  });

  assert.ok(people.length > 1_000, `se esperaban más de 1.000 compradores y llegaron ${people.length}`);
  assert.equal(new Set(people.map((person) => person.key)).size, people.length);
});
