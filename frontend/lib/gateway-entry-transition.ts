// Canonical presentation for Template 7 and the four gateways. No auth or provider work.
const brands = {
  rey_de_ases: { name: "Rey de Ases", logo: "/rey-de-ases-logo-transparent.optimized.avif", background: "#080808", glow: "#dba92755" },
  ases_del_norte: { name: "Ases del Norte", logo: "/ases-del-norte-transition-logo.optimized.avif", background: "#000000", glow: "#06131dbb" },
  ganamos_net: { name: "Ganamos NET", logo: "/ganamos-net-transition-logo.webp", background: "#11001f", glow: "#8d2db855" },
  multi_skin: { name: "Ganamos+", logo: "/ganamos-plus-logo-transparent.optimized.avif", background: "#121212", glow: "#9d20d966" },
} as const;
export { brands as GATEWAY_ENTRY_BRANDS };

function escape(value: string) { return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"); }

export function renderGatewayEntryTransition(provider: string, options: { active?: boolean; gatewayOrigin?: string; stage?: "creating" | "connecting" } = {}): string {
  const brand = brands[provider as keyof typeof brands];
  if (!brand) return "";
  let origin = "";
  if (options.gatewayOrigin) {
    try {
      const url = new URL(options.gatewayOrigin);
      if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) return "";
      origin = url.origin;
    } catch { return ""; }
  }
  const logo = origin + brand.logo, stage = options.stage || "connecting";
  // Deferred logos do not compete with the initial form, images, or font requests.
  const image = `<img data-entry-logo data-src="${escape(logo.replace(/\.avif$/, ".webp"))}" alt="${escape(brand.name)}" width="320" height="320">`;
  return `<style id="gateway-entry-transition-style">
#gateway-entry-transition{position:fixed!important;inset:0!important;z-index:2147483500!important;display:grid!important;place-items:center!important;margin:0!important;padding:max(24px,env(safe-area-inset-top)) 16px max(24px,env(safe-area-inset-bottom))!important;background:${brand.background}f5!important;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);color:#fff!important;font:16px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;text-align:center!important;overflow:auto!important;overscroll-behavior:contain}
#gateway-entry-transition[hidden]{display:none!important}#gateway-entry-transition *{box-sizing:border-box}#gateway-entry-transition .entry-content{width:min(100%,430px);margin:auto}#gateway-entry-transition picture{display:block}#gateway-entry-transition [data-entry-logo]{display:block;width:min(78vw,320px);height:auto;max-height:34svh;object-fit:contain;margin:0 auto;filter:drop-shadow(0 8px 24px ${brand.glow})}#gateway-entry-transition h2{font:700 clamp(17px,4.8vw,24px)/1.2 system-ui;margin:20px 0 9px;color:#f6c84b;text-wrap:balance}#gateway-entry-transition p{font:400 clamp(12px,3.1vw,15px)/1.45 system-ui;max-width:36ch;margin:0 auto;color:#ddd;text-wrap:balance}#gateway-entry-transition .entry-spinner{display:block;width:42px;height:42px;border:4px solid #f6c84b33;border-top-color:#f6c84b;border-radius:50%;margin:26px auto 0;animation:gateway-entry-spin .8s linear infinite}#gateway-entry-transition .entry-actions{display:flex;justify-content:center;flex-wrap:wrap;gap:10px;margin-top:24px}#gateway-entry-transition .entry-actions[hidden],#gateway-entry-transition .entry-spinner[hidden]{display:none!important}#gateway-entry-transition button{appearance:none;cursor:pointer;padding:11px 16px;border:1px solid #f6c84b;border-radius:12px;background:#f6c84b;color:#171105;font:700 13px system-ui}#gateway-entry-transition button[data-entry-continue]{background:transparent;color:#f6c84b}#gateway-entry-transition button:focus-visible{outline:2px solid #fff;outline-offset:3px}@keyframes gateway-entry-spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){#gateway-entry-transition .entry-spinner{animation-duration:1.8s}}
</style><div id="gateway-entry-transition" role="status" aria-live="polite" tabindex="-1" data-stage="${stage}"${options.active ? "" : " hidden"}><div class="entry-content">${brand.logo.endsWith(".avif") ? `<picture><source data-entry-source data-srcset="${escape(logo)}" type="image/avif">${image}</picture>` : image}<h2 data-entry-title>${stage === "creating" ? "Creando tu cuenta" : "Conectando con tu asesor"}</h2><p data-entry-description>${stage === "creating" ? "Estamos preparando tu acceso." : "Tu sesión en la plataforma está lista."}</p><span class="entry-spinner" aria-hidden="true"></span><div class="entry-actions" hidden><button data-entry-retry type="button">Reintentar conexión</button><button data-entry-continue type="button">Continuar al chat</button></div></div></div>`;
}

// Included inside the existing critical runtime: no extra script request or SDK dependency.
export const GATEWAY_ENTRY_TRANSITION_RUNTIME = String.raw`
function createGatewayEntryTransition(root) {
  if (!root) return null;
  var frame=null,origin="",wallet=false,timer=0,previous=null;
  var title=root.querySelector("[data-entry-title]"),description=root.querySelector("[data-entry-description]");
  var spinner=root.querySelector(".entry-spinner"),actions=root.querySelector(".entry-actions");
  function finish(){clearTimeout(timer);if(root.hidden)return;root.hidden=true;if(previous&&previous.isConnected)previous.focus({preventScroll:true})}
  function fail(message){if(root.hidden)return;clearTimeout(timer);root.dataset.stage="error";title.textContent="No pudimos completar la conexión";description.textContent=message;spinner.hidden=true;actions.hidden=false}
  function start(stage){clearTimeout(timer);previous=document.activeElement;root.dataset.stage=stage;root.hidden=false;spinner.hidden=false;actions.hidden=true;title.textContent=stage==="preparing"?"Preparando tu acceso":stage==="creating"?"Creando tu cuenta":"Conectando con tu asesor";description.textContent=stage==="connecting"?"Tu sesión en la plataforma está lista.":"Estamos preparando tu acceso.";root.querySelectorAll("[data-entry-source]").forEach(function(el){el.srcset=el.dataset.srcset});root.querySelectorAll("[data-entry-logo]").forEach(function(el){el.src=el.dataset.src});root.focus({preventScroll:true});if(stage==="connecting")timer=setTimeout(function(){fail("La conexión está tardando más de lo esperado. Podés reintentar sin crear otra cuenta.")},20000)}
  root.querySelector("[data-entry-retry]").addEventListener("click",function(){if(frame){start("connecting");frame.src=frame.src}else finish()});
  root.querySelector("[data-entry-continue]").addEventListener("click",function(){finish();if(frame)frame.focus()});
  root.addEventListener("keydown",function(event){if(event.key!=="Tab")return;var buttons=actions.hidden?[]:Array.from(actions.querySelectorAll("button"));if(!buttons.length){event.preventDefault();root.focus();return}if(event.shiftKey&&(document.activeElement===buttons[0]||document.activeElement===root)){event.preventDefault();buttons[buttons.length-1].focus()}else if(!event.shiftKey&&(document.activeElement===buttons[buttons.length-1]||document.activeElement===root)){event.preventDefault();buttons[0].focus()}});
  window.addEventListener("focusin",function(event){if(!root.hidden&&!root.contains(event.target))root.focus({preventScroll:true})});
  window.addEventListener("message",function(event){var data=event.data;if(!frame||event.source!==frame.contentWindow||event.origin!==origin||!data||data.source!=="atrio-widget"||data.type!=="atrio.widget.entry-ready")return;if(!wallet||(data.walletReady===true&&data.walletRequestCompleted===true)||data.walletAvailable===false){finish();return}if(data.walletRequestCompleted===true&&data.walletAvailable===true&&data.walletReady===false)fail("El chat está disponible, pero no pudimos obtener los datos para cargar. Podés reintentar o continuar al chat.")});
  return {start:start,finish:finish,fail:fail,bind:function(value,allowedOrigin,needsWallet){frame=value;origin=allowedOrigin;wallet=needsWallet}};
}
`;
