/** Public static resources only; never starts a player or conversation. */
export function buildTemplate7ResourceWarmup(gatewayOrigin: string, chatOrigin = process.env.INTERNAL_CHAT_ORIGIN || ""): string {
  const origins: {gateway?: string; chat?: string} = {};
  for (const [key, value] of [["gateway", gatewayOrigin], ["chat", chatOrigin]] as const) {
    try {
      const url = new URL(value);
      if (url.protocol === "https:" && !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash) origins[key] = url.origin;
    } catch { /* Missing optional warmup must not affect the real entry. */ }
  }
  if (!origins.gateway && !origins.chat) return "";
  const settings = JSON.stringify(origins).replaceAll("<", "\\u003c");
  return `<script data-template7-resources>(function(){function warm(){if(window.__TEMPLATE7_REENTRY_PENDING__)return;try{var cfg=${settings};if(cfg.gateway){fetch(cfg.gateway+"/api/preparations/warm",{mode:"no-cors",credentials:"omit",cache:"no-store"}).catch(function(){});["gateway-client.js?v=entry-ready-1"].forEach(function(name){var link=document.createElement("link");link.rel="prefetch";link.as="script";link.href=cfg.gateway+"/"+name;document.head.appendChild(link)})}if(cfg.chat){var frame=document.createElement("iframe");frame.title="Preparando chat";frame.setAttribute("aria-hidden","true");frame.tabIndex=-1;frame.referrerPolicy="no-referrer";frame.style.cssText="position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;border:0";document.body.appendChild(frame);frame.src=cfg.chat+"/embed/warm"}}catch(e){}}if(window.requestAnimationFrame)requestAnimationFrame(function(){requestAnimationFrame(warm)});else setTimeout(warm,0)})();</script>`;
}
