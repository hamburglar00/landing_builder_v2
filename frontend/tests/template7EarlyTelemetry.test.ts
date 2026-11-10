import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import vm from 'node:vm';
import {renderTemplate7RuntimeAsset} from '../components/public-landing/template7RuntimeAsset';
import type {PublicLandingConfig} from '../components/public-landing/types';
import {buildEntryFunnelFactoryScript} from '../lib/landing/entryFunnel.client';

const config:PublicLandingConfig={id:'a0000000-0000-4000-8000-000000000001',schemaVersion:1,updatedAt:'',name:'Fixture',comment:'',layout:{template:7,ctaPosition:'bottom'},tracking:{pixelId:'',postUrl:'',landingTag:'TEST'}};
async function earlyPayload(metadata:Record<string,unknown>,webdriver=false){
  const sent:Blob[]=[];
  const context:Record<string,any>={__ENTRY_FUNNEL_METADATA__:metadata,performance:{timeOrigin:Date.now()},crypto:{randomUUID},location:{origin:'https://mkt.panelbotadmin.com'},sessionStorage:{getItem:()=>null,setItem:()=>{}},navigator:{webdriver,sendBeacon:(_url:string,body:Blob)=>{sent.push(body);return true}},document:{addEventListener:()=>{},querySelector:()=>null},addEventListener:()=>{},setTimeout:()=>1,clearTimeout:()=>{},requestAnimationFrame:()=>{},Blob};
  context.window=context;
  const script=renderTemplate7RuntimeAsset('fixture',config).config.replace(/^<script[^>]*>/,'').replace(/<\/script>$/,'');
  vm.runInNewContext(script,context);
  context.t7EarlyStage('name_started');
  // A caller adding private data to the context must not broaden the payload.
  context.__ENTRY_FUNNEL_EARLY__.context.password='private';
  context.t7EarlyFlush();
  assert.equal(sent.length,1);
  return JSON.parse(await sent[0].text());
}

test('early abandonment preserves bounded release metadata before the runtime downloads',async()=>{
  const batch=await earlyPayload({engine:'classic',release:'a'.repeat(40),environment:'preview',source:'unknown',token:'private'},true);
  assert.deepEqual(Object.keys(batch).sort(),['events','flow_id','landing_id','template']);
  const event=batch.events[0];
  assert.equal(event.engine,'classic');assert.equal(event.release,'a'.repeat(40));assert.equal(event.environment,'preview');assert.equal(event.source,'synthetic');
  assert.doesNotMatch(JSON.stringify(batch),/password|private|token/);
});

test('early telemetry rejects free-form or wrongly typed provenance without blocking the form',async()=>{
  const batch=await earlyPayload({engine:['classic'],release:'https://private.invalid',environment:'private',source:'real'});
  assert.equal(batch.events[0].engine,undefined);assert.equal(batch.events[0].release,undefined);
  assert.equal(batch.events[0].environment,'unknown');assert.equal(batch.events[0].source,'unknown');
  assert.doesNotMatch(JSON.stringify(batch),/private|https:\/\//);
});

test('the full browser helper also rejects arrays and nested objects as provenance',()=>{
  const context:Record<string,any>={crypto:{randomUUID},location:{origin:'https://mkt.panelbotadmin.com'},sessionStorage:{getItem:()=>null,setItem:()=>{}},navigator:{webdriver:false},document:{readyState:'loading',addEventListener:()=>{}},addEventListener:()=>{},setTimeout:()=>1,clearTimeout:()=>{},performance:{now:()=>0,getEntriesByType:()=>[],timeOrigin:Date.now()}};
  context.window=context;
  const script=`(${buildEntryFunnelFactoryScript()})(${JSON.stringify({landingId:config.id,template:7,telemetry:{engine:['classic'],environment:['production'],source:{private:'value'},entry_strategy:['combined_login']}})}).context()`;
  const result=vm.runInNewContext(script,context);
  assert.equal(result.engine,'constructor');assert.equal(result.environment,'unknown');assert.equal(result.source,'unknown');assert.equal(result.entry_strategy,undefined);
  assert.doesNotMatch(JSON.stringify(result),/private|combined_login/);
});
