import { buildTemplate7RuntimeConfig } from "./template7FastRuntime";
import type { PublicLandingConfig } from "./types";
import generated from "./template7RuntimeAssets.generated.json";


/** Only four config-free programs are cacheable. No tenant, pixel, session,
 * attribution, credentials, or environment values become part of an asset. */
export function template7RuntimeAsset(template: 7 | 8, classic: boolean) {
  const variant = `t${template}-${classic ? "classic" : "builder"}`;
  const asset=(generated as Record<string,{name:string;source:string}>)[variant];
  if(!asset)throw new Error("Run scripts/build-template7-runtime-assets.mjs before rendering Template 7/8");
  return asset;
}

export function template7RuntimeAssetResponse(name: string): Response {
  const match = /^t([78])-(classic|builder)-[a-f0-9]{24}\.js$/.exec(name);
  if (!match) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  const asset = template7RuntimeAsset(Number(match[1]) as 7 | 8, match[2] === "classic");
  if (asset.name !== name) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  return new Response(asset.source, { headers: {
    "Content-Type": "text/javascript; charset=utf-8",
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
  } });
}

/** The form is already HTML. Handle early intent and queue one CTA while this
 * reusable script downloads; never make an unhandled native form submission. */
const EARLY_FORM = `
window.__T7_RUNTIME_READY__=false;
var t7AssetTimer,t7AssetRetries=0,t7AssetLoadSerial=0,t7AssetFailed=false;
function t7AssetStatus(message){
  var grid=document.querySelector('[data-template8-grid]');
  var status=document.querySelector(grid&&!grid.hidden?'[data-template8-status]':'[data-template7-error]');
  if(status){status.textContent=message;status.hidden=!message;}
}
function t7EarlyBusy(action,busy){
  if(!action)return;
  action.setAttribute('aria-busy',String(busy));
  var label=action.querySelector('[data-public-landing-cta-label]');
  if(label)label.textContent=busy?'Preparando...':action.getAttribute('data-public-landing-rest-label')||'Continuar';
}
window.__T7_ASSET_READY__=function(){
  clearTimeout(t7AssetTimer);t7AssetFailed=false;t7AssetStatus('');
  t7EarlyBusy(window.__T7_EARLY_ACTION__,false);
};
function t7AssetRetry(){
  if(window.__T7_RUNTIME_READY__)return;
  clearTimeout(t7AssetTimer);
  var script=document.createElement('script');script.src=window.__T7_RUNTIME_ASSET_URL__+'?entry_retry='+(++t7AssetLoadSerial);
  script.onload=function(){if(!window.__T7_RUNTIME_READY__)t7AssetFailure()};script.onerror=t7AssetFailure;
  document.head.appendChild(script);t7AssetTimer=setTimeout(t7AssetFailure,10000);
}
function t7AssetFailure(){
  if(window.__T7_RUNTIME_READY__)return;
  clearTimeout(t7AssetTimer);
  if(t7AssetRetries++<1){setTimeout(t7AssetRetry,400);return;}
  t7AssetFailed=true;t7EarlyBusy(window.__T7_EARLY_ACTION__,false);
  t7EarlyStage('entry_error','network_error');t7EarlyFlush();
  t7AssetStatus('No pudimos preparar el acceso. Tocá nuevamente el botón para reintentar; tus datos siguen acá.');
}
window.__T7_ASSET_FAILED__=t7AssetFailure;
t7AssetTimer=setTimeout(t7AssetFailure,10000);
window.__ENTRY_FUNNEL_EARLY__={started_at:Date.now(),events:[]};
try{
  var t7Cfg=window.__PUBLIC_LANDING_RUNTIME_CONFIG__||{};
  var t7Uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if(t7Uuid.test(String(t7Cfg.landingId))&&crypto.randomUUID){
    var t7Key='entry-funnel:v1:'+t7Cfg.landingId,t7Template=t7Cfg.template8?8:7,t7Flow=null,t7Now=Date.now();
    try{t7Flow=JSON.parse(sessionStorage.getItem(t7Key)||'null')}catch(e){}
    if(!t7Flow||!t7Uuid.test(String(t7Flow.flow_id))||t7Flow.landing_id!==t7Cfg.landingId||t7Flow.template!==t7Template||t7Flow.telemetry_origin!==location.origin||!Number.isSafeInteger(t7Flow.started_at)||t7Flow.started_at>t7Now||t7Flow.started_at<t7Now-86400000)
      t7Flow={flow_id:crypto.randomUUID(),landing_id:t7Cfg.landingId,template:t7Template,telemetry_origin:location.origin,started_at:t7Now};
    window.__ENTRY_FUNNEL_EARLY__.context=t7Flow;window.__ENTRY_FUNNEL_EARLY__.started_at=t7Flow.started_at;
    try{sessionStorage.setItem(t7Key,JSON.stringify(t7Flow))}catch(e){}
  }
}catch(e){}
function t7EarlyStage(name,errorCode){
  var early=window.__ENTRY_FUNNEL_EARLY__;
  if(!early||early.events.some(function(item){return item.name===name}))return;
  if(early.events.length<8)early.events.push({id:crypto.randomUUID?crypto.randomUUID():undefined,name:name,at:Date.now(),...(errorCode?{error_code:errorCode}:{})});
}
function t7EarlyFlush(){
  if(window.__T7_RUNTIME_READY__)return;
  try{
    var early=window.__ENTRY_FUNNEL_EARLY__,flow=early&&early.context;
    if(!flow||!early.events.length||!navigator.sendBeacon)return;
    var events=early.events.filter(function(event){return event.id}).map(function(event){return {id:event.id,name:event.name,elapsed_ms:Math.max(0,Math.min(86400000,event.at-flow.started_at)),...(event.error_code?{error_code:event.error_code}:{})}});
    navigator.sendBeacon('/api/entry-funnel',new Blob([JSON.stringify({landing_id:flow.landing_id,flow_id:flow.flow_id,template:flow.template,events:events})],{type:'text/plain'}));
  }catch(e){}
}
window.addEventListener('pagehide',t7EarlyFlush);
document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden')t7EarlyFlush()});
requestAnimationFrame(function(){if(document.visibilityState!=='hidden')t7EarlyStage('page_visible')});
function t7Early(event){
  var target=event.target;
  if(!target||!target.closest||window.__T7_RUNTIME_READY__)return;
  var form=target.closest('[data-template7-form]');
  if(form){
    window.__T7_FORM_INTERACTED__=true;
    var input=form.querySelector('[data-template7-name]');
    var cta=form.querySelector('[data-public-landing-cta]');
    if(cta)cta.disabled=!input||!String(input.value||'').trim();
    if(event.type==='focusin'&&target.matches('[data-template7-name]'))t7EarlyStage('name_focus');
    if(event.type==='input'&&target.matches('[data-template7-name]')){
      if(target.value.length)t7EarlyStage('name_started');
      if(target.value.trim()&&target.checkValidity())t7EarlyStage('name_valid');
    }
  }
  var action=target.closest('[data-template8-card-index],[data-public-landing-cta]');
  if(event.type==='submit'&&form)action=form.querySelector('[data-public-landing-cta]');
  if((event.type==='click'||event.type==='submit')&&action){
    event.preventDefault();event.stopImmediatePropagation();
    if(!action.disabled){
      if(action.matches('[data-public-landing-cta]')){t7EarlyStage('cta_clicked');window.__T7_EARLY_CTA_RECORDED__=true;}
      if(window.__T7_EARLY_ACTION__!==action)t7EarlyBusy(window.__T7_EARLY_ACTION__,false);
      window.__T7_EARLY_ACTION__=action;t7EarlyBusy(action,true);
      if(t7AssetFailed){t7AssetFailed=false;t7AssetRetries=0;t7AssetStatus('');t7AssetRetry();}
    }
  }
}
['focusin','input','click','submit'].forEach(function(type){window.addEventListener(type,t7Early,true)});
`;

export function renderTemplate7RuntimeAsset(slug: string, config: PublicLandingConfig, deviceIdScript = "") {
  const asset = template7RuntimeAsset(config.layout?.template === 8 ? 8 : 7, !!deviceIdScript);
  const settings = JSON.stringify(buildTemplate7RuntimeConfig(slug, config, deviceIdScript))
    .replace(/[<>&\u2028\u2029]/g, value => `\\u${value.charCodeAt(0).toString(16).padStart(4, "0")}`);
  const identity = deviceIdScript
    ? `(function(){${deviceIdScript};window.__TEMPLATE7_GET_DEVICE_ID__=getOrCreateDeviceId;})();`
    : "";
  const url = `/public-assets/template-entry/${asset.name}`;
  return {
    preload: `<link rel="preload" as="script" href="${url}">`,
    config: `<script data-template7-runtime-config>window.__PUBLIC_LANDING_RUNTIME_CONFIG__=${settings};window.__T7_RUNTIME_ASSET_URL__=${JSON.stringify(url)};${identity}${EARLY_FORM}</script>`,
    script: `<script src="${url}" data-template7-runtime defer onerror="window.__T7_ASSET_FAILED__()"></script>`,
  };
}
