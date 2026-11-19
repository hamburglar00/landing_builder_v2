// Canonical presentation for Template 7 and the four gateways. No auth or provider work.
const brands = {
  rey_de_ases: { name: "Rey de Ases", logo: "/rey-de-ases-logo-transparent.optimized.avif", background: "#080808", glow: "#c49a3255", primary: "#c49a32", accent: "#efd27b", accentText: "#171105" },
  ases_del_norte: { name: "Ases del Norte", logo: "/ases-del-norte-transition-logo.optimized.avif", background: "#071b2c", glow: "#36a8eb33", primary: "#2186c5", accent: "#36a8eb", accentText: "#071b2c" },
  ganamos_net: { name: "Ganamos NET", logo: "/ganamos-net-transition-logo.webp", background: "#0d0618", glow: "#7c34e855", primary: "#7c34e8", accent: "#b02cf0", accentText: "#ffffff" },
  multi_skin: { name: "Ganamos+", logo: "/ganamos-plus-logo-transparent.optimized.avif", background: "#0d0618", glow: "#7c34e855", primary: "#7c34e8", accent: "#b02cf0", accentText: "#ffffff" },
} as const;
export { brands as GATEWAY_ENTRY_BRANDS };

type EntryBrandOverride = { name: string; logo: string; background?: string; glow?: string; primary?: string; accent?: string; accentText?: string };
export function resolveGatewayEntryBrand(provider: string, override?: EntryBrandOverride) {
  const base = brands[provider as keyof typeof brands];
  if (!base) return null;
  // Ganamos+ has one entry palette even when passed its broader casino catalog.
  // Other skins retain their own catalog colors and assets.
  if (provider === "multi_skin" && override?.logo === base.logo) return { ...base, muted: "#ddd" };
  return { ...base, ...override, muted: "#ddd" };
}

export function gatewayPreparationTheme(provider: string, override?: EntryBrandOverride) {
  const brand = resolveGatewayEntryBrand(provider, override);
  if (!brand) throw new Error("Unknown entry brand");
  return {
    title: brand.name, canvasColor: brand.background, logo: brand.logo, logoAlt: brand.name,
    background: brand.background, accent: brand.accent, accentText: brand.accentText,
    primary: brand.primary, text: "#fff", muted: brand.muted,
    panel: brand.background, panelBorder: brand.accent + "66",
    spinnerTrack: brand.accent + "26", shadow: "0 8px 24px " + brand.glow,
  };
}

// Indicative motion flows quickly toward 70%, then slows as it approaches 90%.
// Preparation resumes at 90%; connecting can creep toward 98%. None of these
// animations gates readiness or navigation, and only real readiness completes it.
export const ENTRY_PROGRESS_CSS = `
.entry-progress{display:block;width:min(100%,300px);margin:26px auto 0;text-align:left}
.entry-progress[hidden]{display:none!important}
.entry-progress-track{display:block;height:9px;overflow:hidden;border-radius:999px;background:var(--entry-track,#f6c84b26)}
.entry-progress-fill{display:block;height:100%;width:100%;transform-origin:left;border-radius:inherit;background:linear-gradient(90deg,var(--entry-primary,#c49a32),var(--entry-accent,#efd27b));transform:scaleX(.9)}
.entry-progress-stops{display:flex;justify-content:space-between;gap:12px;margin-top:13px;color:#8e8b94;font:500 11px/1.3 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:.02em}
.entry-progress-stop{display:flex;align-items:center;gap:6px;white-space:nowrap}
.entry-progress-stop::before{content:"";width:6px;height:6px;border:1px solid currentColor;border-radius:50%;flex:0 0 6px}
.entry-progress:is([data-phase="creating"],[data-phase="preparing"],[data-phase="account"]) [data-stop="account"],.entry-progress:is([data-phase="login"],[data-phase="session"]) [data-stop="access"],.entry-progress[data-phase="connecting"] [data-stop="chat"]{color:#fff}
.entry-progress:is([data-phase="login"],[data-phase="session"],[data-phase="connecting"],[data-phase="complete"]) [data-stop="account"],.entry-progress:is([data-phase="connecting"],[data-phase="complete"]) [data-stop="access"],.entry-progress[data-phase="complete"] [data-stop="chat"]{color:var(--entry-accent,#efd27b)}
.entry-progress:is([data-phase="login"],[data-phase="session"],[data-phase="connecting"],[data-phase="complete"]) [data-stop="account"]::before,.entry-progress:is([data-phase="connecting"],[data-phase="complete"]) [data-stop="access"]::before,.entry-progress[data-phase="complete"] [data-stop="chat"]::before{background:currentColor}
.entry-progress[data-start="initial"]:not([data-phase="complete"]) .entry-progress-fill{animation:entry-progress-wait 9s linear both}
.entry-progress[data-start="continuation"][data-phase="connecting"] .entry-progress-fill{animation:entry-progress-connect 16s linear both}
.entry-progress[data-phase="complete"] .entry-progress-fill{animation:none;transform:scaleX(1)}
.entry-progress[data-paused="true"] .entry-progress-fill{animation-play-state:paused}
@keyframes entry-progress-wait{0%{transform:scaleX(.06)}8%{transform:scaleX(.7)}20%{transform:scaleX(.81)}38%{transform:scaleX(.86)}60%{transform:scaleX(.89)}100%{transform:scaleX(.9)}}
@keyframes entry-progress-connect{0%{transform:scaleX(.9)}20%{transform:scaleX(.94)}45%{transform:scaleX(.96)}75%{transform:scaleX(.975)}100%{transform:scaleX(.98)}}
@media(prefers-reduced-motion:reduce){.entry-progress .entry-progress-fill{animation:none!important}}
`;
export function renderEntryProgress(phase: string, initial = phase === "creating" || phase === "preparing") {
  return `<div class="entry-progress" data-entry-progress${phase === "verifying" || phase === "connecting" ? " hidden" : ""} data-start="${initial ? "initial" : "continuation"}" data-phase="${phase}" role="progressbar" aria-label="Preparando tu acceso"><span class="entry-progress-track"><span class="entry-progress-fill"></span></span><span class="entry-progress-stops" aria-hidden="true"><span class="entry-progress-stop" data-stop="account">Cuenta</span><span class="entry-progress-stop" data-stop="access">Acceso</span><span class="entry-progress-stop" data-stop="chat">Chat</span></span></div>`;
}

function escape(value: string) { return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"); }

export function renderGatewayEntryTransition(provider: string, options: { active?: boolean; gatewayOrigin?: string; stage?: "creating" | "connecting" | "verifying"; brand?: EntryBrandOverride } = {}): string {
  const brand = resolveGatewayEntryBrand(provider, options.brand);
  if (!brand) return "";
  // Brand overrides come from the server's closed skin catalog; routing stays in the signed handoff.
  const accent = brand.accent, accentText = brand.accentText;
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
  const showLogoImmediately = options.active && (stage === "verifying" || stage === "connecting");
  const fallbackLogo = escape(logo.replace(/\.avif$/, ".webp"));
  const image = `<img data-entry-logo data-src="${fallbackLogo}"${showLogoImmediately ? ` src="${fallbackLogo}"` : ""} alt="${escape(brand.name)}" width="320" height="320">`;
  const title = stage === "verifying" ? "" : stage === "creating" ? "Creando tu cuenta" : "Conectando con tu asesor…";
  const description = stage === "creating" ? "Estamos preparando tu acceso." : "";
  return `<style id="gateway-entry-transition-style">
html:has(#gateway-entry-transition:not([hidden])),body:has(#gateway-entry-transition:not([hidden])){background-color:var(--gateway-page-background,var(--gateway-entry-canvas,${brand.background}))!important;color-scheme:dark}
#gateway-entry-transition[data-stage="creating"],#gateway-entry-transition[data-stage="preparing"]{background:var(--entry-background,${brand.background})!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
#gateway-entry-transition{position:fixed!important;inset:0!important;z-index:2147483500!important;display:grid!important;place-items:center!important;margin:0!important;padding:max(24px,env(safe-area-inset-top)) 16px max(24px,env(safe-area-inset-bottom))!important;background:var(--entry-background,${brand.background})!important;backdrop-filter:none;-webkit-backdrop-filter:none;color:#fff!important;font:16px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;text-align:center!important;overflow:auto!important;overscroll-behavior:contain}
#gateway-entry-transition{outline:none}#gateway-entry-transition[hidden]{display:none!important}#gateway-entry-transition *{box-sizing:border-box}#gateway-entry-transition .entry-content{width:min(100%,430px);margin:auto}#gateway-entry-transition picture{display:block}#gateway-entry-transition [data-entry-logo]{display:block;width:min(78vw,320px);height:min(78vw,320px,34svh);object-fit:contain;margin:0 auto;filter:drop-shadow(0 8px 24px var(--entry-glow,${brand.glow}))}#gateway-entry-transition h2{font:700 clamp(17px,4.8vw,24px)/1.2 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:20px 0 9px;color:var(--entry-accent,#f6c84b);letter-spacing:-.02em;text-wrap:balance}#gateway-entry-transition p{font:400 clamp(12px,3.1vw,15px)/1.45 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;max-width:36ch;margin:0 auto;color:#ddd;letter-spacing:-.01em;text-wrap:balance}#gateway-entry-transition .entry-spinner{display:block;width:42px;height:42px;border:4px solid var(--entry-track,#f6c84b33);border-top-color:var(--entry-accent,#f6c84b);border-radius:50%;margin:26px auto 0;animation:gateway-entry-spin .8s linear infinite}#gateway-entry-transition .entry-actions{display:flex;justify-content:center;flex-wrap:wrap;gap:10px;margin-top:24px}#gateway-entry-transition .entry-actions[hidden],#gateway-entry-transition .entry-spinner[hidden]{display:none!important}#gateway-entry-transition button{appearance:none;cursor:pointer;padding:11px 16px;border:1px solid var(--entry-accent,#f6c84b);border-radius:12px;background:var(--entry-accent,#f6c84b);color:var(--entry-accent-text,#171105);font:700 13px system-ui}#gateway-entry-transition button[data-entry-continue]{background:transparent;color:var(--entry-accent,#f6c84b)}#gateway-entry-transition button:focus-visible{outline:2px solid #fff;outline-offset:3px}@keyframes gateway-entry-spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){#gateway-entry-transition .entry-spinner{animation-duration:1.8s}}
${ENTRY_PROGRESS_CSS}</style><div id="gateway-entry-transition" role="status" aria-live="polite" tabindex="-1" data-stage="${stage}" data-palette="${brand.background}" style="--entry-background:${brand.background};--entry-accent:${accent};--entry-primary:${brand.primary};--entry-track:${accent}26;--entry-accent-text:${accentText};--entry-glow:${brand.glow}"${options.active ? "" : " hidden"}><div class="entry-content">${brand.logo.endsWith(".avif") ? `<picture><source data-entry-source data-srcset="${escape(logo)}"${showLogoImmediately ? ` srcset="${escape(logo)}"` : ""} type="image/avif">${image}</picture>` : image}<h2 data-entry-title>${title}</h2><p data-entry-description>${description}</p>${renderEntryProgress(stage)}<div class="entry-actions" hidden><button data-entry-retry type="button">Reintentar conexión</button><button data-entry-continue type="button">Continuar al chat</button></div></div></div>`;
}

// Included inside the existing critical runtime: no extra script request or SDK dependency.
export const GATEWAY_ENTRY_TRANSITION_RUNTIME = String.raw`
function createGatewayEntryTransition(root) {
  if (!root) return null;
  var frame=null,origin="",wallet=false,timer=0,retryTimer=0,automaticRetries=0,previous=null,themeSnapshot=null,addedTheme=null,canvasSnapshot=null,frameLoadHandler=null,frameBoundAt=0,entryReady=false,refreshController=null,refreshGeneration=0,attemptDeadline=0;
  // The casino document owns its browser chrome from first paint. A connecting
  // overlay must not temporarily replace it with the blue/login entry palette.
  // Landing and preparation documents lack this property and keep their brand.
  function applyPalette(){if(themeSnapshot!==null)return;var palette=root.dataset.palette;try{var pagePalette=getComputedStyle(document.documentElement).getPropertyValue("--gateway-page-background").trim();if(/^#[0-9a-f]{6}$/i.test(pagePalette))palette=pagePalette}catch(_){}if(document.documentElement&&document.documentElement.style){canvasSnapshot=document.documentElement.style.getPropertyValue("--gateway-entry-canvas");document.documentElement.style.setProperty("--gateway-entry-canvas",palette)}themeSnapshot=Array.from(document.querySelectorAll('meta[name="theme-color"]')).map(function(meta){var previous=meta.getAttribute("content");meta.setAttribute("content",palette);return [meta,previous]});if(!themeSnapshot.length){addedTheme=document.createElement("meta");addedTheme.name="theme-color";addedTheme.content=palette;document.head.appendChild(addedTheme)}}
  function restorePalette(){if(themeSnapshot===null)return;if(canvasSnapshot!==null&&document.documentElement&&document.documentElement.style){if(canvasSnapshot)document.documentElement.style.setProperty("--gateway-entry-canvas",canvasSnapshot);else document.documentElement.style.removeProperty("--gateway-entry-canvas");canvasSnapshot=null}themeSnapshot.forEach(function(item){if(item[1]===null)item[0].removeAttribute("content");else item[0].setAttribute("content",item[1])});if(addedTheme)addedTheme.remove();themeSnapshot=null;addedTheme=null}
  var title=root.querySelector("[data-entry-title]"),description=root.querySelector("[data-entry-description]");
  var spinner=root.querySelector("[data-entry-progress]")||root.querySelector(".entry-spinner"),actions=root.querySelector(".entry-actions");
  function milestone(name,details){try{if(window.__gatewayEntryFunnel)window.__gatewayEntryFunnel.emit(name,details)}catch(e){}}
  function chatDetails(data){var details={component:"chat"},uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;["navigation_id","request_id"].forEach(function(key){if(typeof data[key]==="string"&&uuid.test(data[key]))details[key]=data[key].toLowerCase()});if(typeof data.component_release==="string"&&/^[a-f0-9]{7,40}$/i.test(data.component_release))details.component_release=data.component_release.toLowerCase();if(Number.isSafeInteger(data.navigation_elapsed_ms)&&data.navigation_elapsed_ms>=0&&data.navigation_elapsed_ms<=86400000)details.navigation_elapsed_ms=data.navigation_elapsed_ms;return details}
  function traceUrl(value){try{var url=new URL(value);if(url.origin!==origin||!/^\/embed\//.test(url.pathname)||!window.crypto||typeof window.crypto.randomUUID!=="function")return value;var funnel=window.__gatewayEntryFunnel,context=funnel&&typeof funnel.context==="function"?funnel.context():null;var uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;if(context&&uuid.test(context.flow_id))url.searchParams.set("ef_flow",context.flow_id);if(context&&uuid.test(context.attempt_id))url.searchParams.set("ef_attempt",context.attempt_id);url.searchParams.set("ef_navigation",window.crypto.randomUUID());url.searchParams.set("ef_request",window.crypto.randomUUID());return url.href}catch(_){return value}}
  function cancelRefresh(){refreshGeneration++;if(refreshController)refreshController.abort();refreshController=null}
  function finish(completed){if(completed===true&&spinner)spinner.dataset.phase="complete";clearTimeout(timer);clearTimeout(retryTimer);retryTimer=0;cancelRefresh();if(root.hidden)return;root.hidden=true;restorePalette();if(previous&&previous.isConnected)previous.focus({preventScroll:true})}
  function fail(message,details){if(root.hidden)return;clearTimeout(timer);clearTimeout(retryTimer);retryTimer=0;cancelRefresh();milestone("entry_error",details||{error_code:"chat_unavailable",error_stage:"chat"});root.dataset.stage="error";title.textContent="No pudimos completar la conexión";description.textContent=message;spinner.hidden=true;actions.hidden=false}
  async function refreshChat(message){
    if(!frame||root.hidden)return;
    cancelRefresh();var generation=refreshGeneration,currentFrame=frame,currentSource=frame.src,controller=new AbortController();refreshController=controller;
    var remaining=attemptDeadline-Date.now(),timeout=0,timedOut=false;
    try{
      if(remaining<=0)throw new Error("timeout");
      var previousUrl=new URL(currentSource),tokens=previousUrl.searchParams.getAll("token");
      if(tokens.length!==1||!tokens[0]||previousUrl.origin!==origin)throw new Error("identity");
      var pending=(async function(){
        var response=await fetch("/api/chat/renew",{method:"POST",credentials:"same-origin",redirect:"error",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({token:tokens[0]}),signal:controller.signal});
        if(!response.ok){var error=new Error("renewal");error.status=response.status;throw error}
        var data=await response.json(),url=new URL(data.chat_url),fresh=url.searchParams.getAll("token");
        if(url.origin!==previousUrl.origin||url.pathname!==previousUrl.pathname||url.username||url.password||url.hash||fresh.length!==1||!fresh[0])throw new Error("identity");
        return url.href;
      })();
      var refreshed=await Promise.race([pending,new Promise(function(_,reject){timeout=setTimeout(function(){timedOut=true;controller.abort();reject(new Error("timeout"))},Math.min(6000,remaining))})]);
      if(generation!==refreshGeneration||root.hidden||frame!==currentFrame||frame.src!==currentSource||entryReady)return;
      refreshController=null;start("connecting",true);frame.src=traceUrl(refreshed);
    }catch(error){
      if(generation!==refreshGeneration||root.hidden||frame!==currentFrame||entryReady)return;
      var details={error_stage:"chat_iframe",error_code:timedOut||error.message==="timeout"?"request_timeout":error.name==="TypeError"?"network_error":error.status===429?"rate_limited":"chat_unavailable"};
      if(Number.isInteger(error.status)&&error.status>=100&&error.status<=599)details.status=error.status;
      fail(message,details);
    }finally{clearTimeout(timeout);if(refreshController===controller)refreshController=null}
  }
  function reconnect(message){if(root.hidden||retryTimer||refreshController)return;if(!frame||automaticRetries>=1){fail(message);return}clearTimeout(timer);automaticRetries++;var currentFrame=frame,currentSource=frame.src;title.textContent="Estamos recuperando la conexión con tu asesor.";description.textContent="";retryTimer=setTimeout(function(){retryTimer=0;if(root.hidden||frame!==currentFrame||frame.src!==currentSource)return;refreshChat(message)},750)}
  function start(stage,recovering){
    clearTimeout(timer);clearTimeout(retryTimer);retryTimer=0;
    if(!recovering){automaticRetries=0;attemptDeadline=Date.now()+45000;cancelRefresh()}
    previous=document.activeElement;root.dataset.stage=stage;root.hidden=false;applyPalette();
    spinner.hidden=stage==="verifying"||stage==="connecting";spinner.dataset.phase=stage;actions.hidden=true;
    if(stage==="verifying"){
      title.textContent="";description.textContent="";
      timer=setTimeout(function(){description.textContent="Verificando tu cuenta…"},300);
    }else{
      title.textContent=stage==="preparing"?"Preparando tu acceso":stage==="creating"?"Creando tu cuenta":"Conectando con tu asesor…";
      description.textContent=stage==="connecting"?"":"Estamos preparando tu acceso.";
    }
    root.querySelectorAll("[data-entry-source]").forEach(function(el){el.srcset=el.dataset.srcset});
    root.querySelectorAll("[data-entry-logo]").forEach(function(el){el.src=el.dataset.src});
    root.focus({preventScroll:true});
    if(stage==="connecting")timer=setTimeout(function(){reconnect("La conexión está tardando más de lo esperado. Podés reintentar sin crear otra cuenta.")},Math.max(1,Math.min(20000,attemptDeadline-Date.now())))
  }
  root.querySelector("[data-entry-retry]").addEventListener("click",function(){if(frame){entryReady=false;start("connecting");clearTimeout(timer);refreshChat("No pudimos recuperar la conexión. Podés reintentar sin crear otra cuenta.")}else finish()});
  root.querySelector("[data-entry-continue]").addEventListener("click",function(){finish();if(frame)frame.focus()});
  root.addEventListener("keydown",function(event){if(event.key!=="Tab")return;var buttons=actions.hidden?[]:Array.from(actions.querySelectorAll("button"));if(!buttons.length){event.preventDefault();root.focus();return}if(event.shiftKey&&(document.activeElement===buttons[0]||document.activeElement===root)){event.preventDefault();buttons[buttons.length-1].focus()}else if(!event.shiftKey&&(document.activeElement===buttons[buttons.length-1]||document.activeElement===root)){event.preventDefault();buttons[0].focus()}});
  window.addEventListener("focusin",function(event){if(!root.hidden&&!root.contains(event.target))root.focus({preventScroll:true})});
  window.addEventListener("message",function(event){
    var data=event.data;
    if(!frame||event.source!==frame.contentWindow||event.origin!==origin||!data||data.source!=="atrio-widget")return;
    // The usable chat must become visible before its deferred welcome/wallet
    // work starts. Final entry readiness still owns diagnostics and app startup.
    if(data.type==="atrio.widget.ready"&&data.visibleEntry===true){finish();return}
    // Emitted only after the authorized, visible composer has painted. It is
    // independent of deferred welcome and bank data, unlike legacy chat_ready.
    if(data.type==="atrio.widget.usable"&&data.visibleEntry===true){
      if(spinner)spinner.dataset.phase="complete";
      milestone("chat_usable",Object.assign(chatDetails(data),{duration_ms:Math.max(0,Date.now()-frameBoundAt)}));return
    }
    if(data.type==="atrio.widget.entry-diagnostic"){
      // Render/load diagnostics can arrive after the usable composer and welcome.
      if(data.name==="stage_timing"){
        if(["chat_dns","chat_connect","chat_tls","chat_ttfb","chat_download","chat_navigation","chat_dom","chat_load","chat_fcp","chat_hydration","chat_visible_to_usable"].includes(data.phase)&&Number.isSafeInteger(data.duration_ms)&&data.duration_ms>=0&&data.duration_ms<=86400000)
          milestone("stage_timing",Object.assign(chatDetails(data),{phase:data.phase,duration_ms:data.duration_ms}));
        return
      }
      var details=chatDetails(data);
      if(Number.isSafeInteger(data.duration_ms)&&data.duration_ms>=0&&data.duration_ms<=86400000)details.duration_ms=data.duration_ms;else return;
      if(entryReady&&["chat_bootstrap_ready","welcome_ready","wallet_ready"].includes(data.name))return;
      if(["navigation_started","chat_bootstrap_ready","welcome_ready","wallet_ready","welcome_visible","wallet_visible"].includes(data.name)){milestone(data.name,details);return}
      if(data.name==="wallet_result"&&["available","not_applicable","unavailable","error"].includes(data.wallet_outcome)){details.wallet_outcome=data.wallet_outcome;milestone("wallet_result",details);return}
      if(data.name==="entry_error"&&["chat_bootstrap","welcome","wallet"].includes(data.error_stage)&&["chat_unavailable","request_timeout","network_error","rate_limited","session_unavailable","unknown"].includes(data.error_code)){
        details.error_stage=data.error_stage;details.error_code=data.error_code;
        if(Number.isInteger(data.status)&&data.status>=100&&data.status<=599)details.status=data.status;
        milestone("entry_error",details)
      }
      return
    }
    if(data.type!=="atrio.widget.entry-ready")return;
    if(!wallet||(data.walletReady===true&&data.walletRequestCompleted===true)||data.walletAvailable===false){
      milestone("chat_ready",Object.assign(chatDetails(data),{duration_ms:Math.max(0,Date.now()-frameBoundAt)}));entryReady=true;finish(true);return
    }
    if(data.walletRequestCompleted===true&&data.walletAvailable===true&&data.walletReady===false)reconnect("El chat está disponible, pero no pudimos obtener los datos para cargar. Podés reintentar o continuar al chat.")
  });
  return {start:start,finish:finish,fail:fail,traceUrl:traceUrl,bind:function(value,allowedOrigin,needsWallet){if(frame&&frameLoadHandler&&frame.removeEventListener)frame.removeEventListener("load",frameLoadHandler);frame=value;origin=allowedOrigin;wallet=needsWallet;entryReady=false;frameBoundAt=Date.now();var boundFrame=frame;frameLoadHandler=function(){if(frame===boundFrame)milestone("iframe_loaded",{duration_ms:Math.max(0,Date.now()-frameBoundAt)})};if(frame&&frame.addEventListener)frame.addEventListener("load",frameLoadHandler);milestone("gateway_loaded")}};
}
`;
