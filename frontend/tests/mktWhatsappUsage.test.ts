import { authorizeMktUsageExport } from "../lib/pbadmin/mkt-usage-auth.server";
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseMktWhatsappUsage,
  resolvePhoneUsage,
} from "../../supabase/functions/_shared/mkt-whatsapp-usage";
import { exportMktUsage } from "../lib/pbadmin/mkt-usage-export.server";
const phone = "5491100000001",
  normalize = (s: string) => s.replace(/\D/g, "");
test("legacy API preserves sales and manual types; new metadata is authoritative only for MKT", () => {
  const existing = { assignmentRole: "follow_up" as const, managerId: null };
  assert.equal(parseMktWhatsappUsage(undefined, [phone], normalize).size, 0);
  assert.deepEqual(resolvePhoneUsage("mkt", undefined, existing), {
    assignment_role: "follow_up",
    pbadmin_manager_id: null,
  });
  assert.deepEqual(resolvePhoneUsage("mkt", undefined), {
    assignment_role: "acquisition",
    pbadmin_manager_id: null,
  });
  const metadata = parseMktWhatsappUsage(
    [{ phone, manager_id: 12, usage: "acquisition" }],
    [phone],
    normalize,
  ).get(phone);
  assert.deepEqual(resolvePhoneUsage("mkt", metadata, existing), {
    assignment_role: "acquisition",
    pbadmin_manager_id: 12,
  });
  assert.deepEqual(resolvePhoneUsage("carga", metadata, existing), {
    assignment_role: "follow_up",
    pbadmin_manager_id: null,
  });
  assert.equal(
    resolvePhoneUsage("mkt", undefined, { ...existing, managerId: 12 })
      .pbadmin_manager_id,
    12,
  );
});
test("malformed, conflicting, unpublished and partial snapshots fail before sync", () => {
  for (const raw of [
    null,
    {},
    [],
    [{ phone, manager_id: 0, usage: "follow_up" }],
    [{ phone, manager_id: 1, usage: "sales" }],
    [{ phone: phone + "2", manager_id: 1, usage: "follow_up" }],
    [
      { phone, manager_id: 1, usage: "follow_up" },
      { phone, manager_id: 2, usage: "acquisition" },
    ],
  ])
    assert.throws(() => parseMktWhatsappUsage(raw, [phone], normalize));
});
test("export paginates past 1000 rows, filters source and kind, and never returns raw phone numbers", async () => {
  const rows = Array.from({ length: 1003 }, (_, i) => ({
    id: i + 1,
    phone: "5491100" + String(i).padStart(6, "0"),
    assignment_role: i % 2 ? "acquisition" : "follow_up",
    gerencias: { gerencia_id: 17 },
  }));
  let calls = 0;
  const db = {
    from: (table: string) => {
      assert.equal(table, "gerencia_phones");
      let last = 0;
      const query = {
        select: () => query,
        eq: (key: string, value: string) => {
          assert.ok(
            (key === "kind" && value === "mkt") ||
              (key === "gerencias.source_type" && value === "pbadmin"),
          );
          return query;
        },
        gt: (_key: string, value: number) => {
          last = value;
          return query;
        },
        order: () => query,
        limit: async (n: number) => {
          calls++;
          return {
            data: rows.filter((r) => r.id > last).slice(0, n),
            error: null,
          };
        },
      };
      return query;
    },
  };
  const result = await exportMktUsage(db as never);
  assert.equal(result.count, 1003);
  assert.equal(calls, 4);
  assert.ok(result.entries.every((e) => /^[a-f0-9]{64}$/.test(e.phoneHash)));
  assert.ok(!JSON.stringify(result).includes(rows[0].phone));
});

test("export authorization is independent of SSO and rejects absent or incorrect keys", () => {
  const old = process.env.PBADMIN_MKT_USAGE_EXPORT_SECRET;
  try {
    delete process.env.PBADMIN_MKT_USAGE_EXPORT_SECRET;
    assert.throws(
      () => authorizeMktUsageExport(new Request("https://example.invalid")),
      (error: any) => error.status === 503,
    );
    process.env.PBADMIN_MKT_USAGE_EXPORT_SECRET =
      "synthetic-export-key-32-characters-or-more";
    assert.throws(
      () => authorizeMktUsageExport(new Request("https://example.invalid")),
      (error: any) => error.status === 401,
    );
    assert.throws(
      () =>
        authorizeMktUsageExport(
          new Request("https://example.invalid", {
            headers: { "x-extension-secret": "wrong" },
          }),
        ),
      (error: any) => error.status === 401,
    );
    assert.doesNotThrow(() =>
      authorizeMktUsageExport(
        new Request("https://example.invalid", {
          headers: {
            "x-extension-secret": process.env.PBADMIN_MKT_USAGE_EXPORT_SECRET!,
          },
        }),
      ),
    );
  } finally {
    if (old === undefined) delete process.env.PBADMIN_MKT_USAGE_EXPORT_SECRET;
    else process.env.PBADMIN_MKT_USAGE_EXPORT_SECRET = old;
  }
});
