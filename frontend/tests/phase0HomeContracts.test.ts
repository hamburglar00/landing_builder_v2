import assert from "node:assert/strict";
import test from "node:test";
import type { ConversionRow } from "../lib/conversionsDb";

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.invalid";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "synthetic-key";

test("Phase 0: home pure calculator excludes test and organic revenue, retains input landing count", async (t) => {
  t.mock.timers.enable({apis:["Date"],now:new Date("2026-09-15T12:00:00Z")});
  const {computeHomeOverviewStatsFromConversions} = await import("../lib/conversionStats");
  const row = (id:string,value:number,extra:Partial<ConversionRow> = {}) => ({
    id,user_id:"synthetic-owner",phone:"000001",external_id:"synthetic-player",promo_code:"SYNTHETIC-a",
    created_at:"2026-09-15T00:00:00Z",purchase_event_id:id,purchase_type:"repeat",valor:value,
    from_meta_ads:true,estado:"purchase",...extra,
  } as ConversionRow);
  const stats = computeHomeOverviewStatsFromConversions({conversions:[
    row("one",100),row("two",200),row("test",10000,{test_event_code:"TEST"}),
    row("organic",20000,{from_meta_ads:false}),
  ],landingsCount:7,premiumThreshold:1000});
  assert.deepEqual(stats,{landingsCount:7,porcentajeCarga:0,cargaPromedio:150,totalCargado:300,premium:0,retencionActiva30d:0});
  assert.deepEqual(computeHomeOverviewStatsFromConversions({conversions:[],landingsCount:7,premiumThreshold:1000}),
    {landingsCount:7,porcentajeCarga:0,cargaPromedio:0,totalCargado:0,premium:0,retencionActiva30d:0});
});

test("Phase 0: legacy core counts purchase rows; audience query-time dedupe must not be assumed here", async () => {
  const {computeCoreStats} = await import("../lib/conversionStats");
  const base = {user_id:"synthetic-owner",phone:"000001",external_id:"synthetic-player",created_at:"2026-09-01T00:00:00Z",
    purchase_event_id:"same-event",purchase_type:"repeat",valor:100} as ConversionRow;
  const rows = [{...base,id:"synthetic-a"},{...base,id:"synthetic-b"}];
  const result=computeCoreStats(rows,[],rows,1000);
  assert.equal(result.totalPurchases,2);
  assert.equal(result.totalRevenue,200);
});
