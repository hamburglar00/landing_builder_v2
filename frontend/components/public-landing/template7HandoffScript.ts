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
          url.pathname !== "/start" || url.searchParams.size !== 1 ||
          url.searchParams.getAll("t").length !== 1 || !url.searchParams.get("t")) {
        throw new Error("invalid handoff");
      }
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
      var kind = template7WebviewKind(navigator.userAgent);
      if (kind === "normal") { window.location.assign(url.href); return; }
      var panel = document.querySelector("[data-template7-handoff-panel]");
      if (!panel) {
        panel = document.createElement("div");
        panel.className = "template7__handoff-panel";
        panel.setAttribute("data-template7-handoff-panel", "");
        panel.setAttribute("role", "dialog");
        panel.setAttribute("aria-modal", "true");
        panel.innerHTML = '<div class="template7__handoff-card"><h2>Tu cuenta está lista</h2>' +
          '<p data-template7-handoff-help></p><a data-template7-handoff-open>Continuar</a>' +
          '<button type="button" data-template7-handoff-copy>Copiar enlace</button>' +
          '<small>El enlace es temporal y de un solo uso. Abrilo una sola vez.</small></div>';
        document.body.appendChild(panel);
      }
      var help = panel.querySelector("[data-template7-handoff-help]");
      var open = panel.querySelector("[data-template7-handoff-open]");
      var copy = panel.querySelector("[data-template7-handoff-copy]");
      if (kind === "android") {
        help.textContent = "Estás en un navegador interno. Tocá para abrir en Chrome y continuar con tu cuenta.";
        open.textContent = "Abrir en Chrome";
        open.href = template7HandoffIntent(url.href);
      } else {
        help.textContent = "Estás en un navegador interno. Abrí este enlace en Safari desde el menú de la app, o copialo y pegalo en Safari.";
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
