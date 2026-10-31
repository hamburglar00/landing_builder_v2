/** Public static resources only; never starts a player or conversation. */
export function buildTemplate7ResourceWarmup(gatewayOrigin: string, chatOrigin = process.env.INTERNAL_CHAT_ORIGIN || "", selectedGateway = false): string {
  const origins: {gateway?: string; chat?: string} = {};
  for (const [key, value] of [["gateway", gatewayOrigin], ["chat", chatOrigin]] as const) {
    try {
      const url = new URL(value);
      if (url.protocol === "https:" && !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash) origins[key] = url.origin;
    } catch { /* Missing optional warmup must not affect the real entry. */ }
  }
  if (!origins.gateway && !origins.chat && !selectedGateway) return "";
  const settings = JSON.stringify(origins).replaceAll("<", "\\u003c");
  return `<script data-template7-resources>(function(){
    var cfg=${settings};
    var chatWarmed=false;
    var scripts={};
    function warm(selectedOrigin){
      if(window.__TEMPLATE7_REENTRY_PENDING__)return;
      try {
        var origin=selectedOrigin||cfg.gateway;
        if(origin){
          var parsed=new URL(origin);if(parsed.protocol!=="https:")return;origin=parsed.origin;
          window.__T7_GATEWAY_WARM__=window.__T7_GATEWAY_WARM__||{};
          if(!window.__T7_GATEWAY_WARM__[origin])window.__T7_GATEWAY_WARM__[origin]=fetch(origin+"/api/preparations/warm",{mode:"no-cors",credentials:"omit",cache:"no-store"}).catch(function(){});
          if(!scripts[origin]){scripts[origin]=true;var link=document.createElement("link");link.rel="prefetch";link.as="script";link.href=origin+"/gateway-client.js?v=entry-transition-2";document.head.appendChild(link)}
        }
        if(cfg.chat&&!chatWarmed){
          chatWarmed=true;var frame=document.createElement("iframe");frame.title="Preparando chat";frame.setAttribute("aria-hidden","true");frame.tabIndex=-1;frame.referrerPolicy="no-referrer";
          frame.style.cssText="position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;border:0";document.body.appendChild(frame);frame.src=cfg.chat+"/embed/warm";
        }
      }catch(e){}
    }
    window.__T7_WARM_RESOURCES__=warm;
    function intent(event){
      var target=event.target;
      if(target&&target.closest&&target.closest('[data-template7-form]'))warm(window.__T7_SELECTED_GATEWAY__);
    }
    // Heavy chat code starts only when the visitor interacts with the form.
    // Discovery/paint, PageView and typing never wait for this work.
    document.addEventListener("focusin",intent,{passive:true});
    document.addEventListener("input",intent,{passive:true});
    document.addEventListener("pointerdown",intent,{passive:true});
  })();</script>`;
}
