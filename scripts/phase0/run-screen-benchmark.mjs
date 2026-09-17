// Unchanged production Next build, synthetic intercepted API, a fresh browser per sample.
// Fixture response times are CDP overhead, not DB latency. No remote API is contacted.
import { spawn,spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { root,delay } from './local-runtime.mjs';
import { chromium } from './browser-runtime.mjs';
import { owner,landingId,user,responseFor } from './screen-fixtures.mjs';
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const base=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{
  cwd:join(root,'frontend'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54399',NEXT_PUBLIC_SUPABASE_ANON_KEY:'synthetic-local',NEXT_TELEMETRY_DISABLED:'1'}});
let serverReady=false;server.stdout.on('data',d=>{if(String(d).includes('Ready'))serverReady=true;});server.stderr.on('data',()=>{});
const reports=[];
const b64=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const token=`${b64({alg:'HS256',typ:'JWT'})}.${b64({sub:owner,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})}.${b64(randomUUID())}`;
const session={access_token:token,refresh_token:randomUUID(),token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user};
async function measure(screen,path,expected,currency,load){
  const browser=await chromium();let current=null,lastActivity=0;const active=new Map();
  try{
    await browser.send('Network.enable');await browser.send('Page.enable');await browser.send('Runtime.enable');
    await browser.send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
    browser.on('Fetch.requestPaused',async e=>{
      const url=new URL(e.request.url),start=performance.now(),scenario=current;
      try{
        if(url.origin===base){await browser.send('Fetch.continueRequest',{requestId:e.requestId});return;}
        if(url.origin!=='http://127.0.0.1:54399'){
          scenario?.blockedExternal.add(url.hostname);await browser.send('Fetch.failRequest',{requestId:e.requestId,errorReason:'BlockedByClient'});return;
        }
        const result=responseFor(e.request,currency);if(result.unknown)scenario?.unknown.add(result.endpoint);
        const body=JSON.stringify(result.unknown?[]:result.data);
        await browser.send('Fetch.fulfillRequest',{requestId:e.requestId,responseCode:200,responseHeaders:[
          {name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:base},
          {name:'Access-Control-Allow-Headers',value:'*'},{name:'Access-Control-Allow-Methods',value:'GET,POST,OPTIONS'},
          {name:'Cache-Control',value:'no-store'}],body:Buffer.from(body).toString('base64')});
        if(scenario&&e.request.method!=='OPTIONS')scenario.api.push({endpoint:result.endpoint,method:e.request.method,rows:result.rows??0,bodyBytes:Buffer.byteLength(body),fixtureResponseMs:performance.now()-start});
        lastActivity=performance.now();
      }catch(error){if(error.message.includes('Invalid InterceptionId')){if(scenario)scenario.cancelledInterceptions++;}else scenario?.errors.push(error.message);}
    });
    browser.on('Network.requestWillBeSent',e=>{
      const url=new URL(e.request.url);
      const kind=url.origin==='http://127.0.0.1:54399'?(e.request.method==='OPTIONS'?'preflight':'api'):
        url.origin===base?(/^\/_next\/static\//.test(url.pathname)||/\.(?:png|svg|jpg|ico|woff2?)$/.test(url.pathname)?'static':'app'):'external';
      active.set(e.requestId,{timestamp:e.timestamp,scenario:current,kind});
      if(current){current.requests++;current.traffic[kind].requests++;}lastActivity=performance.now();
    });
    browser.on('Network.loadingFinished',e=>{const r=active.get(e.requestId);if(r?.scenario){r.scenario.transferredBytes+=e.encodedDataLength;r.scenario.responseMs.push((e.timestamp-r.timestamp)*1000);r.scenario.traffic[r.kind].transferredBytes+=e.encodedDataLength;}active.delete(e.requestId);lastActivity=performance.now();});
    browser.on('Network.loadingFailed',e=>{active.delete(e.requestId);lastActivity=performance.now();});
    browser.on('Runtime.exceptionThrown',e=>current?.errors.push(e.exceptionDetails.text));
    await browser.send('Page.addScriptToEvaluateOnNewDocument',{source:`if(location.origin===${JSON.stringify(base)}){
      localStorage.setItem('sb-127-auth-token',${JSON.stringify(JSON.stringify(session))});
      localStorage.setItem('pbadmin:reporting-currency:v1','${currency}');localStorage.setItem('constructor_setup_guide_hidden:${owner}','1');
      const NativeDate=Date;class FixedDate extends NativeDate{constructor(...args){super(...(args.length?args:['2026-09-16T12:00:00Z']));}static now(){return new NativeDate('2026-09-16T12:00:00Z').getTime();}}window.Date=FixedDate;
      window.__phase0LongTasks=[];new PerformanceObserver(l=>window.__phase0LongTasks.push(...l.getEntries().map(x=>x.duration))).observe({type:'longtask'});
    }`});
    const begin=()=>current={screen,currency,load,requests:0,transferredBytes:0,responseMs:[],api:[],traffic:Object.fromEntries(['static','app','api','preflight','external'].map(k=>[k,{requests:0,transferredBytes:0}])),blockedExternal:new Set(),unknown:new Set(),errors:[],cancelledInterceptions:0};
    async function settled(){for(let i=0;i<160;i++){await delay(250);if(current.api.some(r=>r.endpoint===expected)&&performance.now()-lastActivity>1500&&![...active.values()].some(r=>r.scenario===current))return true;}return false;}
    if(load==='reload'){
      begin();await browser.send('Page.navigate',{url:base+path});if(!await settled())throw new Error(`Preload failed for ${screen}`);
    }
    // Enable the performance agent for the first time only after any preload. Its
    // counters therefore have no previous measured navigation to subtract/mix.
    await browser.send('Performance.enable');await browser.send('Network.clearBrowserCache');await browser.send('Network.setCacheDisabled',{cacheDisabled:true});
    begin();lastActivity=performance.now();const start=performance.now();
    if(load==='reload')await browser.send('Page.reload',{ignoreCache:true});else await browser.send('Page.navigate',{url:base+path});
    const ready=await settled(),elapsedMs=performance.now()-start;
    const metrics=Object.fromEntries((await browser.send('Performance.getMetrics')).metrics.map(x=>[x.name,x.value]));
    const page=await browser.evaluate(`({path:location.pathname,longTasks:window.__phase0LongTasks??[],heading:document.querySelector('h1')?.textContent??null,bodyLength:document.body.innerText.length})`);
    const output={...current,ready,elapsedMs,scriptDurationMs:metrics.ScriptDuration*1000,taskDurationMs:metrics.TaskDuration*1000,layoutDurationMs:metrics.LayoutDuration*1000,
      blockedExternal:[...current.blockedExternal],unknown:[...current.unknown],page};
    if(output.taskDurationMs+1<output.scriptDurationMs)output.errors.push('Invalid CPU counters: script exceeds total task duration');
    console.log(JSON.stringify({screen,currency,load,ready,requests:output.requests,apiRequests:output.api.length,unknown:output.unknown,errors:output.errors}));
    current=null;return output;
  }finally{await browser.close();}
}
try{
  for(let i=0;i<120&&!serverReady;i++)await delay(500);if(!serverReady)throw new Error('Next server not ready; build with the synthetic environment first');
  const scenarios=[['inicio','/dashboard/inicio','get_home_overview_stats_cached_by_currency'],['conversiones','/dashboard/conversiones?tab=tabla','conversions'],
    ['audiencias','/dashboard/conversiones?tab=audiencias','get_meta_audience_buyers_v2_payload'],['landings','/dashboard/landings','landings'],
    ['editor',`/dashboard/landing/${landingId}/editar`,'landings'],['telefonos','/dashboard/telefonos','phone_metrics']];
  for(const currency of ['ARS','PYG'])for(const [screen,path,expected] of scenarios)for(const load of ['first','reload'])reports.push(await measure(screen,path,expected,currency,load));
}finally{
  if(process.platform==='win32')spawnSync('taskkill',['/PID',String(server.pid),'/T','/F'],{windowsHide:true});else server.kill();
  writeFileSync(join(root,'docs/optimization/phase-0/screen-baseline.json'),JSON.stringify({
    environment:'production Next build, actual pages/layout, fresh Chromium per sample, synthetic intercepted API; external HTTP blocked',
    limitations:'fixtureResponseMs is CDP overhead, not server latency; rows/body bytes are synthetic; HTTP totals include assets/prefetch; WebSocket frames excluded; first/reload HTTP cache disabled; CPU counters enabled once per fresh session after any preload',reports},null,2)+'\n');
}
if(reports.length!==24||reports.some(r=>!r.ready||r.unknown.length||r.errors.length))process.exitCode=1;
