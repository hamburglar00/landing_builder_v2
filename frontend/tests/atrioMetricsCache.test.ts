import assert from "node:assert/strict";
import test from "node:test";
import { advisorMetricsKey, AtrioMetricsCache } from "../lib/bots/atrioMetricsCache";
import type { AdvisorDirectory } from "../lib/atrio/managerDestinations";

const client = (id: string, owner = "owner") => ({ id, user_id: owner, atrio_id: `advisor-${id}` });
const advisor = (id: string, count = 1): AdvisorDirectory => ({ id: `advisor-${id}`, name: id, slug: id, connections: [{ manager_id: count } as AdvisorDirectory["connections"][number]] });

test("navigation reuses real metrics and requests only previously unseen advisors", async () => {
  const calls: string[][] = [];
  const cache = new AtrioMetricsCache(async ids => { calls.push(ids); return { advisors: ids.map(id => advisor(id)), directoryChanged: true }; });
  const first = await cache.read([client("one")]);
  assert.equal(first.directoryChanged, true);
  assert.equal((await cache.read([client("one")])).directoryChanged, false);
  const next = await cache.read([client("one"), client("two")]);
  assert.deepEqual(calls, [["one"], ["two"]]);
  assert.equal(next.advisors.size, 2);
  assert.equal(next.advisors.get(advisorMetricsKey(client("one")))?.connections[0].manager_id, 1);
});

test("overlapping navigation shares pending requests instead of restarting them", async () => {
  let finish!: (value: { advisors: AdvisorDirectory[] }) => void;
  let calls = 0;
  const cache = new AtrioMetricsCache(() => { calls++; return new Promise(resolve => { finish = resolve; }); });
  const a = cache.read([client("one")]);
  const b = cache.read([client("one")]);
  await Promise.resolve();
  assert.equal(calls, 1);
  finish({ advisors: [advisor("one", 12)] });
  const result = await Promise.all([a, b]);
  assert.equal(result[0].advisors.get(advisorMetricsKey(client("one")))?.connections[0].manager_id, 12);
  assert.deepEqual(result[0].advisors, result[1].advisors);
});

test("scope change or explicit refresh aborts requests and rejects late responses", async () => {
  const pending: Array<{ signal: AbortSignal; finish: (value: { advisors: AdvisorDirectory[] }) => void }> = [];
  const cache = new AtrioMetricsCache((_ids, signal) => new Promise(resolve => pending.push({ signal, finish: resolve })));
  const old = cache.read([client("one")]);
  const rejected = assert.rejects(old, { name: "AbortError" });
  await Promise.resolve();
  cache.clear();
  assert.equal(pending[0].signal.aborted, true);
  const next = cache.read([client("one")]);
  await Promise.resolve();
  pending[0].finish({ advisors: [advisor("one", 90)] });
  await rejected;
  assert.equal(cache.snapshot([client("one")]).size, 0);
  pending[1].finish({ advisors: [advisor("one", 2)] });
  await next;
  assert.equal(cache.snapshot([client("one")]).get(advisorMetricsKey(client("one")))?.connections[0].manager_id, 2);
});

test("metrics expire and refresh actions invalidate otherwise fresh results", async () => {
  let now = 0, calls = 0;
  const cache = new AtrioMetricsCache(async ids => ({ advisors: ids.map(id => advisor(id, ++calls)) }), () => now, 100);
  await cache.read([client("one")]);
  now = 99;
  await cache.read([client("one")]);
  assert.equal(calls, 1);
  now = 100;
  await cache.read([client("one")]);
  assert.equal(calls, 2);
  cache.clear();
  await cache.read([client("one")]);
  assert.equal(calls, 3);
});

test("owners never share cached records even when they reference the same advisor", async () => {
  let calls = 0;
  const cache = new AtrioMetricsCache(async () => ({ advisors: [advisor("same", ++calls)] }));
  await cache.read([client("same", "a")]);
  await cache.read([client("same", "b")]);
  assert.equal(calls, 2);
  assert.equal(cache.snapshot([client("same", "a")]).get(advisorMetricsKey(client("same", "a")))?.connections[0].manager_id, 1);
  assert.equal(cache.snapshot([client("same", "b")]).get(advisorMetricsKey(client("same", "b")))?.connections[0].manager_id, 2);
  await assert.rejects(cache.read([client("one", "a"), client("two", "b")]));
});

test("an advisor absent from a successful response is cached as absent", async () => {
  let calls = 0;
  const cache = new AtrioMetricsCache(async () => { calls++; return { advisors: [] }; });
  await cache.read([client("one")]);
  const cached = await cache.read([client("one")]);
  assert.equal(calls, 1);
  assert.equal(cached.advisors.get(advisorMetricsKey(client("one"))), null);
});

test("errors clear pending jobs and a retry can succeed", async () => {
  let calls = 0;
  const cache = new AtrioMetricsCache(ids => {
    calls++;
    if (calls === 1) throw Error("offline");
    return Promise.resolve({ advisors: ids.map(id => advisor(id)) });
  });
  await assert.rejects(cache.read([client("one")]), /offline/);
  await cache.read([client("one")]);
  assert.equal(calls, 2);
  await assert.rejects(cache.read(Array.from({ length: 101 }, (_, i) => client(String(i)))));
  assert.equal(calls, 2);
});
