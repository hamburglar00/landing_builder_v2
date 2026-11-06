import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as usage from "../../supabase/functions/_shared/mkt-whatsapp-usage";

function fixture(metadata?: unknown) {
  const p1 = "5491100000001",
    p2 = "5491100000002",
    p3 = "5491100000003";
  const writes: { method: string; rows: any }[] = [];
  const existing = [
    {
      phone: p1,
      kind: "mkt",
      status: "inactive",
      source_available: true,
      assignment_role: "follow_up",
      pbadmin_manager_id: null,
    },
    {
      phone: p2,
      kind: "carga",
      status: "active",
      source_available: true,
      assignment_role: "follow_up",
      pbadmin_manager_id: null,
    },
  ];
  const client = {
    from(table: string) {
      let method = "select",
        rows: any;
      const q: any = {
        select: () => q,
        eq: () => q,
        not: () => q,
        maybeSingle: () => q,
        upsert: (value: any) => {
          method = "upsert";
          rows = value;
          return q;
        },
        update: (value: any) => {
          method = "update";
          rows = value;
          return q;
        },
        then(resolve: any, reject: any) {
          if (method !== "select") writes.push({ method, rows });
          const data =
            method !== "select"
              ? null
              : table === "gerencias"
                ? [
                    {
                      id: 1,
                      user_id: "fixture",
                      gerencia_id: 17,
                      source_type: "pbadmin",
                      workspace_currency: "ARS",
                    },
                  ]
                : table === "gerencia_phones"
                  ? existing
                  : null;
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        },
      };
      return q;
    },
  };
  let serve: (request: Request) => Promise<Response>;
  const code = ts.transpileModule(
    readFileSync(
      new URL("../../supabase/functions/sync-phones/index.ts", import.meta.url),
      "utf8",
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  runInNewContext(code, {
    exports: {},
    Request,
    Response,
    URL,
    Date,
    console: { error() {} },
    require: (name: string) => {
      if (name.includes("supabase-js")) return { createClient: () => client };
      if (name.includes("mkt-whatsapp-usage")) return usage;
      if (name.includes("phone-administration"))
        return {
          authorizePhoneAdministration: async () => {
            throw Error("Unexpected auth call");
          },
        };
      throw Error(name);
    },
    Deno: {
      serve: (fn: typeof serve) => {
        serve = fn;
      },
      env: {
        get: (key: string) =>
          (
            ({
              SUPABASE_URL: "https://synthetic.invalid",
              SERVICE_ROLE_KEY: "synthetic",
              CRON_SECRET: "synthetic-cron",
              ASESADMIN_BASE_URL: "https://api.synthetic.invalid",
            }) as Record<string, string>
          )[key],
      },
    },
    fetch: async (url: string) => {
      assert.equal(
        url,
        "https://api.synthetic.invalid/api/v1/agency/17/random-contact",
      );
      return Response.json({
        load: { whatsapp: [p2] },
        mkt: {
          whatsapp: [p1, p3],
          ...(metadata === undefined ? {} : { whatsapp_details: metadata }),
        },
      });
    },
  });
  return {
    writes,
    run: async () => {
      const response = await serve!(
        new Request("https://synthetic.invalid/sync", {
          method: "POST",
          body: JSON.stringify({ cron_secret: "synthetic-cron" }),
        }),
      );
      assert.equal(response.status, 200);
      return response.json();
    },
  };
}
test("actual sync preserves legacy/manual usage without writing stale classifications", async () => {
  const f = fixture();
  const response = await f.run();
  assert.equal(response.processed_gerencias, 1);
  const rows = f.writes
    .filter((w) => w.method === "upsert")
    .flatMap((w) => w.rows);
  assert.ok(rows.every((r) => !("assignment_role" in r)));
  assert.equal(
    rows.find((r) => r.phone === "5491100000001").status,
    "inactive",
  );
});
test("actual sync applies both usages, keeps manual status and counts only advertising", async () => {
  const f = fixture([
    { phone: "5491100000001", manager_id: 1, usage: "acquisition" },
    { phone: "5491100000003", manager_id: 3, usage: "follow_up" },
  ]);
  const response = await f.run();
  assert.equal(response.total_active_phones, 0);
  const rows = f.writes
    .filter((w) => w.method === "upsert")
    .flatMap((w) => w.rows);
  assert.equal(
    rows.find((r) => r.phone === "5491100000001").assignment_role,
    "acquisition",
  );
  assert.equal(
    rows.find((r) => r.phone === "5491100000001").status,
    "inactive",
  );
  assert.equal(
    rows.find((r) => r.phone === "5491100000003").pbadmin_manager_id,
    3,
  );
  assert.equal(
    rows.find((r) => r.phone === "5491100000002").assignment_role,
    undefined,
  );
});
test("actual sync does not mutate phones when metadata is incomplete", async () => {
  const f = fixture([]);
  assert.equal((await f.run()).processed_gerencias, 0);
  assert.deepEqual(f.writes, []);
});
