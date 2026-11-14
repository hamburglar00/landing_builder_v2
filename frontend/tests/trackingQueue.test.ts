import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import type { TrackQueueItem } from "../lib/tracking/queue";

function loadModule<T>(file: string, dependencies: Record<string, unknown>): T {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  runInNewContext(compiled, { exports, URL, Date, process: { env: { NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co" } },
    require: (name: string) => { assert.ok(name in dependencies, name); return dependencies[name]; } });
  return exports as T;
}

type QueueModule = typeof import("../lib/tracking/queue");
type DeliveryModule = typeof import("../lib/tracking/retryDelivery");
const item: TrackQueueItem = { id: "job", event_id: "event-original", attempt_count: 2,
  post_url: "https://project.supabase.co/functions/v1/conversions?name=receiver",
  payload: { event_id: "event-original", event_time: 1800000000, event_name: "Contact", fbc: "original-fbc" },
  lease_token: "lease-current", lease_expires_at: "2099-01-01T00:00:00Z" };

function loadQueue(client: unknown) {
  return loadModule<QueueModule>("../lib/tracking/queue.ts", { "@/lib/supabase/server": { getSupabaseServerClient: () => client } });
}
function loadDelivery() {
  return loadModule<DeliveryModule>("../lib/tracking/retryDelivery.ts", { "./queue": {}, "./upstream": {} });
}

test("initial and cron claims use the same RPC; completion carries its lease", async () => {
  const calls: Array<{ name: string; input: Record<string, unknown> }> = [];
  const queue = loadQueue({ rpc: async (name: string, input: Record<string, unknown>) => {
    calls.push({ name, input }); return { data: name === "claim_tracking_queue" ? [item] : true, error: null };
  } });
  assert.equal((await queue.claimTrackEvent("job"))?.lease_token, item.lease_token);
  assert.equal((await queue.claimPendingTrackEvents(200))[0].event_id, item.event_id);
  assert.equal(await queue.markTrackEventDelivered("job", item.lease_token), true);
  assert.equal(calls[0].name, "claim_tracking_queue"); assert.equal(calls[0].input.p_id, "job");
  assert.equal(calls[1].input.p_limit, 10);
  assert.equal(calls[2].input.p_lease_token, item.lease_token);
});

test("receipt recovery never sends to upstream and retains original identity", async () => {
  let requests = 0; const finishes: string[][] = [];
  const delivery = loadDelivery();
  const result = await delivery.deliverClaimedTrackEvent(item, {
    receipt: async () => true,
    deliver: async () => { requests++; throw Error("unexpected HTTP"); },
    finish: async (id, token) => { finishes.push([id, token]); return true; },
    retry: async () => { throw Error("unexpected retry"); },
  });
  assert.equal(result, "acknowledged"); assert.equal(requests, 0);
  assert.deepEqual(finishes, [[item.id, item.lease_token]]);
});

test("uncertain receipt lookup schedules retry without risking duplicate delivery", async () => {
  let requests = 0; let reason = "";
  const result = await loadDelivery().deliverClaimedTrackEvent(item, {
    receipt: async () => null,
    deliver: async () => { requests++; throw Error("unexpected HTTP"); },
    finish: async () => { throw Error("unexpected finish"); },
    retry: async (input) => { reason = input.reason; assert.equal(input.leaseToken, item.lease_token); return true; },
  });
  assert.equal(result, "retry"); assert.equal(reason, "tracking_receipt_lookup_unavailable"); assert.equal(requests, 0);
});

test("retry sends the exact frozen payload; a stale completion is not counted delivered", async () => {
  let requests = 0;
  const result = await loadDelivery().deliverClaimedTrackEvent(item, {
    receipt: async () => false,
    deliver: async (url, payload, attempts) => {
      requests++; assert.equal(url, item.post_url); assert.equal(payload, item.payload); assert.equal(attempts, 2);
      return { ok: true, attempts: 1, upstreamStatus: 200, details: "accepted" };
    },
    finish: async () => false,
    retry: async () => { throw Error("unexpected retry"); },
  });
  assert.equal(result, "lease_lost"); assert.equal(requests, 1);
});

test("receipt lookup is scoped to exact receiver, action and original event", async () => {
  const filters: Array<[string, ...unknown[]]> = [];
  const queue = loadQueue({ from: (table: string) => {
    filters.push(["table", table]);
    const builder = {
      select(value: string) { filters.push(["select", value]); return this; },
      eq(key: string, value: unknown) { filters.push(["eq", key, value]); return this; },
      in(key: string, values: string[]) { filters.push(["in", key, ...values]); return this; },
      gte(key: string, value: number) { filters.push(["gte", key, value]); return this; },
      lt(key: string, value: number) { filters.push(["lt", key, value]); return this; },
      maybeSingle: async () => ({ data: { id: "owner-123" }, error: null }),
      limit: async () => ({ data: [{ id: "ack" }], error: null }),
    }; return builder;
  } });
  assert.equal(await queue.hasTrackingIngestReceipt(item), true);
  for (const filter of [["eq", "nombre", "receiver"], ["eq", "user_id", "owner-123"],
    ["eq", "action", "CONTACT"], ["eq", "action_event_id", "event-original"], ["gte", "http_status", 200], ["lt", "http_status", 300]]) {
    assert.ok(filters.some((entry) => JSON.stringify(entry) === JSON.stringify(filter)));
  }
  filters.length = 0;
  assert.equal(await queue.hasTrackingIngestReceipt({ ...item, post_url: "https://other.supabase.co/functions/v1/conversions?name=receiver" }), false);
  assert.equal(filters.length, 0);
});

test("claim or finish database errors surface instead of reporting successful recovery", async () => {
  const queue = loadQueue({ rpc: async () => ({ data: null, error: { message: "offline" } }) });
  await assert.rejects(queue.claimPendingTrackEvents(), /tracking_queue_claim_unavailable/);
  await assert.rejects(queue.markTrackEventDelivered(item.id, item.lease_token), /tracking_queue_finish_unavailable/);
});
