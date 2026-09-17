// Paste into DevTools before navigating WITHIN the panel. It records aggregates only.
// It never reads bodies, headers, query strings, identities or storage, and sends nothing.
// Then call phase0.stop(). Reloading the page removes the observer.
(() => {
  globalThis.phase0?.stop();
  const start = performance.now();
  const resources = [];
  const longTasks = [];
  const allowed = new Set(['conversions','conversion_journey_starts','meta_audience_configs','hidden_conversions',
    'get_meta_audience_buyers_v2_payload','get_home_overview_stats_cached_by_currency',
    'builder-config','landing-phone','phone-click','profiles','conversions_config']);
  const resourceObserver = new PerformanceObserver(list => {
    for (const entry of list.getEntries()) {
      if (entry.startTime < start) continue;
      const url = new URL(entry.name);
      const segment = url.pathname.split('/').filter(Boolean).at(-1);
      const category = allowed.has(segment) ? segment : entry.initiatorType;
      resources.push({category,duration:entry.duration,transfer:entry.transferSize,decoded:entry.decodedBodySize});
    }
  });
  resourceObserver.observe({type:'resource'});
  const taskObserver = new PerformanceObserver(list => longTasks.push(...list.getEntries().map(x=>x.duration)));
  if (PerformanceObserver.supportedEntryTypes.includes('longtask')) taskObserver.observe({type:'longtask'});
  globalThis.phase0 = {stop() {
    resourceObserver.disconnect(); taskObserver.disconnect();
    const byEndpoint = Object.groupBy(resources,r=>r.category);
    const report = {elapsedMs:performance.now()-start,requests:resources.length,
      longTaskCount:longTasks.length,longTaskMs:longTasks.reduce((a,b)=>a+b,0),
      endpoints:Object.entries(byEndpoint).map(([endpoint,rows])=>({endpoint,requests:rows.length,
        durationMs:rows.reduce((s,r)=>s+r.duration,0),transferBytes:rows.reduce((s,r)=>s+r.transfer,0),
        decodedBytes:rows.reduce((s,r)=>s+r.decoded,0)}))};
    console.log(JSON.stringify(report,null,2));
    return report;
  }};
})();
