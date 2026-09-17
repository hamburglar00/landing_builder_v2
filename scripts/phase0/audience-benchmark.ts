import { mapMetaAudienceBuyerPayload, getMetaAudiencePreviewStats, buildMetaAudienceCsv } from "../../frontend/lib/metaAudienceExport";
import { applyMetaAudienceRules } from "../../frontend/lib/metaAudienceRules";

// No network, real identities, storage or application mutations.
const results = [2815, 7975, 20000].map(count => {
  const payload = { version: 2, rows: Array.from({length: count}, (_, i) => [
    `synthetic-${i}`, "", `synthetic-${i}@example.invalid`, "", "", "", "", "", "ar", "ARS",
    3, 1, 2, (i % 100) * 100, (i % 100) * 100 / 3, 100, 50,
    "2026-01-01T00:00:00Z", "2026-09-01T00:00:00Z", 14,
    2, 0, 2, (i % 100) * 100, 0, (i % 100) * 100, (i % 100) * 50, 100,
  ]) };
  const samples: Record<string,number>[] = [];
  let matched = 0, csvBytes = 0;
  for (let repeat = 0; repeat < 18; repeat++) {
    const t0 = performance.now();
    const people = mapMetaAudienceBuyerPayload(payload);
    const t1 = performance.now();
    const segment = applyMetaAudienceRules({people, scope:"all", rules:[
      { id:"top", metric:"period_total_value", operator:"top_percent", value:10 },
      { id:"count", metric:"period_purchase_count", operator:"gte", value:2 },
    ]}).people;
    const t2 = performance.now();
    getMetaAudiencePreviewStats(segment,"period_total_value");
    const t3 = performance.now();
    const csv = buildMetaAudienceCsv({people:segment,selectedFields:["email"],audienceType:"value_based",exportValueMetric:"historical_total_value"});
    const t4 = performance.now();
    matched = segment.length; csvBytes = new TextEncoder().encode(csv).length;
    if(repeat >= 3) samples.push({map:t1-t0,rules:t2-t1,summary:t3-t2,csv:t4-t3,total:t4-t0});
  }
  const timings = Object.fromEntries(Object.keys(samples[0]).map(key => {
    const values = samples.map(s => s[key]).sort((a,b)=>a-b);
    return [key, {p50_ms:values[7],p95_ms:values[14]}];
  }));
  return {count,matched,csvBytes,jsonUtf8Bytes:new TextEncoder().encode(JSON.stringify(payload)).length,samples:15,timings};
});
document.getElementById("result")!.textContent = JSON.stringify({userAgent:navigator.userAgent,hardwareConcurrency:navigator.hardwareConcurrency,results});
