import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// PostgreSQL WASM only. Never loads application credentials or connects to production.
const modulePath = process.env.PURCHASE_INGEST_PGLITE;
if (!modulePath) throw new Error('Set PURCHASE_INGEST_PGLITE to the local @electric-sql/pglite/dist/index.js');
const { PGlite } = await import(pathToFileURL(modulePath).href);
const migration = new URL('../migrations/20261101152327_purchase_ingest_recovery_index.sql', import.meta.url);
const owner = '10000000-0000-4000-8000-000000000001';
const foreign = '10000000-0000-4000-8000-000000000002';

test('Purchase recovery index preserves records and provides a selective lookup', async t => {
  const db = new PGlite(); t.after(() => db.close());
  const rows = async (sql, args = []) => (await db.query(sql, args)).rows;
  await db.exec(`create table public.conversions(
    id uuid primary key,user_id uuid not null,purchase_event_id text,estado text,
    purchase_event_time bigint,valor numeric,purchase_payload_raw text);
    create index fixture_user_lookup on public.conversions(user_id);
    insert into public.conversions
    select md5(i::text)::uuid,'${owner}'::uuid,'event-'||i,
      case when i%5=0 then 'contact' else 'purchase' end,1792609153,1000,'original payload '||i
    from generate_series(1,20000) i;
    insert into public.conversions values
      ('20000000-0000-4000-8000-000000000001','${owner}','recovery-event','purchase',1792609153,1000,'original receipt'),
      ('20000000-0000-4000-8000-000000000002','${foreign}','recovery-event','purchase',1792609153,2000,'foreign receipt'),
      ('20000000-0000-4000-8000-000000000003','${owner}','contact-only','contact',null,0,'contact receipt');
    analyze public.conversions;`);
  const snapshot = async () => (await rows("select count(*)::int as count,md5(string_agg(row_to_json(c)::text,'' order by id)) as checksum from public.conversions c"))[0];
  const before = await snapshot();
  await db.exec(await readFile(migration, 'utf8'));
  await db.exec('analyze public.conversions');

  await t.test('migration changes no event IDs, occurrence times, amounts or payloads', async () => {
    assert.deepEqual(await snapshot(), before);
    assert.equal(before.count, 20003);
  });
  await t.test('index is valid, non-unique and covers id with the Purchase-only predicate', async () => {
    const [index] = await rows(`select indisvalid,indisready,indisunique,indnkeyatts,indnatts,
      pg_get_indexdef(indexrelid,1,true) as key1,pg_get_indexdef(indexrelid,2,true) as key2,
      pg_get_indexdef(indexrelid,3,true) as included,pg_get_expr(indpred,indrelid) as predicate
      from pg_index where indexrelid='public.conversions_purchase_ingest_recovery_idx'::regclass`);
    assert.deepEqual(index, { indisvalid:true, indisready:true, indisunique:false, indnkeyatts:2, indnatts:3,
      key1:'user_id',key2:'purchase_event_id',included:'id',predicate:"(estado = 'purchase'::text)" });
  });
  await t.test('real planner uses the covering index without forced planner settings', async () => {
    const [result] = await rows("explain (format json,analyze) select id from public.conversions where user_id=$1 and purchase_event_id=$2 and estado='purchase' limit 1", [owner,'recovery-event']);
    const plan = result['QUERY PLAN'][0].Plan;
    const nodes = node => [node,...(node.Plans ?? []).flatMap(nodes)];
    const scan = nodes(plan).find(node => node['Index Name'] === 'conversions_purchase_ingest_recovery_idx');
    assert.ok(scan, 'Planner selected the exact receiver+event index');
    assert.equal(scan['Node Type'], 'Index Only Scan');
    assert.match(scan['Index Cond'], /user_id/); assert.match(scan['Index Cond'], /purchase_event_id/);
    assert.equal(scan['Actual Rows'], 1);
  });
  await t.test('lookup remains scoped to receiver and Purchase state, with no added uniqueness policy', async () => {
    const select = "select id from public.conversions where user_id=$1 and purchase_event_id=$2 and estado='purchase'";
    assert.deepEqual(await rows(select,[owner,'recovery-event']),[{ id:'20000000-0000-4000-8000-000000000001' }]);
    assert.deepEqual(await rows(select,[foreign,'recovery-event']),[{ id:'20000000-0000-4000-8000-000000000002' }]);
    assert.deepEqual(await rows(select,[owner,'contact-only']),[]);
    await rows("insert into public.conversions(id,user_id,purchase_event_id,estado) values('20000000-0000-4000-8000-000000000004',$1,'recovery-event','purchase')",[owner]);
    assert.equal((await rows(select,[owner,'recovery-event'])).length,2,'Index does not invent a new uniqueness constraint');
  });
});
