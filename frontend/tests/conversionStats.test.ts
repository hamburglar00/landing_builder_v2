import assert from "node:assert/strict";
import test from "node:test";
import type { ConversionRow } from "../lib/conversionsDb";

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";

function purchaseRow(
  id: string,
  phone: string,
  purchaseType: "first" | "repeat",
  externalId: string,
  extra: Partial<ConversionRow> = {},
): ConversionRow {
  return {
    id,
    user_id: "client-1",
    phone,
    external_id: externalId,
    purchase_event_id: `purchase-${id}`,
    purchase_type: purchaseType,
    created_at: "2026-07-31T12:00:00.000Z",
    valor: 100,
    ...extra,
  } as ConversionRow;
}

test("separa jugadores que recargaron, recargas totales y cohorte del período", async () => {
  const { computeCoreStats } = await import("../lib/conversionStats");
  const conversions = [
    purchaseRow("first-a", "5491111111111", "first", "player-a", {
      contact_event_id: "contact-a",
      lead_event_id: "lead-a",
    }),
    purchaseRow("repeat-b-1", "5492222222222", "repeat", "player-b"),
    purchaseRow("repeat-b-2", "5492222222222", "repeat", "player-b"),
    purchaseRow("repeat-c-1", "5493333333333", "repeat", "player-c"),
  ];

  const stats = computeCoreStats(conversions, [], conversions, 200_000);

  assert.equal(stats.firstLoadPurchasersAttributed, 1);
  assert.equal(stats.purchaseRepeat, 2);
  assert.equal(stats.totalPurchases, 4);
  assert.equal(stats.repeatFromAttributedFirstInRange, 0);
});
