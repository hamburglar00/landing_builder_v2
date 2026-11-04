// Isolated in-memory PostgreSQL, never connects to production. Set PGLITE_MODULE to an installed module file.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
const { PGlite } = await import(process.env.PGLITE_MODULE ? pathToFileURL(process.env.PGLITE_MODULE).href : "@electric-sql/pglite");
const db = new PGlite();
let checks = 0;
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    grant usage on schema public to anon,authenticated,service_role;
    create table public.landings(id uuid primary key,user_id uuid not null,config jsonb not null);
    grant select on public.landings to service_role;`);
  for (const name of ["20261030234129_entry_funnel_observability", "20261031131638_entry_funnel_chat_diagnostics", "20261031170412_entry_funnel_chat_usable"]) {
    await db.exec(await readFile(new URL(`../supabase/migrations/${name}.sql`, import.meta.url), "utf8"));
  }
  // Apply the collector-only guard from the preceding T9 migration; unrelated routing tables are outside this fixture.
  await db.exec(`alter table entry_funnel_events drop constraint entry_funnel_events_template_check;
    alter table entry_funnel_events add constraint entry_funnel_events_template_check check(template in (7,8,9));`);
  await db.exec(await readFile(new URL("../supabase/migrations/20261104003407_entry_attempt_timings.sql", import.meta.url), "utf8"));
  const id = n => `f0000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
  await db.query("insert into landings values($1,$2,$3),($4,$5,$6)", [id(1),id(2),{template:"template7"},id(9),id(8),{template:"template9"}]);
  const record = async (events, landing = id(1), template = 7) => {
    await db.exec("set role service_role");
    try { return (await db.query("select record_entry_funnel_events($1,$2,$3,$4::jsonb) as ok", [landing,id(3),template,JSON.stringify(events)])).rows[0].ok; }
    finally { await db.exec("reset role"); }
  };
  const original = {id:id(4), name:"cta_clicked",elapsed_ms:100};
  assert.equal(await record([original]),true); checks++;
  const measured = {id:id(5),name:"stage_timing",phase:"provider_create",elapsed_ms:1500,duration_ms:1200,attempt_id:id(6),attempt_number:2,account_kind:"new"};
  assert.equal(await record([measured]),true); checks++;
  assert.equal(await record([measured]),true); checks++;
  assert.equal((await db.query("select count(*)::int as n from entry_funnel_events")).rows[0].n,2); checks++;
  const row = (await db.query("select attempt_id,attempt_number,account_kind,phase,duration_ms from entry_funnel_events where event_id=$1",[id(5)])).rows[0];
  assert.deepEqual(row,{attempt_id:id(6),attempt_number:2,account_kind:"new",phase:"provider_create",duration_ms:1200}); checks++;
  for (const change of [{phase:"url=private"},{duration_ms:-1},{duration_ms:0.5},{duration_ms:86400001},{attempt_number:0},{attempt_number:1001},{attempt_id:"private"},{attempt_number:null},{account_kind:"guessed"},{password:"private"}]) {
    assert.equal(await record([{...measured,id:id(7),...change}]),false); checks++;
  }
  assert.equal(await record([{...original,id:id(7),attempt_id:id(6)}]),false); checks++;
  assert.equal(await record([{...original,id:id(7),phase:"provider_create"}]),false); checks++;
  await assert.rejects(() => db.query(`insert into entry_funnel_events(event_id,landing_id,owner_id,flow_id,template,event_name,elapsed_ms,attempt_id)
    values($1,$2,$3,$4,7,'cta_clicked',100,$5)`,[id(20),id(1),id(2),id(3),id(6)]), /entry_funnel_attempt_pair_check/); checks++;
  assert.equal(await record([{...original,id:id(7),name:"entry_retry",attempt_id:id(6),attempt_number:2,error_stage:"login"}]),true); checks++;
  assert.equal(await record([{...original,id:id(10)}],id(9),9),true); checks++;
  assert.equal(await record([original],id(9),9),false); checks++;
  for (const role of ["anon","authenticated"]) {
    const result = (await db.query("select has_table_privilege($1,'entry_funnel_events','select') as readable, has_function_privilege($1,'record_entry_funnel_events(uuid,uuid,integer,jsonb)','execute') as callable",[role])).rows[0];
    assert.deepEqual(result,{readable:false,callable:false}); checks++;
  }
  assert.equal((await db.query("select event_count from entry_funnel_limits where landing_id=$1",[id(1)])).rows[0].event_count,3); checks++;
  await db.exec(await readFile(new URL("./entry-performance-report.sql", import.meta.url), "utf8")); checks++;
  console.log(`Entry attempt PostgreSQL: ${checks} checks passed (old payloads, timings, attempts, T9, dedup, limits, tenant and role isolation).`);
} finally { await db.close(); }
