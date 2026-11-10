import { entryFunnelProvenance, type EntryFunnelProvenance, type EntryFunnelTemplate } from "./entryFunnel";

/** Public, non-personal build metadata only. An absent SHA is deliberately unknown. */
export function publicEntryFunnelMetadata(engine: NonNullable<EntryFunnelProvenance["engine"]>): EntryFunnelProvenance {
  const release = process.env.VERCEL_GIT_COMMIT_SHA || process.env.ENTRY_FUNNEL_RELEASE;
  const environment = process.env.VERCEL_ENV || (process.env.NODE_ENV === "development" ? "development" : "unknown");
  return entryFunnelProvenance({ engine,
    ...(release && /^[0-9a-f]{7,40}$/.test(release) ? { release } : {}),
    environment: ["production", "preview", "development"].includes(environment) ? environment : "unknown",
    source: process.env.ENTRY_FUNNEL_SYNTHETIC === "1" ? "synthetic" : "unknown",
  })!;
}

/** Insert before the existing T7/T8/T9 runtime. Does not load or delay Meta. */
export function buildEntryFunnelMetadataScript(engine: NonNullable<EntryFunnelProvenance["engine"]>): string {
  return `window.__ENTRY_FUNNEL_METADATA__=${JSON.stringify(publicEntryFunnelMetadata(engine))};`;
}

/** T1–T6 only: the complete observer/collector lives in the shared static runtime.
 * Keep this small program independent of that asset, including when its download
 * fails. The existing factory adopts this context and replays the same event IDs;
 * the collector deduplicates an earlier beacon against that later replay.
 * Do not persist a second pending queue: the factory would replay it twice.
 * Only the closed metadata and event fields below can leave the browser. */
const EARLY_PUBLIC_TELEMETRY = `(function(c){
var w=window,m=c.telemetry;
m.source=navigator.webdriver===true?'synthetic':m.source;
w.__ENTRY_FUNNEL_METADATA__=Object.assign({},m);
if(w.__entryFunnel||w.__ENTRY_FUNNEL_EARLY__)return;
var uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
if(!uuid.test(c.landingId)||![1,2,3,4,5,6].includes(c.template))return;
function id(){
  if(crypto.randomUUID)return crypto.randomUUID();
  var b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;
  var h=Array.from(b,function(n){return n.toString(16).padStart(2,'0')}).join('');
  return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);
}
var key='entry-funnel:v1:'+c.landingId,now=Date.now(),old,start=Math.round(performance.timeOrigin||now);
if(!Number.isSafeInteger(start)||start>now||start<=now-86400000)start=now;
try{old=JSON.parse(sessionStorage.getItem(key)||'null')}catch(_){}
if(!old||!uuid.test(String(old.flow_id))||old.landing_id!==c.landingId||old.template!==c.template||old.telemetry_origin!==location.origin||!Number.isSafeInteger(old.started_at)||old.started_at>now||old.started_at<=now-86400000||(old.engine&&old.engine!==m.engine)||(old.release!==undefined&&m.release!==undefined&&old.release!==m.release))old=null;
var f=Object.assign({},m,{landing_id:c.landingId,flow_id:old?old.flow_id:id(),template:c.template,telemetry_origin:location.origin,started_at:old?old.started_at:start});
if(old&&uuid.test(String(old.attempt_id))&&Number.isInteger(old.attempt_number)&&old.attempt_number>=1&&old.attempt_number<=1000){f.attempt_id=old.attempt_id;f.attempt_number=old.attempt_number;if(['new','existing'].includes(old.account_kind))f.account_kind=old.account_kind;}
var e=w.__ENTRY_FUNNEL_EARLY__={started_at:f.started_at,context:Object.assign({},f),events:[]};
try{sessionStorage.setItem(key,JSON.stringify(f))}catch(_){}
function active(){return w.__ENTRY_FUNNEL_EARLY__===e&&!w.__entryFunnel;}
function stage(name,error){
  if(!active()||e.events.length>=8||e.events.some(function(v){return v.name===name}))return;
  var v={id:id(),name:name,at:Date.now()};if(error)v.error_code=error;e.events.push(v);
}
function visible(){
  if(!active()||document.visibilityState==='hidden')return;
  stage('page_visible');var form=document.querySelector('[data-entry-funnel-form]');
  if(form&&form.getClientRects().length)stage('form_visible');
}
function flush(){
  if(!active()||!e.events.length)return;
  try{
    var events=e.events.slice(0,8).filter(function(v){return typeof v.id==='string'&&uuid.test(v.id)&&['page_visible','form_visible','name_focus','name_started','name_valid','cta_clicked','entry_error','visibility_hidden'].includes(v.name)&&Number.isSafeInteger(v.at)}).map(function(v){
      var row=Object.assign({},m,{id:v.id,name:v.name,elapsed_ms:Math.max(0,Math.min(86400000,v.at-f.started_at))});
      if(v.name==='entry_error'){row.error_code=['network_error','request_timeout'].includes(v.error_code)?v.error_code:'unknown';row.error_stage='runtime';}return row;
    });
    if(!events.length)return;
    var body=JSON.stringify({landing_id:f.landing_id,flow_id:f.flow_id,template:f.template,events:events});
    try{if(navigator.sendBeacon&&navigator.sendBeacon('/api/entry-funnel',new Blob([body],{type:'text/plain'})))return;}catch(_){}
    if(typeof fetch==='function')fetch('/api/entry-funnel',{method:'POST',body:body,headers:{'Content-Type':'application/json'},credentials:'same-origin',cache:'no-store',keepalive:true}).catch(function(){});
  }catch(_){}
}
function hidden(){if(active()){stage('visibility_hidden');flush();}}
w.addEventListener('pagehide',hidden);
document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden')hidden();else visible();});
w.addEventListener('error',function(event){if(active()&&event.target&&event.target.matches&&event.target.matches('script[data-public-landing-runtime]')){stage('entry_error','network_error');flush();}},true);
document.addEventListener('focusin',function(event){if(active()&&event.target&&event.target.matches&&event.target.matches('[data-entry-funnel-name]')){visible();stage('name_focus');}});
document.addEventListener('input',function(event){var t=event.target;if(active()&&t&&t.matches&&t.matches('[data-entry-funnel-name]')){if(t.value.length)stage('name_started');if(t.value.trim()&&t.checkValidity())stage('name_valid');}});
document.addEventListener('click',function(event){if(!active())return;var t=event.target,a=t&&t.closest&&t.closest('[data-public-landing-cta], [data-entry-funnel-cta]');if(a&&!a.disabled&&a.getAttribute('aria-disabled')!=='true')stage('cta_clicked');},true);
requestAnimationFrame(visible);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',visible,{once:true});
setTimeout(function(){if(active()){stage('entry_error','request_timeout');flush();}},10000);
})`;

/** Small inline bootstrap; no request, account or marketing side effect on load. */
export function buildLandingEntryFunnelScript(config: {
  landingId: string; template: EntryFunnelTemplate; engine: NonNullable<EntryFunnelProvenance["engine"]>;
}): string {
  const settings = JSON.stringify({ landingId: config.landingId, template: config.template,
    telemetry: publicEntryFunnelMetadata(config.engine) }).replace(/</g, "\\u003c");
  return `try{${EARLY_PUBLIC_TELEMETRY}(${settings});}catch(_){};`;
}
