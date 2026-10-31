import { originalEventTimeSeconds, withOriginalEventTime } from "./event_time.ts";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

const received = 1_793_471_725;
const historical = 1_792_609_153;

for (const [name, seconds, iso] of [
  ["126018 repeat", historical, "2026-10-21T18:59:13.000Z"],
  ["118947 first", 1_792_609_028, "2026-10-21T18:57:08.000Z"],
] as const) {
  Deno.test(`historical PURCHASE ${name} keeps original confirmation despite receipt ten days later`, () => {
    const input = { action: "PURCHASE", confirmed_at: iso, timestamp: seconds * 1000, dateTime: iso, action_event_id: "stable-action", transaction_id: "stable-payment" };
    const normalized = withOriginalEventTime(input, received, "PURCHASE") as typeof input & { event_time: number };
    assert(normalized.event_time === seconds, "Historical occurrence must not become the receipt timestamp");
    assert(normalized.action_event_id === input.action_event_id && normalized.transaction_id === input.transaction_id, "Deduplication keys must not change");
    assert(normalized.confirmed_at === iso && normalized.timestamp === input.timestamp, "Keep original source fields");
    assert(!Object.hasOwn(input, "event_time"), "Input payload is not mutated");
    assert(withOriginalEventTime(normalized, received + 86400, "PURCHASE").event_time === seconds, "Replay must keep the original time");
  });
}

Deno.test("explicit valid event_time remains authoritative and normalizes units and ISO", () => {
  for (const event_time of [historical, String(historical), historical * 1000, String(historical * 1000), "2026-10-21T15:59:13-03:00"]) {
    const result = withOriginalEventTime({ event_time, confirmed_at: "2026-10-22T18:59:13Z" }, received, "PURCHASE");
    assert(result.event_time === historical, "An explicit valid event_time must win");
  }
});

Deno.test("PURCHASE confirmation precedes generic timestamps but action-specific event time stays explicit", () => {
  const common = { confirmed_at: "2026-10-21T18:59:13Z", timestamp: received * 1000, dateTime: "2026-10-31T18:35:25Z" };
  assert(withOriginalEventTime(common, received, "PURCHASE").event_time === historical, "confirmed_at must precede timestamp/dateTime");
  const specific = withOriginalEventTime({ ...common, purchase_event_time: (historical - 60) * 1000 }, received, "PURCHASE");
  assert(specific.event_time === historical - 60 && specific.purchase_event_time === historical - 60, "Existing action-specific event time must remain coherent in seconds");
});

for (const [action, field] of [["CONTACT", "contact_event_time"], ["LEAD", "lead_event_time"], ["COMPLETEREGISTRATION", "registration_event_time"], ["PURCHASE", "purchase_event_time"]]) {
  Deno.test(`${action} explicit event_time and conflicting action alias reach handlers as the same instant`, () => {
    for (const [event_time, alias] of [[historical, received], [received, historical]]) {
      const input = { event_time, [field]: alias, confirmed_at: "2026-10-21T18:59:13Z", timestamp: historical * 1000 };
      const result = withOriginalEventTime(input, received, action);
      assert(result.event_time === event_time && result[field] === event_time, "An explicit valid event_time must also win in alias-first handlers");
      assert(input[field] === alias && result.timestamp === input.timestamp, "Input and original source timestamps stay unchanged");
      const replay = withOriginalEventTime(result, received + 86400, action);
      assert(replay[field] === event_time && replay.event_time === event_time, "Conflicting input has a stable replay");
    }
  });
  Deno.test(`${action} keeps its own original date and ignores unrelated action aliases`, () => {
    const input = { [field]: "2026-10-21T18:59:13Z", timestamp: received * 1000, unrelated_event_time: 1 };
    const result = withOriginalEventTime(input, received, action);
    assert(result.event_time === historical && result[field] === historical, "Action alias must normalize to seconds");
    assert(result.unrelated_event_time === 1, "Unrelated fields must survive unchanged");
  });
}

Deno.test("invalid aliases fall through original dates instead of hiding them in handlers", () => {
  const result = withOriginalEventTime({ purchase_event_time: "not-a-date", event_time: "invalid", confirmed_at: "invalid", timestamp: historical * 1000 }, received, "PURCHASE");
  assert(result.event_time === historical, "Use the remaining valid original timestamp");
  assert(!Object.hasOwn(result, "purchase_event_time"), "Invalid truthy alias must not override canonical time");
  assert(withOriginalEventTime({ timestamp: 0, dateTime: "2026-10-21T18:59:13Z" }, received, "LEAD").event_time === historical, "ISO fallback remains available to other channels");
});

Deno.test("receipt is used only when every original timestamp is absent or invalid", () => {
  for (const invalid of [undefined, null, "", "invalid", -1, 0, Infinity, NaN, {}, true, "2026-02-30T18:59:13Z"]) {
    const result = withOriginalEventTime({ event_time: invalid, confirmed_at: invalid, timestamp: invalid, dateTime: invalid }, received, "PURCHASE");
    assert(result.event_time === received, "Only a missing/invalid original permits receipt fallback");
  }
});

Deno.test("date normalization is deterministic, does not refresh old dates, and rejects ambiguous non-ISO strings", () => {
  assert(originalEventTimeSeconds("2026-10-21 18:59:13") === historical, "Legacy zone-less server timestamps are UTC");
  assert(originalEventTimeSeconds("2026-10-21T15:59:13-03:00") === historical, "Timezone offset preserves instant");
  assert(originalEventTimeSeconds("2024-02-29T00:00:00Z") !== null, "Valid leap day accepted");
  assert(originalEventTimeSeconds("2025-02-29T00:00:00Z") === null, "Invalid leap day rejected");
  assert(originalEventTimeSeconds("10/21/2026") === null, "Locale-dependent dates cannot invent occurrence time");
  assert(originalEventTimeSeconds("2020-01-01T00:00:00Z") === 1_577_836_800, "Old time remains old for existing CAPI policy");
});
