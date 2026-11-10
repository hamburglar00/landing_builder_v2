// Disposable PostgreSQL only. Does not read production or invoke selectors.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const db = new PGlite();
const sql = await readFile(new URL("./entry-performance-report.sql", import.meta.url), "utf8");
const report = sql.split("-- BEGIN unique-click-report")[1].split("-- END unique-click-report")[0];
const uuid = n => `f0000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
let serial=1000,checks=0;
try {
  await db.exec(`create table public.entry_funnel_events (
    event_id uuid primary key,landing_id uuid,flow_id uuid,attempt_id uuid,navigation_id uuid,
    template integer,event_name text,elapsed_ms integer,received_at timestamptz default now(),
    engine text,release text,environment text,source text,attempt_number integer,phone_readiness text);`);
  const put=async (attempt,name,elapsed,extras={})=>{
    const row={event_id:uuid(serial++),landing_id:uuid(1),flow_id:uuid(2),attempt_id:uuid(attempt),navigation_id:uuid(attempt+100),
      template:1,event_name:name,elapsed_ms:elapsed,engine:"classic",release:"abcdef0",environment:"production",source:"synthetic",attempt_number:1,...extras};
    const keys=Object.keys(row);
    await db.query(`insert into entry_funnel_events(${keys.join(",")}) values(${keys.map((_,i)=>`$${i+1}`).join(",")})`,Object.values(row));
  };
  await put(10,"phone_at_click",100,{phone_readiness:"ready"});
  await put(10,"phone_at_click",105,{phone_readiness:"ready"}); // Duplicate milestone, distinct UUID.
  await put(10,"outbound_requested",400);
  await put(10,"outbound_requested",450);
  await put(11,"phone_at_click",150,{phone_readiness:"pending"});
  await put(11,"phone_at_click",190,{phone_readiness:"ready"}); // Later readiness must not improve numerator.
  await put(11,"outbound_requested",250);
  await put(12,"phone_at_click",200,{phone_readiness:"unknown"});
  await put(13,"phone_at_click",200,{phone_readiness:"ready",navigation_id:null});
  await put(14,"cta_clicked",200); // Nexo/legacy without a phone sample still measures click->outbound.
  await put(14,"outbound_requested",600);
  await put(15,"phone_at_click",200,{phone_readiness:"ready",release:"7654321"});
  await put(15,"outbound_requested",400); // Other release: do not join.
  await put(16,"phone_at_click",200,{phone_readiness:"ready",engine:"constructor"});
  await put(16,"outbound_requested",500,{engine:"constructor",navigation_id:uuid(999)}); // Other document.
  await put(17,"phone_at_click",200,{phone_readiness:"failed",attempt_number:2});
  await put(17,"entry_retry",250,{attempt_number:2});
  await put(18,"phone_at_click",200,{phone_readiness:"ready",source:null});
  await put(19,"phone_at_click",200,{phone_readiness:null});
  await put(20,"phone_at_click",200,{phone_readiness:"ready",source:"unknown"});
  await put(21,"phone_at_click",200,{phone_readiness:"ready",received_at:"2020-01-01T00:00:00Z"});
  await put(22,"phone_at_click",200,{phone_readiness:"ready",attempt_id:null});
  const rows=(await db.query(report)).rows;
  const main=rows.find(r=>r.engine==="classic"&&r.release==="abcdef0"&&r.source==="synthetic"&&r.attempt_kind==="first");
  assert.equal(Number(main.observed_attempts),6);checks++;
  assert.equal(Number(main.observed_cta_events),1);checks++;
  assert.equal(Number(main.observed_phone_click_events),7);checks++;
  assert.equal(Number(main.readiness_sample_attempts),2);checks++;
  assert.equal(Number(main.ready_attempts),1);checks++;
  assert.equal(Number(main.ready_pct),50);checks++;
  assert.equal(Number(main.readiness_coverage_pct),33.33);checks++;
  assert.equal(Number(main.outbound_coverage_pct),60);checks++;
  assert.equal(Number(main.attempts_without_readiness_sample),4);checks++;
  assert.equal(Number(main.incomplete_context_attempts),1);checks++;
  assert.equal(Number(main.outbound_timing_samples),3);checks++;
  assert.equal(Number(main.attempts_without_observed_outbound),2);checks++;
  assert.equal(main.click_to_outbound_p50_ms,300);checks++;
  assert.equal(Number(rows.find(r=>r.release==="7654321").outbound_timing_samples),0);checks++;
  assert.equal(Number(rows.find(r=>r.engine==="constructor").outbound_timing_samples),0);checks++;
  assert.equal(rows.find(r=>r.attempt_kind==="later").transport_retried,true);checks++;
  assert.equal(rows.find(r=>r.source==="missing").ready_pct,null);checks++;
  assert.equal(Number(rows.find(r=>r.source==="unknown").ready_pct),100);checks++;
  assert.ok(rows.every(r=>r.ready_pct===null||(Number(r.ready_pct)>=0&&Number(r.ready_pct)<=100)));checks++;
  assert.ok(rows.every(r=>r.collector_scope==="builder"));checks++;
  await db.exec("alter table entry_funnel_events rename to nx_entry_funnel_events");
  const nexo=(await db.query(report.replaceAll("public.entry_funnel_events","public.nx_entry_funnel_events").replace("'builder'::text","'nexo'::text"))).rows;
  assert.equal(nexo.length,rows.length);checks++;
  assert.ok(nexo.every(r=>r.collector_scope==="nexo"));checks++;
  await db.exec("truncate nx_entry_funnel_events");
  assert.equal((await db.query(report.replaceAll("public.entry_funnel_events","public.nx_entry_funnel_events"))).rows.length,0);checks++;
  console.log(JSON.stringify({checks,database:"PGlite in-memory",remote:false,report:"unique clicks, readiness percentage, outbound timing, Nexo adaptation"}));
} finally {await db.close();}
