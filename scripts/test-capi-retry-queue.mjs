// In-memory PostgreSQL + actual retry HTTP handler with synthetic DB/transport.
// Never reads .env, accepts a database URL, or sends requests to Meta/production.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runInNewContext } from "node:vm";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(join(root, "frontend/package.json"));
const ts = require("typescript");
const { PGlite } = await import(process.env.PGLITE_MODULE
  ? pathToFileURL(process.env.PGLITE_MODULE).href : "@electric-sql/pglite");
const read = file => readFileSync(join(root, file), "utf8");
const migration = read("supabase/migrations/20261110145852_optimize_contact_capi_retry_queue.sql");
const concurrent = read("supabase/operations/contact-capi-retry-index.concurrent.sql");
const rollback = read("supabase/operations/contact-capi-retry-index.rollback.sql");
const indexName = "conversions_contact_capi_retryable_created_idx";
const predicate = "contact_capi_retryable = true and (contact_status_capi = 'error' or lead_status_capi = 'error' or registration_status_capi = 'error') and contact_capi_retry_count < 6";
const selection = `select id from public.conversions where ${predicate} order by created_at asc`;
const results = [];
const test = async (name, fn) => { await fn(); results.push(name); console.log("PASS " + name); };
const db = new PGlite();
let planBefore, planAfter;
const rows = async sql => (await db.query(sql)).rows;
const ids = async sql => (await rows(sql)).map(row => row.id);
const plan = async () => (await rows("explain (format json) " + selection + " limit 100"))[0]["QUERY PLAN"][0].Plan;
const nodes = node => [node, ...(node.Plans ?? []).flatMap(nodes)];
const quote = value => value === null ? "null" : typeof value === "string"
  ? "'" + value.replaceAll("'", "''") + "'" : String(value);
try {
  await db.exec(`
    create table public.conversions (
      id integer primary key, created_at timestamptz not null,
      contact_capi_retryable boolean, contact_status_capi text,
      lead_status_capi text, registration_status_capi text,
      contact_capi_retry_count integer, padding text default ''
    );
    create index idx_conversions_created_at on conversions(created_at desc);
    create index idx_conversions_contact_capi_retry on conversions(created_at)
      where contact_capi_retryable = true and contact_status_capi = 'error';
  `);
  await test("empty bootstrap creates the additional index and replay is idempotent", async () => {
    await db.exec(migration);
    await db.exec(migration);
    const index = (await rows(`select indisvalid,indisready,indislive from pg_index where indexrelid='${indexName}'::regclass`))[0];
    assert.deepEqual(index, { indisvalid: true, indisready: true, indislive: true });
  });
  await db.exec(rollback);
  await db.exec(`insert into conversions
    select -g, '2010-01-01'::timestamptz + g * interval '1 second', false, 'enviado', 'enviado', 'enviado', 0, repeat('x',512)
    from generate_series(1,25000) g`);
  const fixtures = [];
  for (const contact of [null, "", "error", "enviado", "skipped_disabled"])
    for (const lead of [null, "", "error", "enviado", "skipped_disabled"])
      for (const registration of [null, "", "error", "enviado", "skipped_disabled"])
        for (const retryable of [null, false, true])
          for (const count of [null, 0, 5, 6, 8])
            fixtures.push({ id: fixtures.length + 1, contact, lead, registration, retryable, count });
  await db.exec("insert into conversions(id,created_at,contact_capi_retryable,contact_status_capi,lead_status_capi,registration_status_capi,contact_capi_retry_count) values " +
    fixtures.map(row => `(${row.id},'2026-01-01'::timestamptz + ${row.id} * interval '1 second',${[row.retryable,row.contact,row.lead,row.registration,row.count].map(quote).join(",")})`).join(","));
  await db.exec("analyze conversions");
  const expected = fixtures.filter(row => row.retryable === true &&
    [row.contact,row.lead,row.registration].includes("error") &&
    row.count !== null && row.count < 6).map(row => row.id);
  const fingerprintSql = "select md5(string_agg((id,created_at,contact_capi_retryable,contact_status_capi,lead_status_capi,registration_status_capi,contact_capi_retry_count)::text,'|' order by id)) as fingerprint from conversions";
  const fingerprintBefore = (await rows(fingerprintSql))[0].fingerprint;
  await test("populated migration refuses an absent index before taking a table build lock", async () => {
    await assert.rejects(db.exec(migration), /requires a completed concurrent prebuild/);
    assert.equal((await rows(`select to_regclass('public.${indexName}') as index`))[0].index, null);
  });
  await test("canonical selection includes all three event states and excludes null/terminal/disabled/exhausted cases", async () => {
    assert.equal(fixtures.length, 1875);
    assert.ok(expected.length > 100);
    assert.deepEqual(await ids(selection), expected);
    assert.deepEqual(await ids(selection + " limit 100"), expected.slice(0,100));
    planBefore = await plan();
    assert.ok(!nodes(planBefore).some(node => node["Index Name"] === "idx_conversions_contact_capi_retry"));
  });
  await test("standalone concurrent build is adopted without replacing the compatibility index", async () => {
    await db.exec(concurrent);
    await db.exec(migration);
    await db.exec(migration);
    assert.ok((await rows("select to_regclass('public.idx_conversions_contact_capi_retry') as index"))[0].index);
    assert.deepEqual((await rows(`select indisvalid,indisready,indislive from pg_index where indexrelid='${indexName}'::regclass`))[0],
      { indisvalid:true, indisready:true, indislive:true });
  });
  await test("indexed results, order, limit and every persisted field remain unchanged", async () => {
    assert.deepEqual(await ids(selection), expected);
    assert.deepEqual(await ids(selection + " limit 100"), expected.slice(0,100));
    assert.equal((await rows(fingerprintSql))[0].fingerprint, fingerprintBefore);
  });
  await test("EXPLAIN uses the additional index with a lower cost on a 26875-row sparse queue", async () => {
    planAfter = await plan();
    assert.ok(nodes(planAfter).some(node => node["Index Name"] === indexName), JSON.stringify(planAfter));
    assert.ok(!nodes(planAfter).some(node => node["Node Type"] === "Seq Scan"));
    assert.ok(planAfter["Total Cost"] < planBefore["Total Cost"] / 2,
      JSON.stringify({ before:planBefore["Total Cost"],after:planAfter["Total Cost"] }));
  });
  await test("migration rejects an existing index with the wrong predicate", async () => {
    await db.exec(rollback);
    await db.exec(`create index ${indexName} on conversions(created_at) where contact_capi_retryable=true and contact_status_capi='error'`);
    await assert.rejects(db.exec(migration), /invalid or does not match/);
    await db.exec(rollback);
    await db.exec(concurrent);
  });
  await test("migration rejects an interrupted invalid build and accepts its corrected replacement", async () => {
    // Simulate an interrupted build in this disposable in-memory catalog only.
    await db.exec(`update pg_index set indisvalid=false where indexrelid='${indexName}'::regclass`);
    await assert.rejects(db.exec(migration), /invalid or does not match/);
    await db.exec(rollback);
    await db.exec(concurrent);
    await db.exec(migration);
  });
  await test("rollback removes only the additional index and preserves all data", async () => {
    await db.exec(rollback);
    assert.ok((await rows("select to_regclass('public.idx_conversions_contact_capi_retry') as index"))[0].index);
    assert.equal((await rows(fingerprintSql))[0].fingerprint, fingerprintBefore);
  });
} finally { await db.close(); }

// Actual entrypoint/imports. Only IO is injected; no handler-source substitutions.
const modules = new Map(), handlers = {}, logs = [];
let activeDb, networkRequests = 0, writes = 0;
function load(file) {
  file = resolve(file);
  assert.ok(file.startsWith(resolve(root, "supabase/functions") + require("node:path").sep));
  if (modules.has(file)) return modules.get(file);
  const exports = {}; modules.set(file, exports);
  runInNewContext(ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022 }
  }).outputText, {
    exports,
    require: id => id.startsWith("https://esm.sh/@supabase/supabase-js@2")
      ? { createClient:() => activeDb }
      : id.startsWith(".") ? load(resolve(dirname(file),id)) : (() => { throw Error("Unexpected import"); })(),
    Deno:{ env:{get:key=>({SUPABASE_URL:"https://fixture.invalid",SERVICE_ROLE_KEY:"fixture-service",CRON_SECRET:"fixture-cron"})[key]},
      serve:fn=>{handlers[require("node:path").basename(dirname(file))]=fn;} },
    Request,Response,Headers,URL,URLSearchParams,TextEncoder,TextDecoder,Date,
    crypto:globalThis.crypto,AbortSignal,AbortController,setTimeout,clearTimeout,performance,
    fetch:async()=>{networkRequests++;throw Error("Network forbidden");},
    console:{log(){},warn(){},error(...args){logs.push(args.map(String).join(" "));}}
  }, {filename:file});
  return exports;
}
load(join(root,"supabase/functions/retry-failed-conversions/index.ts"));
const diagnostic = load(join(root,"supabase/functions/retry-failed-conversions/queue_diagnostics.ts"));
const sensitive = "private-client@example.invalid secret-token 5491100000000";
for (const [phase,ordinal,responseMessage] of [
  ["contact_selection",1,"Error al buscar Contact CAPI retry"],
  ["lead_selection",2,"Error al buscar Lead CAPI retry"],
  ["purchase_selection",3,"Error al buscar conversiones"]
]) await test(phase + ": original HTTP failure, closed SQLSTATE diagnostic, no writes or sends", async () => {
  logs.length=0; const queries=[];
  activeDb={from(table){
    assert.equal(table,"conversions");
    const calls=[],position=queries.length+1;
    queries.push(calls);
    const query={then:yes=>Promise.resolve({data:[],error:position===ordinal?
      {code:"57014",message:sensitive,details:sensitive,hint:sensitive}:null}).then(yes)};
    for(const method of ["select","eq","or","lt","order","limit","in","gt"])
      query[method]=(...args)=>{calls.push([method,...args]);return query;};
    query.update=()=>{writes++;throw Error("Write forbidden");};
    return query;
  },rpc(){writes++;throw Error("RPC forbidden");}};
  const response=await handlers["retry-failed-conversions"](new Request("https://fixture.invalid/functions/v1/retry-failed-conversions",{
    method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({cron_secret:"fixture-cron"})
  }));
  assert.equal(response.status,500);
  assert.deepEqual(await response.json(),{error:responseMessage});
  assert.equal(queries.length,ordinal);
  const calls=JSON.parse(JSON.stringify(queries));
  assert.ok(calls[0].some(call=>JSON.stringify(call)===JSON.stringify(["or","contact_status_capi.eq.error,lead_status_capi.eq.error,registration_status_capi.eq.error"])));
  assert.ok(calls[0].some(call=>JSON.stringify(call)===JSON.stringify(["eq","contact_capi_retryable",true])));
  assert.ok(calls[0].some(call=>JSON.stringify(call)===JSON.stringify(["lt","contact_capi_retry_count",6])));
  if(ordinal>=2)assert.ok(calls[1].some(call=>JSON.stringify(call)===JSON.stringify(["eq","lead_capi_retryable",true])));
  if(ordinal===3){
    assert.ok(calls[2].some(call=>JSON.stringify(call)===JSON.stringify(["in","purchase_status_capi",["","error"]])));
    assert.ok(calls[2].some(call=>JSON.stringify(call)===JSON.stringify(["gt","valor",0])));
  }
  for(const callsForQueue of calls){
    assert.ok(callsForQueue.some(call=>JSON.stringify(call)===JSON.stringify(["order","created_at",{ascending:true}])));
    assert.ok(callsForQueue.some(call=>JSON.stringify(call)===JSON.stringify(["limit",100])));
  }
  assert.equal(logs.length,1);
  assert.deepEqual(JSON.parse(logs[0]),{event:"capi_retry_queue_selection_failed",version:1,phase,sqlstate:"57014"});
  assert.equal(writes,0);assert.equal(networkRequests,0);
});
await test("diagnostics accept only known SQLSTATEs and never copy messages/details/hints or unknown codes", async () => {
  for(const code of ["55P03","42501","42703","08006","XX000",sensitive,"ALICE","PGRST000","57014\n"+sensitive,57014,null,undefined]){
    logs.length=0;
    diagnostic.logRetryQueueSelectionFailure("contact_selection",{code,message:sensitive,details:sensitive,hint:sensitive});
    assert.equal(logs.length,1);
    const known=["55P03","42501","42703","08006","XX000"].includes(code);
    assert.deepEqual(JSON.parse(logs[0]),{event:"capi_retry_queue_selection_failed",version:1,phase:"contact_selection",sqlstate:known?code:"unknown"});
    assert.ok(!logs[0].includes(sensitive));
  }
  logs.length=0;
  diagnostic.logRetryQueueSelectionFailure(sensitive,null);
  assert.equal(JSON.parse(logs[0]).phase,"unknown");
  assert.equal(JSON.parse(logs[0]).sqlstate,"unknown");
});
console.log(JSON.stringify({passed:results.length,failed:0,productionWrites:0,realNetworkRequests:networkRequests,
  fixtureRows:26875,planCostBefore:planBefore["Total Cost"],planCostAfter:planAfter["Total Cost"],
  limitations:["In-memory PostgreSQL does not certify writer concurrency, live production IO or Edge isolation."],
  tests:results},null,2));
