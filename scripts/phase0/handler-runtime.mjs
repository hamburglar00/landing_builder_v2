// Executes entire unchanged Edge entrypoints and local imports; only platform IO is injected.
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { dirname,join,resolve,relative } from 'node:path';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { root } from './local-runtime.mjs';
const require=createRequire(join(root,'frontend/package.json')),ts=require('typescript');
const {createClient}=require('@supabase/supabase-js');
export async function handlerRuntime(api){
 const sent=[],dbErrors=[],blocked=[],logs=[];let mode='success',gate=null,readGate=null,base;
 const nativeFetch=globalThis.fetch;
 const mockFetch=async(input,init)=>{
  const url=new URL(typeof input==='string'?input:input.url??String(input));
  if(url.hostname==='graph.facebook.com'){
   const payload=JSON.parse(init?.body??'{}');sent.push({events:payload.data,mode});
   if(gate)await gate.arrive();
   if(mode==='network-error')throw new TypeError('Synthetic network failure');
   return new Response(JSON.stringify(mode==='success'?{events_received:1}:{error:{message:'Synthetic transient failure',code:2,is_transient:true}}),{status:mode==='success'?200:503});
  }
  if(url.origin===api.url){
   if(url.pathname.startsWith('/functions/v1/'))return nativeFetch(base+url.pathname+url.search,{...init,headers:{...init?.headers,Connection:'close'}});
   url.pathname=url.pathname.replace(/^\/rest\/v1/,'');
   const response=await nativeFetch(url,init);
   if(readGate&&url.pathname==='/conversion_inbox'&&url.searchParams.get('action')==='eq.LEAD'&&(!init?.method||init.method==='GET'))await readGate.arrive();
   if(!response.ok){const error=await response.clone().json().catch(()=>({}));if(!['23505','PGRST116'].includes(error.code))dbErrors.push({code:error.code,message:error.message,path:url.pathname});}
   return response;
  }
  blocked.push(url.hostname);throw Error('External IO forbidden by Phase 0 harness');
 };
 const handlers={};
 for(const entry of ['conversions','retry-failed-conversions']){
  const cache=new Map();
  const load=file=>{
   file=resolve(file);if(!file.startsWith(resolve(root,'supabase/functions')+require('node:path').sep))throw Error('Module outside function directory');
   if(cache.has(file))return cache.get(file).exports;
   const mod={exports:{}};cache.set(file,mod);
   const localRequire=id=>id.startsWith('https://esm.sh/@supabase/supabase-js@2')?{createClient:(url,key,opts)=>{
    if(url!==api.url||key!==api.jwt)throw Error('Non-local database target');
    return createClient(url,key,{...opts,global:{fetch:mockFetch}});
   }}:id.startsWith('.')?load(resolve(dirname(file),id)):(()=>{throw Error('Unexpected module '+id);})();
   const js=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
   runInNewContext(`(function(require,module,exports){${js}\n})`,{Deno:{env:{get:k=>({SUPABASE_URL:api.url,SERVICE_ROLE_KEY:api.jwt,CRON_SECRET:'synthetic-cron'})[k]},serve:fn=>handlers[entry]=fn},
    fetch:mockFetch,Request,Response,Headers,URL,URLSearchParams,crypto:globalThis.crypto,TextEncoder,TextDecoder,AbortController,AbortSignal,setTimeout,clearTimeout,
    console:{log:()=>{},warn:(...a)=>logs.push(a.map(String).join(' ')),error:(...a)=>logs.push(a.map(String).join(' '))}},
    {filename:relative(root,file)})(localRequire,mod,mod.exports);
   return mod.exports;
  };
  load(join(root,'supabase/functions',entry,'index.ts'));
  if(!handlers[entry])throw Error('Deno.serve callback was not registered');
 }
 const server=createServer(async(req,res)=>{
  try{
   const parts=[];for await(const part of req)parts.push(part);
   const fn=handlers[req.url.split('?')[0].split('/').at(-1)];
   if(!fn){res.writeHead(404).end();return;}
   const response=await fn(new Request(base+req.url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(parts)}:{})}));
   res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());
  }catch{res.writeHead(500).end('Synthetic harness failure');}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}`;
 return {base,sent,dbErrors,blocked,logs,setMode:v=>mode=v,
  barrier:n=>{let arrived=0,release;const done=new Promise(r=>release=r);const timer=setTimeout(()=>release(),15000);gate={arrive:async()=>{if(++arrived===n){clearTimeout(timer);release();}await done;}};return ()=>{clearTimeout(timer);release();gate=null;return arrived;};},
  readBarrier:n=>{let arrived=0,release;const done=new Promise(r=>release=r);const timer=setTimeout(()=>release(),15000);readGate={arrive:async()=>{if(++arrived===n){clearTimeout(timer);release();}await done;}};return ()=>{clearTimeout(timer);release();readGate=null;return arrived;};},
  request:async(entry,body)=>{const r=await nativeFetch(`${base}/functions/v1/${entry}${entry==='conversions'?'?name=synthetic-client':''}`,{method:'POST',headers:{'Content-Type':'application/json',Connection:'close'},body:JSON.stringify(body)});return {status:r.status,body:await r.text()};},
  close:()=>new Promise(r=>{server.closeAllConnections();server.close(r);})};
}
