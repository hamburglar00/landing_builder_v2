import assert from "node:assert/strict";
import test from "node:test";

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-key";

test("captura un único as_of y limita a ese instante un período que termina hoy", async () => {
  const { buildMetaAudienceRpcParams } = await import("../lib/metaAudienceDb");
  const now = new Date("2026-09-11T15:30:00-03:00");
  const params = buildMetaAudienceRpcParams({
    currency: "ARS",
    range: {
      start: new Date("2026-08-13T00:00:00-03:00"),
      end: new Date("2026-09-11T23:59:59.999-03:00"),
    },
  }, now);
  assert.equal(params.p_as_of, now.toISOString());
  assert.equal(params.p_period_end_at, now.toISOString());
});

test("conserva el fin de día de un período histórico", async () => {
  const { buildMetaAudienceRpcParams } = await import("../lib/metaAudienceDb");
  const historicalEnd = new Date("2026-08-31T23:59:59.999-03:00");
  const params = buildMetaAudienceRpcParams({
    currency: "PYG",
    range: {
      start: new Date("2026-08-01T00:00:00-03:00"),
      end: historicalEnd,
    },
  }, new Date("2026-09-11T15:30:00-03:00"));
  assert.equal(params.p_period_end_at, historicalEnd.toISOString());
});

test("fetch usa el asOf provisto por la resolución del período", async () => {
  const { fetchMetaAudienceBuyersWithClient } = await import("../lib/metaAudienceDb");
  const asOf = new Date("2026-09-11T18:30:00.000Z");
  let received: Record<string, unknown> | undefined;
  const client = {
    rpc: async (_name: string, params: Record<string, unknown>) => {
      received = params;
      return { data: { version: 2, rows: [] }, error: null };
    },
  };
  await fetchMetaAudienceBuyersWithClient(client as never, {
    currency: "ARS",
    range: {
      start: new Date("2026-08-13T03:00:00.000Z"),
      end: asOf,
    },
    asOf,
  });
  assert.equal(received?.p_as_of, asOf.toISOString());
  assert.equal(received?.p_period_end_at, asOf.toISOString());
});
