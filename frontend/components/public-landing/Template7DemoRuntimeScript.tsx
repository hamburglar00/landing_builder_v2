import type { PublicLandingConfig } from "./types";
import { buildTemplate7HandoffRuntimeScript } from "./template7HandoffScript";

function escapeScriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (character) => ({
    "<": "\\u003c", ">": "\\u003e", "&": "\\u0026", "\u2028": "\\u2028", "\u2029": "\\u2029",
  })[character] || character);
}

/** Solo para /testing: comparte renderer/CSS, pero no incluye código de tracking. */
export default function Template7DemoRuntimeScript({ slug, config }: { slug: string; config: PublicLandingConfig }) {
  const runtime = {
    slug, landingId: config.id, landingTag: config.tracking?.landingTag || "LP",
    targetProvider: config.tracking?.target_provider || "rey_de_ases",
    skinCode: config.tracking?.skin_code || "",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  };
  const script = `
    (function () {
      var cfg = ${escapeScriptJson(runtime)};
      var clickLocked = false;
      var promoCode = null;
      var retryTimer = null;
      var advisorPromise = null;
      ${buildTemplate7HandoffRuntimeScript()}

      function firstNonEmpty(values) {
        for (var i = 0; i < values.length; i++) {
          var value = String(values[i] || "").trim();
          if (value) return value;
        }
        return "";
      }

      function setError(message) {
        var node = document.querySelector("[data-template7-error]");
        if (node) { node.textContent = message || ""; node.hidden = !message; }
      }

      function buttonLabel(button, loading) {
        var node = button.querySelector("[data-public-landing-cta-label]");
        if (node) node.textContent = button.getAttribute(loading ? "data-public-landing-loading-label" : "data-public-landing-rest-label") || "Continuar";
      }

      function fail(button) {
        if (retryTimer) window.clearTimeout(retryTimer);
        buttonLabel(button, false);
        setError("No pudimos abrir tu cuenta ahora. Podés reintentar en 45 segundos.");
        retryTimer = window.setTimeout(function () {
          retryTimer = null;
          clickLocked = false;
          var input = document.querySelector("[data-template7-name]");
          button.disabled = !input || !String(input.value || "").trim();
          setError("Podés volver a intentar.");
        }, 45000);
      }

      function advisor() {
        if (advisorPromise) return advisorPromise;
        var prewarmed = window.__PUBLIC_LANDING_ATRIO_PROMISES && window.__PUBLIC_LANDING_ATRIO_PROMISES[cfg.slug];
        if (prewarmed) {
          advisorPromise = prewarmed.then(function (data) {
            if (!data) throw new Error("advisor unavailable");
            return data;
          }).catch(function (error) { advisorPromise = null; throw error; });
          return advisorPromise;
        }
        if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) return Promise.reject(new Error("advisor unavailable"));
        var url = cfg.supabaseUrl.replace(/\\/+$/, "") + "/functions/v1/landing-atrio?name=" + encodeURIComponent(cfg.slug);
        advisorPromise = fetch(url, {
          headers: { apikey: cfg.supabaseAnonKey, Authorization: "Bearer " + cfg.supabaseAnonKey },
          cache: "no-store"
        }).then(function (response) {
          if (!response.ok) throw new Error("advisor unavailable");
          return response.json();
        }).catch(function (error) { advisorPromise = null; throw error; });
        return advisorPromise;
      }

      function start(name, data) {
        var atrioClientId = firstNonEmpty([data.atrioClientId, data.atrio_client_id]);
        var advisorId = firstNonEmpty([data.atrioId, data.atrio_id]);
        var advisorSlug = firstNonEmpty([data.atrioSlug, data.atrio_slug]);
        if (!atrioClientId || !advisorId || !advisorSlug) throw new Error("advisor unavailable");
        var controller = new AbortController();
        var timer = window.setTimeout(function () { controller.abort(); }, 18000);
        return fetch("/api/template7/prepare", {
          method: "POST", credentials: "same-origin", cache: "no-store",
          headers: { "Content-Type": "application/json", "X-Template7-Demo-Context": "testing" },
          signal: controller.signal,
          body: JSON.stringify({
            landing_id: cfg.landingId, landing_slug: cfg.slug, name: name,
            atrio_client_id: atrioClientId, advisor_id: advisorId, advisor_slug: advisorSlug,
            promo_code: promoCode,
            attribution: Object.assign(
              { target_provider: cfg.targetProvider },
              cfg.targetProvider === "multi_skin" && cfg.skinCode ? { skin_code: cfg.skinCode } : {}
            )
          })
        }).then(function (response) {
          if (!response.ok) throw new Error("start unavailable");
          return response.json();
        }).then(function (body) {
          if (!body || typeof body.handoff_url !== "string") throw new Error("handoff unavailable");
          return body.handoff_url;
        }).finally(function () { window.clearTimeout(timer); });
      }

      function handleClick(button, input) {
        if (clickLocked || button.disabled) return;
        var name = String(input.value || "").trim();
        if (!name) { button.disabled = true; input.focus(); return; }
        clickLocked = true;
        button.disabled = true;
        setError("");
        buttonLabel(button, true);
        if (!promoCode) promoCode = String(cfg.landingTag || "LP") + "-" + Math.random().toString(16).slice(2, 14);
        advisor().then(function (data) {
          return start(name, data);
        }).then(navigateTemplate7Handoff).catch(function () { fail(button); });
      }

      function init() {
        var input = document.querySelector("[data-template7-name]");
        var button = document.querySelector(".template7__cta[data-public-landing-cta]");
        var form = document.querySelector("[data-template7-form]");
        if (!input || !button || !form) return;
        function sync() { if (!clickLocked) button.disabled = !String(input.value || "").trim(); }
        input.addEventListener("input", sync);
        button.addEventListener("click", function () { handleClick(button, input); });
        form.addEventListener("submit", function (event) { event.preventDefault(); sync(); if (!button.disabled) handleClick(button, input); });
        window.addEventListener("pageshow", sync);
        advisor().catch(function () {});
        sync();

        var privacy = document.querySelector("[data-public-privacy-dialog]");
        var privacyOpen = document.querySelector("[data-public-privacy-open]");
        if (privacy && privacyOpen) {
          privacyOpen.addEventListener("click", function () { if (privacy.showModal) privacy.showModal(); else privacy.setAttribute("open", ""); });
          Array.prototype.slice.call(privacy.querySelectorAll("[data-public-privacy-close]")).forEach(function (close) {
            close.addEventListener("click", function () { if (privacy.close) privacy.close(); else privacy.removeAttribute("open"); });
          });
        }

        Array.prototype.slice.call(document.querySelectorAll("[data-public-landing-rotating-image]")).forEach(function (image) {
          try {
            var images = JSON.parse(image.getAttribute("data-public-landing-images") || "[]");
            if (!Array.isArray(images) || images.length < 2) return;
            var hours = Math.max(1, Number(image.getAttribute("data-public-landing-rotate-hours")) || 24);
            var index = Math.floor(Date.now() / (hours * 3600000)) % images.length;
            image.setAttribute("src", images[index]);
            window.setInterval(function () { index = (index + 1) % images.length; image.setAttribute("src", images[index]); }, hours * 3600000);
          } catch (e) {}
        });
      }
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
      else init();
    })();
  `;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
