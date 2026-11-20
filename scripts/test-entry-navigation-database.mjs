// In-memory PostgreSQL only. Never reads or connects to a production database.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const db = new PGlite();
const id = n => `f0000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
let checks = 0;
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    grant usage on schema public to anon,authenticated,service_role;
    create table public.landings(id uuid primary key,user_id uuid not null,config jsonb not null,name text default 'Test landing');
    grant select on public.landings to service_role;`);
  for (const migration of ["20261030234129_entry_funnel_observability", "20261031132341_entry_funnel_chat_diagnostics", "20261031170412_entry_funnel_chat_usable", "20261104003407_entry_attempt_timings", "20261105193317_entry_render_timings", "20261110025708_entry_funnel_all_templates_provenance", "20261110163119_entry_funnel_navigation_delivery_observability", "20261115013453_gateway_entry_funnel_engine", "20261120162200_optional_whatsapp_field_funnel"]) {
    await db.exec(await readFile(new URL(`../supabase/migrations/${migration}.sql`, import.meta.url), "utf8"));
  }
  await db.query("insert into landings values($1,$2,$3)", [id(1),id(2),{template:"template7"}]);
  const record = async (events, flow=id(3)) => {
    await db.exec("set role service_role");
    try { return (await db.query("select record_entry_funnel_events($1,$2,7,$3::jsonb) as ok", [id(1),flow,JSON.stringify(events)])).rows[0].ok; }
    finally { await db.exec("reset role"); }
  };
  const event = (n, navigation=id(4)) => ({id:id(n),name:"stage_timing",phase:"phone_total",duration_ms:20,elapsed_ms:50,navigation_id:navigation,navigation_elapsed_ms:40,request_id:id(5),component:"landing",component_release:"abcdef0",phone_outcome:"ready"});
  assert.equal(await record([event(10)]),true); checks++;
  assert.equal(await record([event(10),event(10)]),true); checks++;
  assert.equal((await db.query("select event_count from entry_funnel_limits")).rows[0].event_count,1); checks++;
  for (const invalid of [{navigation_id:"private"},{navigation_elapsed_ms:-1},{component:"username"},{component_release:"token"},{phone_outcome:"phone-number"},{phone_readiness:"private"},{wallet_outcome:null},{loss_count:0},{request_id:"private"},{phone_outcome:["ready"]}]) {
    assert.equal(await record([{...event(11),...invalid}]),false); checks++;
  }
  for (const outcome of ["available","not_applicable","unavailable","error"]) {
    const row={...event(20+checks),name:"wallet_result",wallet_outcome:outcome}; delete row.phase;
    assert.equal(await record([row]),true); checks++;
  }
  const rejection = {...event(99),name:"telemetry_loss",loss_reason:"collector_rejected",loss_count:1}; delete rejection.phase;
  assert.equal(await record([rejection]),true); checks++;
  // Two navigations can share a flow. Count observed visits separately, including
  // a visitor who submits without touching the optional field.
  const reportSql = await readFile(new URL("./optional-whatsapp-field-report.sql", import.meta.url), "utf8");
  const fieldVisit = (n, names, more = {}) => names.map((name, index) => ({
    id: id(n * 10 + index), navigation_id: id(n), elapsed_ms: index, name,
    component: "landing", environment: "production", source: "unknown", ...more,
  }));
  const visible = "whatsapp_field_visible", focus = "whatsapp_field_focus";
  const started = "whatsapp_field_started", submit = "whatsapp_form_submitted";
  const abandoned = fieldVisit(501, [visible, focus, started]);
  assert.equal(await record(abandoned), true); checks++;
  assert.equal(await record(abandoned), true); checks++;
  assert.equal(await record([{ ...abandoned[0], phone: "fake" }]), false); checks++;
  await db.query("update entry_funnel_events set received_at = now() - interval '25 hours' where navigation_id = $1", [id(501)]);
  assert.equal(await record(fieldVisit(502, [visible, submit])), true); checks++;
  assert.equal(await record(fieldVisit(503, [visible, focus])), true); checks++;
  assert.equal(await record(fieldVisit(504, [visible, focus], {source: "synthetic"})), true); checks++;
  assert.equal(await record(fieldVisit(505, [visible, submit], {environment: "preview"})), true); checks++;
  const expected = {
    landing_id: id(1), landing_name: "Test landing", template: 7,
    visits_shown: 3, visits_interacted: 2, visits_started_input: 1, visits_submitted: 1,
    interacted_then_submitted: 0, interacted_without_submit_24h: 1, interacted_still_pending: 1,
  };
  assert.deepEqual((await db.query(reportSql)).rows, [expected]); checks++;
  const lateSubmit = { ...abandoned[2], id: id(9998), name: submit };
  assert.equal(await record([lateSubmit]), true); checks++;
  assert.deepEqual((await db.query(reportSql)).rows, [{...expected, visits_submitted: 2, interacted_then_submitted: 1, interacted_without_submit_24h: 0}]); checks++;
  // Fresh fixtures reach each exact cap; direct insert represents already accepted distinct events.
  const seed = async (flow, count, nav) => db.query(`insert into entry_funnel_events(event_id,landing_id,owner_id,flow_id,template,event_name,elapsed_ms,navigation_id)
    select gen_random_uuid(),$1,$2,$3,7,'page_visible',0,$4 from generate_series(1,$5::integer)`,[id(1),id(2),flow,nav,count]);
  await seed(id(100),299,id(101));
  assert.equal(await record([event(102,id(101))],id(100)),true); checks++;
  assert.equal(await record([event(103,id(101))],id(100)),false); checks++;
  assert.equal(await record([event(102,id(101))],id(100)),true); checks++;
  assert.equal(await record([event(104,id(105))],id(100)),true); checks++;
  await seed(id(200),1999,null);
  assert.equal(await record([event(201,id(202))],id(200)),true); checks++;
  assert.equal(await record([event(203,id(204))],id(200)),false); checks++;
  assert.equal(await record([event(201,id(202))],id(200)),true); checks++;
  // Exactly one new event in a repeated-ID batch consumes one place, not two.
  await db.exec("update entry_funnel_limits set event_count=2999");
  assert.equal(await record([event(300,id(301)),event(300,id(301))],id(302)),true); checks++;
  assert.equal((await db.query("select event_count from entry_funnel_limits")).rows[0].event_count,3000); checks++;
  assert.equal(await record([event(303,id(304))],id(305)),false); checks++;
  assert.equal(await record([event(300,id(301))],id(302)),true); checks++;
  assert.equal(await record([event(300,id(301))],id(999)),false); checks++;
  for (const role of ["anon","authenticated"]) {
    const value=(await db.query("select has_function_privilege($1,'record_entry_funnel_events(uuid,uuid,integer,jsonb)','execute') as callable,has_table_privilege($1,'entry_funnel_events','select') as readable",[role])).rows[0];
    assert.deepEqual(value,{callable:false,readable:false}); checks++;
  }
  console.log(JSON.stringify({checks, database:"PGlite in-memory", remote:false, limits:{flow24h:2000,navigation:300,landingMinute:3000}}));
} finally { await db.close(); }
