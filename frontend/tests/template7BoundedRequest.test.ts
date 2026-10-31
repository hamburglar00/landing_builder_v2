import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {buildTemplate7BoundedRequestScript} from '../components/public-landing/template7BoundedRequest';
import {buildClientIdentityBootstrapScript} from '../components/public-landing/clientIdentityBootstrapScript';

type Cancellable = Promise<unknown> & {cancel:()=>void};
function transport(fetch:typeof globalThis.fetch) {
  const browser = {setTimeout,clearTimeout} as unknown as {__T7_FETCH_JSON__:(path:string,init:object,ms:number)=>Cancellable};
  runInNewContext(buildTemplate7BoundedRequestScript(),{window:browser,fetch,AbortController});
  return browser.__T7_FETCH_JSON__;
}
test('destination deadline includes a stalled body and abandons an abort-ignoring response',async()=>{
  let signal:AbortSignal|undefined,release!:(value:object)=>void;
  const read=transport((async(_url,init)=>{signal=init?.signal as AbortSignal;return {ok:true,json:()=>new Promise(resolve=>{release=resolve})};}) as typeof fetch);
  await assert.rejects(read('/destination',{},20),error=>(error as {code:string}).code==='request_timeout');
  assert.equal(signal?.aborted,true);
  release({atrioId:'stale'});await Promise.resolve();
});
test('explicit selection cancellation settles independently of the old network promise',async()=>{
  const read=transport((async()=>new Promise(()=>{})) as typeof fetch);
  const pending=read('/destination',{},12000);
  pending.cancel();
  await assert.rejects(pending,error=>(error as {code:string}).code==='request_cancelled');
});
test('identity retries are shared, retain recovery proof and replace failed readiness',async()=>{
  const calls:Record<string,unknown>[]=[];
  const values=new Map([['template7:identity-recovery:v1','existing-proof']]);
  const browser={setTimeout,clearTimeout} as unknown as {__LB_IDENTITY_READY__:Promise<boolean>;__LB_BOOTSTRAP_IDENTITY__:()=>Promise<boolean>};
  runInNewContext(buildClientIdentityBootstrapScript().replace(/^<script>|<\/script>$/g,''),{
    window:browser,AbortController,localStorage:{getItem:(k:string)=>values.get(k),setItem:(k:string,v:string)=>values.set(k,v)},
    fetch:async(_path:string,init:{body:string})=>{calls.push(JSON.parse(init.body));return {ok:calls.length!==1,status:calls.length===1?503:200,json:async()=>({ok:true,recovery_token:'same-proof-renewed'})};},
  });
  assert.equal(await browser.__LB_IDENTITY_READY__,false);
  const retry=browser.__LB_BOOTSTRAP_IDENTITY__();
  assert.equal(browser.__LB_BOOTSTRAP_IDENTITY__(),retry);
  assert.equal(browser.__LB_IDENTITY_READY__,retry);
  assert.equal(await retry,true);
  assert.deepEqual(calls,[{recovery_token:'existing-proof'},{recovery_token:'existing-proof'},{verify:true}]);
});
