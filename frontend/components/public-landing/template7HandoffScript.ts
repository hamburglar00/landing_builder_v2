import { MULTI_SKIN_CODES } from "../../lib/multi-skin-catalog";

/** Helpers públicos: reciben solo el handoff temporal, nunca lb_cid. */
export function buildTemplate7HandoffRuntimeScript(): string {
  return `
    function template7WebviewKind(ua) {
      var text = String(ua || "");
      var inApp = /Instagram|FBAN|FBAV|FB_IAB|FB4A|Messenger|TikTok|Bytedance|Musical_ly/i.test(text);
      if (/Android/i.test(text) && (inApp || /(?:;|\\s)wv(?:;|\\))/i.test(text))) return "android";
      if (/iPhone|iPad|iPod/i.test(text) && inApp) return "ios";
      return "normal";
    }

    function template7CheckedHandoff(raw) {
      var url = new URL(String(raw || ""));
      if (url.protocol !== "https:" || url.username || url.password || url.hash ||
          (url.pathname !== "/prepare" && url.pathname !== "/start") ||
          url.searchParams.getAll("t").length !== 1 || !url.searchParams.get("t") || url.searchParams.get("t").length > 12000 ||
          url.searchParams.getAll("ef").length > 1 || (url.searchParams.has("ef") &&
          (!url.searchParams.get("ef") || url.searchParams.get("ef").length > 2003))) {
        throw new Error("invalid handoff");
      }
      if(url.pathname==="/prepare"&&url.searchParams.has("skin")&&(url.searchParams.getAll("skin").length!==1||
          ${JSON.stringify(MULTI_SKIN_CODES)}.indexOf(url.searchParams.get("skin"))===-1||
          (typeof cfg!=="undefined"&&cfg.targetProvider&&cfg.targetProvider!=="multi_skin")))throw new Error("invalid handoff skin");
      // Attribution is captured on the landing before this navigation. Future
      // advertising parameters must neither reject nor authorize an entry.
      var token=url.searchParams.get("t"),funnel=url.searchParams.get("ef"),skin=url.pathname==="/prepare"?url.searchParams.get("skin"):null;
      url.search="";url.searchParams.set("t",token);
      if(funnel)url.searchParams.set("ef",funnel);
      if(skin)url.searchParams.set("skin",skin);
      return url;
    }

    function template7HandoffIntent(raw) {
      var url = template7CheckedHandoff(raw);
      return "intent://" + url.host + url.pathname + url.search +
        "#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=" +
        encodeURIComponent(url.href) + ";end";
    }

    function navigateTemplate7Handoff(raw) {
      var url = template7CheckedHandoff(raw);
      try { window.localStorage.setItem("template7:gateway-visited:" + url.origin, String(Date.now())); } catch(e) {}
      // A Meta in-app browser can complete this same first-party navigation.
      // User-agent detection alone is not evidence of a failed entry.
      try { window.location.assign(url.href); return; }
      catch (error) { showTemplate7HandoffFallback(url.href); }
    }

    function showTemplate7HandoffFallback(raw) {
      var url = template7CheckedHandoff(raw);
      var kind = template7WebviewKind(navigator.userAgent);
      var panel = document.querySelector("[data-template7-handoff-panel]");
      if (!panel) {
        panel = document.createElement("div");
        panel.className = "template7__handoff-panel";
        panel.setAttribute("data-template7-handoff-panel", "");
        panel.setAttribute("role", "dialog");
        panel.setAttribute("aria-modal", "true");
        panel.innerHTML = '<div class="template7__handoff-card"><h2>Continuá con tu acceso</h2>' +
          '<p data-template7-handoff-help></p><a data-template7-handoff-open>Continuar</a>' +
          '<button type="button" data-template7-handoff-copy>Copiar enlace</button>' +
          '<small>El enlace es temporal y de un solo uso. Abrilo una sola vez.</small></div>';
        document.body.appendChild(panel);
      }
      var help = panel.querySelector("[data-template7-handoff-help]");
      var open = panel.querySelector("[data-template7-handoff-open]");
      var copy = panel.querySelector("[data-template7-handoff-copy]");
      if (kind === "android") {
        help.textContent = "No se pudo abrir tu acceso en este navegador. Podés continuar en Chrome con la misma cuenta.";
        open.textContent = "Abrir en Chrome";
        open.href = template7HandoffIntent(url.href);
      } else {
        help.textContent = "No se pudo abrir tu acceso. Intentá abrir el enlace o copialo para continuar en otro navegador con la misma cuenta.";
        open.textContent = "Abrir enlace";
        open.href = url.href;
        open.target = "_blank";
        open.rel = "noopener noreferrer";
      }
      copy.onclick = function () {
        if (!navigator.clipboard || !navigator.clipboard.writeText) return;
        navigator.clipboard.writeText(url.href).then(function () {
          copy.textContent = "Enlace copiado";
        }).catch(function () { copy.textContent = "No se pudo copiar"; });
      };
      open.focus();
    }
  `;
}
