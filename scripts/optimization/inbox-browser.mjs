// Real Chromium + real Inbox component; loopback HTTP replays SQL-generated synthetic rows.
// SQL and PostgREST are measured independently by inbox-tests.mjs.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {join,resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium} from '../phase0/browser-runtime.mjs';
import {root} from '../phase0/local-runtime.mjs';
import {hash} from '../phase0/bootstrap-manifest.mjs';

const fixturePath=process.env.INBOX_BROWSER_FIXTURE;
assert(fixturePath?.includes('inbox-synthetic-browser-'));
const fixture=JSON.parse(readFileSync(fixturePath,'utf8'));
assert(fixture.before.every(r=>r.profile_name.startsWith('Synthetic ')));
const frontend=join(root,'frontend');
const mocks={
  supabase:`const user={id:'74000000-0000-4000-8000-000000000001'};
    const session={user,access_token:'synthetic-inbox-session',expires_at:2524608000};
    const listeners=[];window.__inboxRealtime=(table,row)=>listeners.filter(x=>x.table===table).forEach(x=>x.cb({new:row}));
    export const supabase={auth:{getUser:async()=>({data:{user:await(await fetch('/auth/v1/user')).json()},error:null}),getSession:async()=>({data:{session},error:null})},
    rpc:async(name,body)=>{const r=await fetch('/rest/v1/rpc/'+name,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json();return r.ok?{data,error:null}:{data:null,error:data};},
    realtime:{setAuth:()=>{}},channel:()=>{const channel={on:(_event,filter,cb)=>{listeners.push({...filter,cb});return channel;},subscribe:()=>channel};return channel;},removeChannel:async()=>{listeners.length=0;}};`,
  navigation:`const router={replace:()=>{}};export const useRouter=()=>router;`,
  link:`import React from 'react';export default function Link({children,...props}){return React.createElement('a',props,children);}`,
  currency:`import{useSyncExternalStore}from'react';let scope='ARS';const listeners=new Set();window.__inboxCurrency=value=>{scope=value;listeners.forEach(fn=>fn());};export const useCurrencyScope=()=>({currencyScope:useSyncExternalStore(fn=>{listeners.add(fn);return()=>listeners.delete(fn);},()=>scope)});`,
};
const aliases=new Map([['@/lib/supabaseClient','supabase'],['next/navigation','navigation'],['next/link','link'],['@/components/currency/CurrencyScope','currency']]);
// Async esbuild API supports plugins; run it below rather than its synchronous variant.
const {build}=createRequire(join(root,'frontend/package.json'))('esbuild');
async function bundle(variant){
  const result=await build({absWorkingDir:frontend,stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import Inbox from './components/whatsapp-cloud-api/WhatsAppCloudApiInboxPageContent';createRoot(document.getElementById('root')).render(<Inbox mode="dashboard"/>);`,resolveDir:frontend,loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',minify:true,define:{'process.env.NODE_ENV':'"production"','process.env.NEXT_PUBLIC_SUPABASE_URL':'"http://127.0.0.1"','process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY':'"synthetic-inbox-public"'},plugins:[{name:'synthetic-inbox',setup(builder){
    builder.onResolve({filter:/.*/},args=>aliases.has(args.path)?{path:aliases.get(args.path),namespace:'inbox-mock'}:undefined);
    builder.onLoad({filter:/.*/,namespace:'inbox-mock'},args=>({contents:mocks[args.path],loader:'jsx',resolveDir:frontend}));
    builder.onLoad({filter:/(?:WhatsAppCloudApiInboxPageContent\.tsx|whatsappCloudApiDb\.ts)$/},args=>{
      let contents=variant==='before'?execFileSync('git',['show','ad436ff1ee3a329c1d6c702d0ce2cbfd05f92981:'+resolve(args.path).slice(root.length+1).replaceAll('\\','/')],{cwd:root,encoding:'utf8',windowsHide:true}):readFileSync(args.path,'utf8');
      if(args.path.endsWith('whatsappCloudApiDb.ts'))contents=contents.replace(/(function normalizeInboxMessage\([\s\S]*?\{\r?\n)/,'$1 globalThis.__inboxNormalized=(globalThis.__inboxNormalized||0)+1;\n');
      return {contents,loader:args.path.endsWith('tsx')?'tsx':'ts',resolveDir:resolve(args.path,'..')};
    });
  }}]});return result.outputFiles[0].text;
}

const sourceFiles=['frontend/components/whatsapp-cloud-api/WhatsAppCloudApiInboxPageContent.tsx','frontend/lib/whatsappCloudApiDb.ts','frontend/lib/whatsappInboxMessages.ts'];
const report={kind:'local_synthetic_component_browser',realBackendDuringBrowser:false,backendCoverage:'tests.json real isolated PostgREST',sourceHashes:Object.fromEntries(sourceFiles.map(file=>[file,hash(readFileSync(join(root,file)))])),fixtureSha256:hash(readFileSync(fixturePath)),additionalPresentationFixtures:['gerencia labels','empty selection'],before:null,after:null,checks:[]};
for(const variant of ['before','after']){
  const script=await bundle(variant),requests=[];let browser,scenario=null;
  assert(!script.includes('SYNTHETIC-INBOX-PRIVATE-SECRET-NEVER-PUBLIC'));
  const server=createServer(async(req,res)=>{
    if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><div id="root"></div><script src="/inbox.js"></script>');return;}
    if(req.url==='/inbox.js'){res.setHeader('Content-Type','application/javascript');res.end(script);return;}
    if(req.url==='/favicon.ico'){res.statusCode=204;res.end();return;}
    let text='';for await(const chunk of req)text+=chunk;
    const body=text?JSON.parse(text):{};
    let data=null;
    if(req.url==='/auth/v1/user')data={id:'74000000-0000-4000-8000-000000000001'};
    else if(req.url.endsWith('/get_whatsapp_cloud_api_inbox_threads_page'))data=fixture.before;
    else if(req.url.endsWith('/get_whatsapp_cloud_api_inbox_summaries')){
      data=fixture.cases?.find(c=>Object.entries(c.parameters).every(([key,value])=>key==='p_from'||key==='p_to'
        ? value===null?body[key]===null:Date.parse(value)===Date.parse(body[key])
        : body[key]===value))?.rows;
      assert(data,'Browser mock must match an accredited SQL scenario');
      if(scenario==='gerencia')data=data.map((row,i)=>({...row,assigned_gerencia_label:i<10?'Synthetic Gerencia A':'Synthetic Gerencia B'}));
      if(scenario==='empty')data=[{...fixture.cases.flatMap(c=>c.rows).find(row=>row.profile_name==='Synthetic empty'),total_threads:1}];
    }
    else if(req.url.endsWith('/get_whatsapp_cloud_api_inbox_messages'))data=scenario==='empty'?{messages:[],next_cursor:null}:body.p_before_at?fixture.older:fixture.detail;
    else if(req.url.endsWith('/mark_whatsapp_cloud_api_thread_read'))data=null;
    else{res.statusCode=404;data={message:'Synthetic endpoint not configured'};}
    const encoded=JSON.stringify(data);requests.push({endpoint:req.url,body,rows:Array.isArray(data)?data.length:data?.messages?.length??0,bytes:Buffer.byteLength(encoded)});
    res.setHeader('Content-Type','application/json');res.end(encoded);
  });
  await new Promise(done=>server.listen(0,'127.0.0.1',done));
  try {
    const origin=`http://127.0.0.1:${server.address().port}`;
    browser=await chromium();await browser.send('Network.enable');await browser.send('Performance.enable');
    const pending=new Map(),network=[];
    browser.on('Network.requestWillBeSent',event=>{
      const endpoint=new URL(event.request.url).pathname;
      if(endpoint.startsWith('/rest/v1/rpc/')||endpoint==='/auth/v1/user')pending.set(event.requestId,{endpoint,started:event.timestamp});
    });
    browser.on('Network.loadingFinished',event=>{
      const request=pending.get(event.requestId);if(!request)return;
      network.push({endpoint:request.endpoint,responseMs:(event.timestamp-request.started)*1000,encodedBytes:event.encodedDataLength});pending.delete(event.requestId);
    });
    await browser.send('Network.setBlockedURLs',{urls:['https://*','http://*.supabase.co/*']});
    await browser.send('Emulation.setTimezoneOverride',{timezoneId:'America/Argentina/Buenos_Aires'});
    await browser.send('Page.addScriptToEvaluateOnNewDocument',{source:`{const OriginalDate=Date;globalThis.Date=class extends OriginalDate{constructor(...args){super(...(args.length?args:['2026-09-18T18:00:00Z']));}static now(){return new OriginalDate('2026-09-18T18:00:00Z').getTime();}};`});
    const errors=[];browser.on('Runtime.exceptionThrown',e=>errors.push(e.exceptionDetails.text));await browser.send('Runtime.enable');
    const metrics=async()=>Object.fromEntries((await browser.send('Performance.getMetrics')).metrics.map(x=>[x.name,x.value]));
    await browser.send('HeapProfiler.collectGarbage');const start=await metrics(),began=performance.now();
    await browser.send('Page.navigate',{url:origin});
    const waitFor=async expression=>{for(let i=0;i<150;i++){if(await browser.evaluate(expression))return;await delay(100);}throw Error('Synthetic browser condition timed out: '+expression);};
    await waitFor('document.body.innerText.includes("Synthetic 1")');await delay(100);
    await browser.send('HeapProfiler.collectGarbage');const loaded=await metrics();
    const initialRequests=requests.slice();
    const initialNetwork=network.slice();
    const initialNormalized=await browser.evaluate('globalThis.__inboxNormalized||0');
    assert.equal(initialNormalized,variant==='before'?1000:0);
    const elapsedMs=performance.now()-began;
    assert.equal(requests.filter(x=>x.endpoint.endsWith('/get_whatsapp_cloud_api_inbox_messages')).length,0);
    const projection=requests.find(x=>/get_whatsapp_cloud_api_inbox_(threads_page|summaries)$/.test(x.endpoint));assert(projection);
    assert.deepEqual(projection.body,{p_limit:20,p_offset:0,p_workspace_currency:'ARS',p_tag_filter:'all',p_unread_only:false,p_from:'2026-09-18T03:00:00.000Z',p_to:'2026-09-19T02:59:59.999Z'});
    if(variant==='after'){
      await browser.evaluate(`window.__inboxRealtime('whatsapp_cloud_api_outbound_messages',{config_id:${JSON.stringify(fixture.after[0].config_id)},recipient_wa_id:${JSON.stringify(fixture.after[0].wa_id)},created_at:'2026-09-17T12:00:00Z',payload:{text:{body:'SYNTHETIC-STALE-STATUS-PREVIEW'}},meta_message_id:'synthetic-old-outbound',status:'delivered',message_type:'text'});`);
      await delay(100);assert(!await browser.evaluate("document.body.innerText.includes('SYNTHETIC-STALE-STATUS-PREVIEW')"));
      report.checks.push('an old unselected message status cannot replace the latest preview');
    }
    const firstName=fixture.before[0].profile_name;
    await browser.evaluate(`Array.from(document.querySelectorAll('button')).find(b=>Array.from(b.querySelectorAll('span')).some(p=>p.textContent===${JSON.stringify(firstName)})).click()`);
    await waitFor('Array.from(document.querySelectorAll("section p")).filter(p=>p.textContent.startsWith("SYNTHETIC-INBOX-MESSAGE-")).length===50');await delay(150);
    const selectedRequests=requests.slice(initialRequests.length);
    const selectedNormalized=(await browser.evaluate('globalThis.__inboxNormalized||0'))-initialNormalized;
    assert.equal(selectedNormalized,variant==='before'?0:50);
    if(variant==='after'){
      assert.equal(selectedRequests.filter(x=>x.endpoint.endsWith('/get_whatsapp_cloud_api_inbox_messages')).length,1);
      await browser.evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Mensajes anteriores').click()`);
      await waitFor(`!Array.from(document.querySelectorAll('button')).some(b=>b.textContent.includes('Cargando mensajes')) && document.body.innerText.includes('SYNTHETIC-INBOX-MESSAGE-60')`);
      assert.equal(requests.filter(x=>x.endpoint.endsWith('/get_whatsapp_cloud_api_inbox_messages')).length,2);
      report.checks.push('selected history first and older page rendered','no message request before selection','initial browser parameters match ARS/Today/All/offset 0');
      const click=label=>browser.evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()===${JSON.stringify(label)}).click()`);
      const rowCount=()=>browser.evaluate(`document.querySelectorAll('button[aria-label="Ocultar chat"]').length`);
      const waitList=async()=>{await delay(100);await waitFor('!document.body.innerText.includes("Cargando Inbox")');await delay(100);};
      await browser.evaluate(`for(let i=0;i<60;i++)window.__inboxRealtime('whatsapp_cloud_api_outbound_messages',{config_id:${JSON.stringify(fixture.after[0].config_id)},recipient_wa_id:${JSON.stringify(fixture.after[0].wa_id)},created_at:'2026-09-18T18:01:00Z',payload:{text:{body:'SYNTHETIC-LIVE-'+i}},meta_message_id:'synthetic-live-'+i,status:'sent',message_type:'text'});`);
      await delay(100);assert(await browser.evaluate(`Boolean(document.querySelector('input[placeholder="Escribir respuesta"]:not(:disabled)'))`));
      report.checks.push('60 outbound realtime messages preserve the inbound service window');
      await click('Siguiente');await waitFor('document.body.innerText.includes("Synthetic 21")');assert.equal(await rowCount(),20);
      assert.equal(requests.filter(x=>x.endpoint.endsWith('/get_whatsapp_cloud_api_inbox_messages')).length,2);
      await click('Anterior');await waitFor('document.body.innerText.includes("Synthetic 1")');
      report.checks.push('next and previous conversation pages do not preload details');
      const beforeSearch=requests.length;
      await browser.evaluate(`{const input=document.querySelector('input[placeholder="Buscar contacto"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'SYNTHETIC-NOT-PRESENT');input.dispatchEvent(new Event('input',{bubbles:true}));}`);
      await waitFor('document.body.innerText.includes("No hay threads para los filtros seleccionados.")');assert.equal(requests.length,beforeSearch);
      await browser.evaluate(`{const input=document.querySelector('input[placeholder="Buscar contacto"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'');input.dispatchEvent(new Event('input',{bubbles:true}));}`);
      await waitFor('document.body.innerText.includes("Synthetic 1")');
      report.checks.push('historical page-local search filters the bounded summaries without downloads');
      for(const [label,tag,unread]of [['No leidos','all',true],['Nuevo','nuevo',false],['Contacto','contacto',false],['Lead','lead',false],['Cargo','cargo',false],['Recargo','recompra',false],['Premium','premium',false],['Todos','all',false]]){
        const previous=requests.length;await click(label);await waitList();
        const request=requests.slice(previous).find(x=>x.endpoint.endsWith('/get_whatsapp_cloud_api_inbox_summaries'));
        assert(request);assert.equal(request.body.p_tag_filter,tag);assert.equal(request.body.p_unread_only,unread);
        const expected=fixture.cases.find(c=>c.parameters.p_tag_filter===tag&&c.parameters.p_unread_only===unread&&c.parameters.p_workspace_currency==='ARS'&&c.parameters.p_offset===0&&c.parameters.p_from!==null).rows.length;
        assert.equal(await rowCount(),expected);
      }
      report.checks.push('all tags and unread filter request and render their SQL projection');
      await browser.evaluate("window.__inboxCurrency('PYG')");await waitFor('document.body.innerText.includes("Synthetic PYG")');assert.equal(await rowCount(),1);
      await browser.evaluate("window.__inboxCurrency('ARS')");await waitFor('document.body.innerText.includes("Synthetic 1")');
      await browser.send('Page.reload');await waitFor('document.body.innerText.includes("Synthetic 1")');
      assert.equal(requests.filter(x=>x.endpoint.endsWith('/get_whatsapp_cloud_api_inbox_messages')).length,2);
      report.checks.push('ARS and PYG switch correctly; reload keeps details unloaded');
      await click('Hoy');await click('Máximo');await waitList();
      assert.equal(requests.filter(x=>x.endpoint.endsWith('/get_whatsapp_cloud_api_inbox_summaries')).at(-1).body.p_from,null);
      await click('Máximo');await click('Hoy');await waitList();
      report.checks.push('Today and maximum date presets preserve the server date contract');
      scenario='gerencia';await click('Actualizar');await waitList();
      const beforeGerencia=requests.length;
      await click('Aplicar filtro');await click('Synthetic Gerencia A');await click('Aplicar');await delay(100);
      assert.equal(await rowCount(),10);assert.equal(requests.length,beforeGerencia);
      await browser.evaluate(`document.querySelector('[aria-label="Quitar filtro"]').click()`);await delay(100);assert.equal(await rowCount(),20);
      report.checks.push('gerencia presentation fixture filters only the current 20 summaries without requests');
      scenario='empty';await click('Actualizar');await waitFor('document.body.innerText.includes("Synthetic empty")');
      await browser.evaluate(`Array.from(document.querySelectorAll('button')).find(b=>Array.from(b.querySelectorAll('span')).some(p=>p.textContent==='Synthetic empty')).click()`);
      await waitFor('document.body.innerText.includes("Sin mensajes normalizados")');
      report.checks.push('empty selected conversation renders its empty detail');
    }
    assert.deepEqual(errors,[]);
    report[variant]={initial:{requests:initialRequests.length,rows:projection.rows,bytes:initialRequests.reduce((n,r)=>n+r.bytes,0),rpcBytes:projection.bytes,elapsedMs,http:initialNetwork,taskCpuMs:(loaded.TaskDuration-start.TaskDuration)*1000,scriptCpuMs:(loaded.ScriptDuration-start.ScriptDuration)*1000,heapDeltaBytes:loaded.JSHeapUsedSize-start.JSHeapUsedSize,messageObjects:variant==='before'?fixture.before.reduce((n,r)=>n+r.messages.length,0):0,normalizedMessages:initialNormalized},selection:{requests:selectedRequests.length,bytes:selectedRequests.reduce((n,r)=>n+r.bytes,0),detailRequests:selectedRequests.filter(x=>x.endpoint.endsWith('/get_whatsapp_cloud_api_inbox_messages')).length,normalizedMessages:selectedNormalized},bundleBytes:Buffer.byteLength(script),browserErrors:errors.length};
  }finally{if(browser)await browser.close();await new Promise(done=>server.close(done));}
}
assert(report.after.initial.rpcBytes<report.before.initial.rpcBytes);
writeFileSync(join(root,'docs/optimization/inbox/browser.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
