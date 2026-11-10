import { buildEntryFunnelFactoryScript } from "./landing/entryFunnel.client";

/** Diagnostic context uses a per-tab sealed proof; cookie-only ingress stays compatible.
 * It grants no account access. Milestones never delay login or the trusted chat-ready handler. */
const release = process.env.VERCEL_GIT_COMMIT_SHA || process.env.ENTRY_FUNNEL_RELEASE;
const componentRelease = release && /^[0-9a-f]{7,40}$/.test(release) ? release : undefined;
export const GATEWAY_ENTRY_FUNNEL_SCRIPT = `
(function(){
  if(typeof window==='undefined')return;
  if(window.__gatewayEntryFunnel)return;
  var queued=[],client=window.__entryFunnel||null,authoritative=false,proof,tabKey='gateway-entry-funnel:v2';
  var install=${buildEntryFunnelFactoryScript()};
  function use(context,fromCookie){
    try{
      if(fromCookie&&authoritative)return;
      if(!context||typeof context!=='object'||![7,8,9].includes(context.template))return;
      var uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if(!uuid.test(context.flow_id)||!uuid.test(context.landing_id)||
        !['https://landing.panelbotadmin.com','https://mkt.panelbotadmin.com','https://nexobet.fun'].includes(context.telemetry_origin)||
        !Number.isSafeInteger(context.started_at)||context.started_at>Date.now()+60000||context.started_at<Date.now()-86400000)return;
      proof=typeof context.diagnostic_proof==='string'&&/^e1\\.[A-Za-z0-9_-]{1,2000}$/.test(context.diagnostic_proof)?context.diagnostic_proof:undefined;
      client=install({navigationKind:typeof window.__gatewayEntryFunnelDeferCookie==='boolean'?'preparation':'gateway',componentRelease:${JSON.stringify(componentRelease)},diagnosticProof:function(){return proof;}},context,'/api/entry-funnel');
      if(!client)return;
      if(proof)try{sessionStorage.setItem(tabKey,JSON.stringify(Object.assign({},client.peekContext(),{diagnostic_proof:proof})));}catch(_){}
      if(!fromCookie)authoritative=true;
      queued.splice(0).forEach(function(event){client.emit(event.name,Object.assign({},event.details,{occurred_at_ms:event.at,elapsed_ms:Math.max(0,event.at-context.started_at)}));});
    }catch(_){}
  }
  window.__gatewayEntryFunnel={use:use,context:function(){try{return client&&client.peekContext?client.peekContext():null;}catch(_){return null;}},emit:function(name,details){
    try{if(client)client.emit(name,details||{});else if(queued.length<20)queued.push({name:name,details:details||{},at:Date.now()});}catch(_){}
  }};
  // /complete supplies the authenticated context; avoid a redundant, potentially older cookie read.
  if(client||window.__gatewayEntryFunnelDeferCookie)return;
  var handoff;try{handoff=new URL(location.href).searchParams.get('ef');}catch(_){}
  if(!handoff)try{var stored=JSON.parse(sessionStorage.getItem(tabKey)||'null');if(stored&&stored.diagnostic_proof)use(stored,true);}catch(_){}
  if(client)return;
  try{
    var controller=new AbortController();var timer=setTimeout(function(){controller.abort();},3000);
    fetch('/api/entry-funnel'+(handoff?'?handoff='+encodeURIComponent(handoff):''),{method:'GET',credentials:'same-origin',cache:'no-store',signal:controller.signal})
      .then(function(response){return response.ok?response.json():null;})
      .then(function(value){use(value&&value.entry_funnel||value,true);})
      .catch(function(){})
      .finally(function(){clearTimeout(timer);});
  }catch(_){}
})();`;
