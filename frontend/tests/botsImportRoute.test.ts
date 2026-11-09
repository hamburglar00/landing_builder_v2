import assert from "node:assert/strict";
import test from "node:test";
import type { TestContext } from "node:test";
import { POST } from "../app/api/bots/import/route";
import type { ImportDirectory } from "../lib/bots/directory";
const user = "92000000-0000-4000-8000-000000000001",
  other = "92000000-0000-4000-8000-000000000002";
const advisor = "92000000-0000-4000-8000-000000000003";
const directory = (): ImportDirectory => ({
  scope: { kind: "owner", id: 2 },
  agencies: [
    {
      agency_id: 10,
      name: "Authoritative name",
      platform: 7,
      bots: [
        {
          manager_id: 1,
          name: "WhatsApp",
          agency_id: 10,
          owner_id: 2,
          channel: "whatsapp",
          role: "mkt",
          active: true,
          phone: "5493511234567",
          advisor_id: null,
          advisor_slug: null,
        },
        {
          manager_id: 2,
          name: "Atrio",
          agency_id: 10,
          owner_id: 2,
          channel: "atrio",
          role: "carga",
          active: true,
          phone: null,
          advisor_id: advisor,
          advisor_slug: "gera",
        },
      ],
    },
  ],
  unassigned: [],
  advisors: [{ id: advisor, name: "Gera", slug: "gera" }],
});
function fixture(t: TestContext) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://builder.fixture.invalid";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "synthetic";
  process.env.INTERNAL_CHAT_ORIGIN = "https://atrio.fixture.invalid";
  process.env.INTERNAL_CHAT_PLAYER_RESOLVE_KEY = "synthetic-server-key";
  let role = "client",
    canAtrio = true,
    source = directory(),
    upstreamError: { status: number; error: string } | null = null,
    lookupError = false,
    writeError = false;
  const storedGroups: {
    id: number;
    gerencia_id: number;
    user_id: string;
    source_type: string;
    nombre: string;
    workspace_currency: string;
    pbadmin_bots?: unknown;
    pbadmin_bots_synced_at?: string | null;
    usage_count: number;
  }[] = [];
  const storedAdvisors: {
    atrio_id: string;
    user_id: string;
    workspace_currency: string;
    pbadmin_bots?: unknown;
    pbadmin_bots_synced_at?: string | null;
  }[] = [];
  const calls: {
    url: URL;
    method: string;
    body: Record<string, unknown> | null;
  }[] = [];
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  t.mock.method(
    globalThis,
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : String(input)),
        method = init?.method ?? "GET",
        body = init?.body ? JSON.parse(String(init.body)) : null;
      calls.push({ url, method, body });
      if (url.origin === "https://atrio.fixture.invalid") {
        assert.equal(url.pathname, "/api/gateway/bot-directory");
        assert.equal(body.kind, source.scope.kind);
        assert.equal(body.id, source.scope.id);
        return upstreamError
          ? json({ error: upstreamError.error }, upstreamError.status)
          : json(source);
      }
      assert.equal(
        url.origin,
        "https://builder.fixture.invalid",
        "no business service may be contacted",
      );
      if (url.pathname === "/auth/v1/user")
        return json({
          id: user,
          aud: "authenticated",
          app_metadata: {},
          user_metadata: {},
        });
      if (url.pathname === "/rest/v1/profiles") return json({ role });
      if (url.pathname === "/rest/v1/client_module_permissions")
        return lookupError
          ? json({ message: "fixture" }, 500)
          : json({ show_atrio: canAtrio });
      const owner = url.searchParams.get("user_id")?.replace("eq.", "") ?? user;
      if (url.pathname === "/rest/v1/gerencias") {
        if (method === "GET")
          return json(
            storedGroups.filter(
              (g) =>
                g.user_id === owner &&
                g.workspace_currency === "ARS" &&
                (!url.searchParams.has("id") ||
                  g.id ===
                    Number(url.searchParams.get("id")?.replace("eq.", ""))),
            ),
          );
        if (writeError)
          return json({ message: "conflict", code: "23505" }, 409);
        if (method === "POST") {
          storedGroups.push({ ...body, usage_count: 77 });
          return json(null, 201);
        }
        if (method === "PATCH") {
          const row = storedGroups.find(
            (g) =>
              g.id === Number(url.searchParams.get("id")?.replace("eq.", "")) &&
              g.user_id === owner,
          );
          const previous = url.searchParams.get("pbadmin_bots_synced_at");
          const matches =
            !!row &&
            (!previous ||
              (row.pbadmin_bots_synced_at ?? null) ===
                (previous === "is.null" ? null : previous.slice(3)));
          if (row && matches) Object.assign(row, body);
          return json(matches ? [{ id: row!.id }] : []);
        }
      }
      if (url.pathname === "/rest/v1/atrio_clients") {
        if (method === "GET")
          return json(
            storedAdvisors.filter(
              (a) =>
                a.user_id === owner &&
                a.workspace_currency === "ARS" &&
                (!url.searchParams.has("atrio_id") ||
                  a.atrio_id ===
                    url.searchParams.get("atrio_id")?.replace("eq.", "")),
            ),
          );
        if (method === "POST") {
          storedAdvisors.push(body);
          return json(null, 201);
        }
        if (method === "PATCH") {
          const row = storedAdvisors.find(
            (a) =>
              a.atrio_id ===
                url.searchParams.get("atrio_id")?.replace("eq.", "") &&
              a.user_id === owner,
          );
          const previous = url.searchParams.get("pbadmin_bots_synced_at");
          const matches =
            !!row &&
            (!previous ||
              (row.pbadmin_bots_synced_at ?? null) ===
                (previous === "is.null" ? null : previous.slice(3)));
          if (row && matches) Object.assign(row, body);
          return json(matches ? [{ atrio_id: row!.atrio_id }] : []);
        }
      }
      throw Error(`Unexpected transport: ${method} ${url.pathname}`);
    },
  );
  const request = (
    body: object = {},
    token = true,
    origin = "https://builder.test",
  ) =>
    new Request("https://builder.test/api/bots/import", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
        ...(token ? { Authorization: "Bearer synthetic-session" } : {}),
      },
      body: JSON.stringify({
        action: "preview",
        kind: "owner",
        id: 2,
        workspaceCurrency: "ARS",
        ...body,
      }),
    });
  return {
    request,
    calls,
    storedGroups,
    storedAdvisors,
    set upstreamError(value: { status: number; error: string } | null) {
      upstreamError = value;
    },
    set role(value: string) {
      role = value;
    },
    set canAtrio(value: boolean) {
      canAtrio = value;
    },
    set source(value: ImportDirectory) {
      source = value;
    },
    set lookupError(value: boolean) {
      lookupError = value;
    },
    set writeError(value: boolean) {
      writeError = value;
    },
  };
}
test("unauthenticated, foreign origin and forged ownership requests produce no writes or inventory calls", async (t) => {
  const f = fixture(t);
  assert.equal((await POST(f.request({}, false))).status, 401);
  assert.equal(
    (await POST(f.request({}, true, "https://foreign.invalid"))).status,
    403,
  );
  assert.equal(
    (await POST(f.request({ targetUserId: other, action: "import" }))).status,
    403,
  );
  assert.equal(
    (await POST(f.request({ action: "import", user_id: other }))).status,
    400,
  );
  assert.equal(f.calls.filter((call) => call.method !== "GET").length, 0);
});
test("preview is read only and disabled Atrio modules do not disclose advisor references", async (t) => {
  const f = fixture(t);
  f.canAtrio = false;
  const response = await POST(f.request());
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.deepEqual(payload.advisors, []);
  assert.deepEqual(
    payload.agencies[0].bots.map((bot: { channel: string }) => bot.channel),
    ["whatsapp"],
  );
  assert.equal(f.storedGroups.length, 0);
  assert.equal(f.storedAdvisors.length, 0);
});
test("import re-reads source, is scoped to actor/workspace and preserves saved names/counters on retries", async (t) => {
  const f = fixture(t);
  await POST(f.request());
  const latest = directory();
  latest.agencies[0].name = "Changed since preview";
  f.source = latest;
  let response = await POST(f.request({ action: "import" }));
  assert.equal(response.status, 200);
  assert.equal(f.storedGroups[0].nombre, "Changed since preview");
  assert.equal((f.storedGroups[0].pbadmin_bots as { platform: number }[])[0].platform, 7);
  assert.equal(f.storedGroups[0].user_id, user);
  assert.equal(f.storedAdvisors[0].user_id, user);
  f.storedGroups[0].nombre = "Edited locally";
  response = await POST(f.request({ action: "import" }));
  const result = await response.json();
  assert.equal(f.storedGroups.length, 1);
  assert.equal(f.storedAdvisors.length, 1);
  assert.equal(result.existentes, 2);
  assert.equal(f.storedGroups[0].nombre, "Edited locally");
  assert.equal(f.storedGroups[0].usage_count, 77);
  const patches = f.calls.filter((call) => call.method === "PATCH");
  assert.deepEqual(Object.keys(patches[0].body!).sort(), [
    "pbadmin_bots",
    "pbadmin_bots_synced_at",
  ]);
});
test("refresh only updates registered agencies, never imports another owner workspace or new advisers", async (t) => {
  const f = fixture(t);
  f.role = "admin";
  f.storedGroups.push({
    id: 10,
    gerencia_id: 10,
    user_id: other,
    source_type: "pbadmin",
    nombre: "Client name",
    workspace_currency: "ARS",
    usage_count: 12,
  });
  const response = await POST(
    f.request({ action: "refresh", targetUserId: other }),
  );
  assert.equal(response.status, 200);
  assert.equal(f.storedGroups[0].nombre, "Client name");
  assert.equal(f.storedGroups[0].usage_count, 12);
  assert.ok(f.storedGroups[0].pbadmin_bots);
  assert.equal(f.storedAdvisors.length, 0);
});
test("permission read failure or malformed source fails without database writes; partial conflicts are reported", async (t) => {
  const f = fixture(t);
  f.lookupError = true;
  assert.equal((await POST(f.request({ action: "import" }))).status, 503);
  f.lookupError = false;
  const malformed = directory();
  malformed.agencies[0].bots[0].agency_id = 99;
  f.source = malformed;
  assert.equal((await POST(f.request({ action: "import" }))).status, 503);
  assert.equal(f.storedGroups.length, 0);
  assert.equal(f.storedAdvisors.length, 0);
  f.source = directory();
  f.writeError = true;
  const response = await POST(f.request({ action: "import" }));
  const result = await response.json();
  assert.equal(result.gerencias, 0);
  assert.equal(result.asesores, 1);
  assert.equal(result.warnings.length, 1);
});

test("unavailable directory advertises compatibility only for the exact missing-endpoint error and never writes", async (t) => {
  const f = fixture(t);
  f.source = { ...directory(), scope: { kind: "agency", id: 10 } };
  const unavailable =
    "La importación requiere publicar el nuevo directorio en API2.";
  for (const upstream of [
    { status: 503, error: unavailable, expected: "directory_unavailable" },
    { status: 401, error: unavailable, expected: undefined },
    { status: 403, error: "Acceso no permitido.", expected: undefined },
    {
      status: 503,
      error: "No se pudo consultar PBAdmin.",
      expected: undefined,
    },
  ]) {
    f.upstreamError = upstream;
    const response = await POST(f.request({ kind: "agency", id: 10 }));
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, upstream.expected);
  }
  assert.equal(f.storedGroups.length, 0);
  assert.equal(f.storedAdvisors.length, 0);
  assert.equal(
    f.calls.filter(
      (call) =>
        call.url.origin === "https://builder.fixture.invalid" &&
        call.method !== "GET",
    ).length,
    0,
  );
});
