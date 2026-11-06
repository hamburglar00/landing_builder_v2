import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseMktWhatsappUsage,
  resolvePhoneUsage,
} from "../../supabase/functions/_shared/mkt-whatsapp-usage";
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
