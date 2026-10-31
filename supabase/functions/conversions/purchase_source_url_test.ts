import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolvePurchaseEventSourceUrl, sourceUrlFromPayload } from "./purchase_source_url.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const owner = "11111111-1111-4111-8111-111111111111";
const otherOwner = "22222222-2222-4222-8222-222222222222";
const sourceId = "33333333-3333-4333-8333-333333333333";
const secondSourceId = "44444444-4444-4444-8444-444444444444";
const row = { id: "55555555-5555-4555-8555-555555555555", user_id: owner, landing_name: "diana" };

function database(options: { base?: string; linked?: Record<string, unknown>[] } = {}) {
  const reads: Array<{ table: string; columns?: string; filters: Record<string, unknown> }> = [];
  const db = { from(table: string) {
    assert(["settings", "conversions"].includes(table), "No unrelated table reads");
    const read = { table, columns: "", filters: {} as Record<string, unknown> };
    reads.push(read);
    const result = () => ({ data: table === "settings" ? { url_base: options.base ?? "https://landing.test/" } : options.linked ?? [], error: null });
    const chain = {
      select(columns: string) { read.columns = columns; return chain; },
      eq(key: string, value: unknown) { read.filters[key] = value; return chain; },
      in(key: string, values: unknown[]) { read.filters[key] = values; return chain; },
      maybeSingle() { return Promise.resolve(result()); },
      then(resolve: (value: ReturnType<typeof result>) => unknown) { return Promise.resolve(result()).then(resolve); },
    };
    return chain;
  } } as unknown as SupabaseClient;
  return { db, reads };
}

Deno.test("explicit valid website URL wins including an explicitly supplied root", async () => {
  for (const explicitUrl of ["https://landing.test/", "https://other.test/l/diana?landing=chosen#entry", "http://legacy.test/gast"]) {
    const { db, reads } = database();
    const result = await resolvePurchaseEventSourceUrl(db, { userId: owner, explicitUrl, matchedRow: { ...row, event_source_url: "https://landing.test/previous" } });
    assert(result === explicitUrl, "Keep explicit URL precedence and captured spelling");
    assert(reads.length === 0, "Explicit URL needs no lookup");
  }
});

Deno.test("invalid explicit URLs fall through to the authorized journey", async () => {
  for (const explicitUrl of ["javascript:alert(1)", "data:text/html,test", "/diana", "https://user:secret@landing.test/diana", "https://landing.test/a b", "https://landing.test/\ninjected"]) {
    const { db, reads } = database();
    const result = await resolvePurchaseEventSourceUrl(db, { userId: owner, explicitUrl, matchedRow: { ...row, event_source_url: "https://landing.test/gast" } });
    assert(result === "https://landing.test/gast" && reads.length === 0, "Invalid URL cannot displace captured journey");
  }
});

Deno.test("captured /gast remains exact when the resolved landing is diana", async () => {
  const { db, reads } = database();
  const result = await resolvePurchaseEventSourceUrl(db, { userId: owner, matchedRow: { ...row, event_source_url: "https://landing.test/gast" }, landingName: "diana" });
  assert(result === "https://landing.test/gast", "Do not invent the lost override query or substitute a slug");
  assert(reads.length === 0, "Do not query settings for an intact journey");
});

Deno.test("original CONTACT repairs an inherited root and preserves Builder /l/", async () => {
  const { db, reads } = database();
  const result = await resolvePurchaseEventSourceUrl(db, { userId: owner, matchedRow: { ...row, event_source_url: "https://landing.test/", contact_payload_raw: JSON.stringify({ event_source_url: "https://builder.test/l/diana" }) } });
  assert(result === "https://builder.test/l/diana" && reads.length === 0, "CONTACT has the real motor's URL");
});

Deno.test("current matched URL precedes a different old CONTACT URL", async () => {
  const { db } = database();
  const result = await resolvePurchaseEventSourceUrl(db, { userId: owner, matchedRow: { ...row, event_source_url: "https://builder.test/l/current", contact_payload_raw: JSON.stringify({ event_source_url: "https://landing.test/old" }) } });
  assert(result === "https://builder.test/l/current", "Do not rewrite an intact selected URL");
});

Deno.test("malformed or truncated CONTACT JSON uses only the trusted configured fallback", async () => {
  for (const raw of ['{"event_source_url":"https://foreign.test/stolen",', '[]', 'null', '"https://foreign.test/stolen"']) {
    const { db, reads } = database({ base: "https://builder.test/l/" });
    const result = await resolvePurchaseEventSourceUrl(db, { userId: owner, matchedRow: { ...row, event_source_url: "https://landing.test/", contact_payload_raw: raw } });
    assert(result === "https://builder.test/l/diana", "No regex recovery from broken JSON");
    assert(reads.length === 1 && reads[0].table === "settings", "Fallback uses one settings read");
  }
});

Deno.test("a resolved server landing can construct the classic route", async () => {
  const { db } = database({ base: "https://landing.test/" });
  assert(await resolvePurchaseEventSourceUrl(db, { userId: owner, landingName: "diana" }) === "https://landing.test/diana", "Use the configured motor prefix");
});

Deno.test("fallback accepts legacy names supported by the public landing validator", async () => {
  const { db } = database();
  assert(await resolvePurchaseEventSourceUrl(db, { userId: owner, landingName: "Diana.legacy_2-test" }) === "https://landing.test/Diana.legacy_2-test", "Public names with dots remain valid route segments");
});

Deno.test("no known name or an unsafe path never fabricates a root or route", async () => {
  for (const name of ["", ".", "..", "../other", "/diana", "diana?landing=other", "diana#other", "a".repeat(201)]) {
    const { db, reads } = database();
    assert(await resolvePurchaseEventSourceUrl(db, { userId: owner, landingName: name }) === "", "Reject absent or non-segment names");
    assert(reads.length === 0, "No base query can make an unknown name trustworthy");
  }
});

Deno.test("invalid configured base cannot fabricate an event source", async () => {
  for (const base of ["", "javascript:alert(1)", "https://user:secret@landing.test/", "https://landing.test/?landing=other", "https://landing.test/#other"]) {
    const { db } = database({ base });
    assert(await resolvePurchaseEventSourceUrl(db, { userId: owner, matchedRow: row }) === "", "Reject unsafe configured bases");
  }
});

Deno.test("foreign matched rows contribute neither URL, raw CONTACT, name nor lineage lookups", async () => {
  const { db, reads } = database();
  const result = await resolvePurchaseEventSourceUrl(db, { userId: owner, matchedRow: { ...row, user_id: otherOwner, event_source_url: "https://foreign.test/private", contact_payload_raw: '{"event_source_url":"https://foreign.test/contact"}', purchase_attribution_conversion_id: sourceId } });
  assert(result === "" && reads.length === 0, "A foreign row cannot become URL authority");
});

Deno.test("one hop uses at most two unique existing IDs and also filters tenant", async () => {
  const { db, reads } = database({ linked: [
    { id: sourceId, user_id: otherOwner, event_source_url: "https://foreign.test/wrong" },
    { id: secondSourceId, user_id: owner, event_source_url: "https://landing.test/", contact_payload_raw: '{"event_source_url":"https://landing.test/gast"}' },
  ] });
  const result = await resolvePurchaseEventSourceUrl(db, { userId: owner, matchedRow: { ...row, event_source_url: "https://landing.test/", purchase_attribution_conversion_id: sourceId, pixel_attribution_conversion_id: secondSourceId } });
  assert(result === "https://landing.test/gast", "Only an authorized linked CONTACT contributes");
  assert(reads.length === 1 && reads[0].filters.user_id === owner, "One tenant-filtered lookup, no recursion/settings");
  assert(JSON.stringify(reads[0].filters.id) === JSON.stringify([sourceId, secondSourceId]), "Only the two existing IDs are queried");
});

Deno.test("duplicate IDs are read once, and missing lineage falls back without recursion", async () => {
  const { db, reads } = database();
  const result = await resolvePurchaseEventSourceUrl(db, { userId: owner, matchedRow: { ...row, purchase_attribution_conversion_id: sourceId, pixel_attribution_conversion_id: sourceId } });
  assert(result === "https://landing.test/diana", "Missing lineage permits the configured name fallback");
  assert(reads.length === 2 && JSON.stringify(reads[0].filters.id) === JSON.stringify([sourceId]), "One lineage read and one settings read only");
});

Deno.test("a retry preserves the resolved URL and original explicit root without mutation", async () => {
  const { db, reads } = database();
  const original = { ...row, event_source_url: "https://landing.test/", contact_payload_raw: '{"event_source_url":"https://landing.test/gast"}' };
  const first = await resolvePurchaseEventSourceUrl(db, { userId: owner, matchedRow: original });
  const replay = await resolvePurchaseEventSourceUrl(db, { userId: owner, matchedRow: { ...original, event_source_url: first } });
  assert(first === replay && replay === "https://landing.test/gast", "Replay keeps the URL of the same journey");
  assert(original.event_source_url === "https://landing.test/" && reads.length === 0, "Resolver does not mutate persisted source rows");
  assert(await resolvePurchaseEventSourceUrl(db, { userId: owner, explicitUrl: sourceUrlFromPayload('{"event_source_url":"https://landing.test/"}'), matchedRow: original }) === "https://landing.test/", "An explicitly saved root remains explicit on retry");
});

Deno.test("WhatsApp Cloud API routing markers survive unchanged", async () => {
  for (const explicit of [true, false]) {
    const { db, reads } = database();
    const marker = "whatsapp-cloud-api://123456789";
    const result = await resolvePurchaseEventSourceUrl(db, { userId: owner, explicitUrl: explicit ? marker : undefined, matchedRow: { ...row, event_source_url: marker } });
    assert(result === marker && reads.length === 0, "Do not replace the selected WABA source with a website");
  }
});
