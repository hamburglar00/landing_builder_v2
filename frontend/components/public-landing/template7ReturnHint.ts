// This timestamp only chooses the first paint. The existing destination request
// decides whether there is an account, an advisor and a valid preparation.
export const TEMPLATE7_RETURN_HINT_SCRIPT = `
(function(){
  var cfg=window.__PUBLIC_LANDING_RUNTIME_CONFIG__;
  if(!cfg.creationScreen || !cfg.landingId || window.self !== window.top || window.__TEMPLATE7_REENTRY_PENDING__)return;
  var key="template7:return-view:"+JSON.stringify([cfg.landingId,cfg.slug,cfg.targetProvider,cfg.skinCode,cfg.atrioClientId,cfg.atrioId]);
  window.__T7_REMEMBER_RETURN_VIEW__=function(){
    try{localStorage.setItem(key,String(Date.now()))}catch(_){}
  };
  try{
    var seen=Number(localStorage.getItem(key)),now=Date.now();
    if(!seen || seen>now || now-seen>31536000000)return;
    localStorage.removeItem(key);
  }catch(_){return}
  var page=document.documentElement,overlay=null,delayed=false;
  page.setAttribute("data-t7-return-check","");
  function paint(){
    overlay=document.getElementById("gateway-entry-transition");
    if(!overlay)return;
    overlay.dataset.stage="verifying";
    overlay.querySelector("[data-entry-title]").textContent="";
    overlay.querySelector("[data-entry-description]").textContent=delayed?"Verificando tu cuenta…":"";
    overlay.querySelector("[data-entry-progress]").hidden=true;
    overlay.querySelectorAll("[data-entry-source]").forEach(function(el){el.srcset=el.dataset.srcset});
    overlay.querySelectorAll("[data-entry-logo]").forEach(function(el){el.src=el.dataset.src});
    overlay.hidden=false;
  }
  function dismiss(){
    clearTimeout(messageTimer);clearTimeout(expiry);
    if(overlay)overlay.hidden=true;
    page.removeAttribute("data-t7-return-check");
    window.__T7_RETURN_CHECK__=null;
  }
  var messageTimer=setTimeout(function(){delayed=true;if(overlay)overlay.querySelector("[data-entry-description]").textContent="Verificando tu cuenta…"},300);
  // Release the form even if the versioned runtime or its request never arrives.
  var expiry=setTimeout(dismiss,4000);
  window.__T7_RETURN_CHECK__={paint:paint,dismiss:dismiss,claim:function(){clearTimeout(expiry)}};
  window.addEventListener("pageshow",function(event){if(event.persisted && window.__T7_RETURN_CHECK__)dismiss()});
})();
`;

export const TEMPLATE7_RETURN_HINT_STYLE = '<style>html[data-t7-return-check] body{visibility:hidden}html[data-t7-return-check] #gateway-entry-transition{visibility:visible}</style>';
