/** Public static resources only; never starts a player or conversation. */
export function buildTemplate7ResourceWarmup(gatewayOrigin: string, chatOrigin = process.env.INTERNAL_CHAT_ORIGIN || "", selectedGateway = false): string {
  // Cross-top-level iframe caches are partitioned. The gateway warms the chat
  // in its real context; a hidden landing iframe duplicates CPU/network work.
  void chatOrigin; // Retained parameter for existing callers.
  const origins: {gateway?: string} = {};
  for (const [key, value] of [["gateway", gatewayOrigin]] as const) {
    try {
      const url = new URL(value);
      if (url.protocol === "https:" && !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash) origins[key] = url.origin;
    } catch { /* Missing optional warmup must not affect the real entry. */ }
  }
  if (!origins.gateway && !selectedGateway) return "";
  const settings = JSON.stringify(origins).replaceAll("<", "\\u003c");
  return `<script data-template7-resources>(function(){
    var cfg=${settings};
    function warm(selectedOrigin){
      if(window.__TEMPLATE7_REENTRY_PENDING__)return;
      try {
        var origin=selectedOrigin||cfg.gateway;
        if(origin){
          var parsed=new URL(origin);if(parsed.protocol!=="https:")return;origin=parsed.origin;
          window.__T7_GATEWAY_WARM__=window.__T7_GATEWAY_WARM__||{};
          if(!window.__T7_GATEWAY_WARM__[origin])window.__T7_GATEWAY_WARM__[origin]=fetch(origin+"/api/preparations/warm",{mode:"no-cors",credentials:"omit",cache:"no-store"}).catch(function(){});
        }
      }catch(e){}
    }
    window.__T7_WARM_RESOURCES__=warm;
    function intent(event){
      var target=event.target;
      if(target&&target.closest&&target.closest('[data-template7-form]'))warm(window.__T7_SELECTED_GATEWAY__);
    }
    // Optional gateway work starts only when the visitor interacts with the form.
    // Discovery/paint, PageView and typing never wait for this work.
    document.addEventListener("focusin",intent,{passive:true});
    document.addEventListener("input",intent,{passive:true});
    document.addEventListener("pointerdown",intent,{passive:true});
  })();</script>`;
}
