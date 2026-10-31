import { buildEntryFunnelFactoryScript } from "./landing/entryFunnel.client";

/** Diagnostic context is read from an HttpOnly, validated cookie by this same-origin route.
 * It grants no account access. Milestones never delay login or the trusted chat-ready handler. */
export const GATEWAY_ENTRY_FUNNEL_SCRIPT = `
(function(){
  if(typeof window==='undefined')return;
  if(window.__gatewayEntryFunnel)return;
  var queued=[],client=window.__entryFunnel||null,authoritative=false;
  var install=${buildEntryFunnelFactoryScript()};
  function use(context,fromCookie){
    try{
      if(fromCookie&&authoritative)return;
      if(!context||typeof context!=='object'||![7,8].includes(context.template))return;
      var uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if(!uuid.test(context.flow_id)||!uuid.test(context.landing_id)||
        !['https://landing.panelbotadmin.com','https://mkt.panelbotadmin.com'].includes(context.telemetry_origin)||
        !Number.isSafeInteger(context.started_at)||context.started_at>Date.now()+60000||context.started_at<Date.now()-86400000)return;
      client=install({},context,'/api/entry-funnel');
      if(!client)return;
      if(!fromCookie)authoritative=true;
      queued.splice(0).forEach(function(event){client.emit(event.name,Object.assign({},event.details,{elapsed_ms:Math.max(0,event.at-context.started_at)}));});
    }catch(_){}
  }
  window.__gatewayEntryFunnel={use:use,emit:function(name,details){
    try{if(client)client.emit(name,details||{});else if(queued.length<20)queued.push({name:name,details:details||{},at:Date.now()});}catch(_){}
  }};
  if(client)return;
  try{
    var controller=new AbortController();var timer=setTimeout(function(){controller.abort();},3000);
    fetch('/api/entry-funnel',{method:'GET',credentials:'same-origin',cache:'no-store',signal:controller.signal})
      .then(function(response){return response.ok?response.json():null;})
      .then(function(value){use(value&&value.entry_funnel||value,true);})
      .catch(function(){})
      .finally(function(){clearTimeout(timer);});
  }catch(_){}
})();`;
