import assert from "node:assert/strict";
import test from "node:test";
import {
  ensureRealtimeAuth,
  type SupabaseRealtimeAuthClient,
} from "../lib/supabaseRealtimeAuth";

function makeClient({
  session,
  refreshedSession,
  sessionError = null,
  refreshError = null,
}: {
  session: Awaited<
    ReturnType<SupabaseRealtimeAuthClient["auth"]["getSession"]>
  >["data"]["session"];
  refreshedSession?: Awaited<
    ReturnType<SupabaseRealtimeAuthClient["auth"]["refreshSession"]>
  >["data"]["session"];
  sessionError?: { message?: string } | null;
  refreshError?: { message?: string } | null;
}) {
  const tokens: string[] = [];
  let refreshCalls = 0;
  const client: SupabaseRealtimeAuthClient = {
    auth: {
      getSession: async () => ({ data: { session }, error: sessionError }),
      refreshSession: async () => {
        refreshCalls += 1;
        return {
          data: { session: refreshedSession ?? null },
          error: refreshError,
        };
      },
    },
    realtime: {
      setAuth: (token) => {
        tokens.push(token);
      },
    },
  };

  return {
    client,
    tokens,
    get refreshCalls() {
      return refreshCalls;
    },
  };
}

test("prepara realtime con el JWT vigente sin refrescar", async () => {
  const now = Math.floor(Date.now() / 1000);
  const fake = makeClient({
    session: {
      access_token: "token-vigente",
      expires_at: now + 600,
      user: { id: "user-1" },
    },
  });

  const result = await ensureRealtimeAuth(fake.client);

  assert.deepEqual(result, { ok: true, userId: "user-1" });
  assert.equal(fake.refreshCalls, 0);
  assert.deepEqual(fake.tokens, ["token-vigente"]);
});

test("refresca el JWT antes de suscribirse si esta por vencer", async () => {
  const now = Math.floor(Date.now() / 1000);
  const fake = makeClient({
    session: {
      access_token: "token-vencido",
      expires_at: now + 10,
      user: { id: "user-1" },
    },
    refreshedSession: {
      access_token: "token-refrescado",
      expires_at: now + 600,
      user: { id: "user-1" },
    },
  });

  const result = await ensureRealtimeAuth(fake.client);

  assert.deepEqual(result, { ok: true, userId: "user-1" });
  assert.equal(fake.refreshCalls, 1);
  assert.deepEqual(fake.tokens, ["token-refrescado"]);
});

test("no abre realtime si el refresh no entrega un JWT valido", async () => {
  const fake = makeClient({
    session: null,
    refreshedSession: null,
    refreshError: { message: "Invalid Refresh Token" },
  });

  const result = await ensureRealtimeAuth(fake.client);

  assert.deepEqual(result, { ok: false, error: "Invalid Refresh Token" });
  assert.equal(fake.refreshCalls, 1);
  assert.deepEqual(fake.tokens, []);
});

