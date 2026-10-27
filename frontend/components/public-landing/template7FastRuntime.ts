import { buildPublicLandingRuntimeSource, buildRuntimeConfig } from "./PublicLandingRuntimeScript";
import type { PublicLandingConfig } from "./types";
import { GATEWAY_ENTRY_TRANSITION_RUNTIME, GATEWAY_ENTRY_BRANDS } from "../../lib/gateway-entry-transition";
import { gatewayOriginFor } from "../../lib/reyDeAses/gatewayOrigins";
import { adaptTemplate8Runtime } from "./template8Runtime";

function replaceOnce(source: string, from: string, to: string): string {
  if (source.split(from).length !== 2) throw new Error("Template 7 runtime contract changed");
  return source.replace(from, to);
}

/** Reuses the proven tracking implementation; no second Contact/Pixel pipeline. */
export function buildTemplate7FastRuntime(
  slug: string,
  config: PublicLandingConfig,
  classicDeviceIdScript = "",
): string {
  const isTemplate8 = config.layout?.template === 8;
  const settings = { ...buildRuntimeConfig({ slug, config }), socialProofItems: [], automaticLandingSelection: !!classicDeviceIdScript,
    ...(isTemplate8 ? { template: 7, template8: true, ctaDestination: "atrio", targetProvider: "", cardIndex: null,
      template8Cards: (config.content?.template8?.cards || []).map((card, i) => {
        const gatewayOrigin = gatewayOriginFor(card.targetProvider, "ganamos_plus") || "";
        return { ...card, index: i + 1, gatewayOrigin, transitionLogo: gatewayOrigin + GATEWAY_ENTRY_BRANDS[card.targetProvider].logo.replace(/\.avif$/, ".webp") };
      }) } : {}),
  };
  const bootstrap = JSON.stringify(settings).replace(/[<>&\u2028\u2029]/g,
    value => `\\u${value.charCodeAt(0).toString(16).padStart(4, "0")}`);
  let source = buildPublicLandingRuntimeSource();
  source = replaceOnce(source, "      function failTemplate7(button) {", `${GATEWAY_ENTRY_TRANSITION_RUNTIME}
      var template7Transition = createGatewayEntryTransition(document.getElementById("gateway-entry-transition"));
      function template7TransitionUrl(raw) {
        var url = template7CheckedHandoff(raw);
        if (url.pathname === "/start") url.pathname = "/prepare";
        return url.href;
      }
      function failTemplate7(button) {
        if (template7Transition) template7Transition.finish();`);
  source = replaceOnce(source, '        if (cfg.template === 7) setTemplate7Error("");', '        if (cfg.template === 7) { setTemplate7Error(""); if (template7Transition) template7Transition.start("creating"); }');
  source = replaceOnce(source, "        setButtonText(button, getLoadingButtonText(button));", "        if (cfg.template !== 7) setButtonText(button, getLoadingButtonText(button));");
  source = replaceOnce(source, "           return data.handoff_url;".trimStart(), "return template7TransitionUrl(data.handoff_url);");
  source = replaceOnce(source, '      var panel = document.querySelector("[data-template7-handoff-panel]");', '      if (template7Transition) template7Transition.finish();\n      var panel = document.querySelector("[data-template7-handoff-panel]");');
  const selectionStart = source.indexOf("      function ensureAtrioPromise() {");
  const selectionEnd = source.indexOf("      function clearPrewarmedAtrioPromise() {", selectionStart);
  if (selectionStart < 0 || selectionEnd < 0) throw new Error("Template 7 destination selection changed");
  source = source.slice(0, selectionStart) + `
      function ensureAtrioPromise() {
        window.__PUBLIC_LANDING_ATRIO_PROMISES = window.__PUBLIC_LANDING_ATRIO_PROMISES || {};
        var existing = window.__PUBLIC_LANDING_ATRIO_PROMISES[cfg.slug];
        if (existing) return observeTemplate7Destination(existing);
        var promise = Promise.resolve(window.__LB_IDENTITY_READY__ || true).then(function (ready) {
          if (ready !== true) return null;
          return fetch("/api/template7/destination", {
            method: "POST", credentials: "same-origin", cache: "no-store", keepalive: true,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ landing_id: cfg.landingId, landing_slug: cfg.slug${classicDeviceIdScript ? ", device_id: getOrCreateDeviceId()" : ""} })
          }).then(function (response) { return response.ok ? response.json() : null; });
        }).catch(function () { return null; });
        window.__PUBLIC_LANDING_ATRIO_PROMISES[cfg.slug] = promise;
        return observeTemplate7Destination(promise);
      }

      function observeTemplate7Destination(promise) {
        window.__T7_DESTINATION_STATES__ = window.__T7_DESTINATION_STATES__ || {};
        var states = window.__T7_DESTINATION_STATES__;
        if (!states[cfg.slug] || states[cfg.slug].promise !== promise) {
          var state = { promise: promise, settled: false, value: null };
          states[cfg.slug] = state;
          promise.then(function(value) { state.settled = true; state.value = value; }, function() { state.settled = true; });
        }
        return promise;
      }

` + source.slice(selectionEnd);
  source = replaceOnce(source, "      function clearPrewarmedAtrioPromise() {", `      function clearPrewarmedAtrioPromise() {
        var state = window.__T7_DESTINATION_STATES__ && window.__T7_DESTINATION_STATES__[cfg.slug];
        if (state && (!state.settled || (state.value && (state.value.atrioClientId || state.value.atrio_client_id) &&
            (state.value.atrioId || state.value.atrio_id) && (state.value.atrioSlug || state.value.atrio_slug)))) return;`);
  {
    source = replaceOnce(source, '      function init() {', `
      function warmTemplate7Entry() {
        Promise.all([window.__LB_IDENTITY_READY__ || Promise.resolve(), ensureAtrioPromise()]).then(function (values) {
          var advisor = values[1];
          if (!advisor || (window.__LB_IDENTITY_READY__ && values[0] !== true)) return;
          if (advisor.preparationReady) {
            if (!advisor.existingName || !advisor.promoCode || window.__T7_ENTRY_STARTED__) return;
            return fetch('${classicDeviceIdScript ? "/api/template7/start" : "/api/template7/prepare"}', {
              method: 'POST', credentials: 'same-origin', cache: 'no-store',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ${classicDeviceIdScript ? "device_id: getOrCreateDeviceId(), " : ""}landing_id: cfg.landingId, landing_slug: cfg.slug,
                atrio_client_id: advisor.atrioClientId, advisor_id: advisor.atrioId, advisor_slug: advisor.atrioSlug,
                name: advisor.existingName, promo_code: advisor.promoCode,
                attribution: { target_provider: cfg.targetProvider } })
            }).then(function(response) { return response.ok ? response.json() : null; }).then(function(result) {
              if (!result || typeof result.handoff_url !== 'string' || window.__T7_ENTRY_STARTED__) return;
              var restored = new URL(result.handoff_url);
              if (restored.protocol !== 'https:' || !restored.searchParams.has('t')) return;
              window.__T7_ENTRY_STARTED__ = true;
              window.location.replace(template7TransitionUrl(restored.href));
            });
          }
          return fetch('/api/template7/warm', {
            method: 'POST', credentials: 'same-origin', cache: 'no-store',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ${classicDeviceIdScript ? "device_id: getOrCreateDeviceId(), " : ""}landing_id: cfg.landingId, landing_slug: cfg.slug,
              atrio_client_id: advisor.atrioClientId || advisor.atrio_client_id,
              advisor_id: advisor.atrioId || advisor.atrio_id,
              advisor_slug: advisor.atrioSlug || advisor.atrio_slug })
          }).then(function (response) { return response.ok ? response.json() : null; }).then(function (result) {
            if (result && typeof result.handoff_url === 'string' && !window.__T7_ENTRY_STARTED__) {
              var restored = new URL(result.handoff_url);
              if (restored.protocol === 'https:' && restored.pathname === '/prepare' && restored.searchParams.has('t')) {
                window.__T7_ENTRY_STARTED__ = true;
                window.location.replace(template7TransitionUrl(restored.href));
                return;
              }
            }
            if (!result || !result.gateway_origin) return;
            var destination = new URL(result.gateway_origin);
            if (destination.protocol !== 'https:') return;
            var link = document.createElement('link'); link.rel = 'preconnect'; link.href = destination.origin;
            document.head.appendChild(link);
            window.__T7_GATEWAY_WARM__ = window.__T7_GATEWAY_WARM__ || {};
            if (!window.__T7_GATEWAY_WARM__[destination.origin]) window.__T7_GATEWAY_WARM__[destination.origin] = fetch(destination.origin + '/api/preparations/warm', { mode: 'no-cors', credentials: 'omit', cache: 'no-store' }).catch(function () {});
            return window.__T7_GATEWAY_WARM__[destination.origin];
          });
        }).catch(function () {});
      }
      function init() {
        warmTemplate7Entry();`);
  }
  if (!classicDeviceIdScript) {
    // A very early click must not race the HttpOnly identity bootstrap. The
    // visitor can type immediately; only submission waits for the existing promise.
    source = replaceOnce(source, "      var clickLocked = false;", `
      var template7IdentityReady = !window.__LB_IDENTITY_READY__;
      var template7IdentityWaiting = !!window.__LB_IDENTITY_READY__;
      var template7PendingIdentityClick = null;
      function releaseTemplate7Identity(ok) {
        template7IdentityWaiting = false;
        template7IdentityReady = ok === true;
        if (template7PendingIdentityClick) {
          var pending = template7PendingIdentityClick;
          template7PendingIdentityClick = null;
          pending.disabled = false;
          if (template7IdentityReady) handleCtaClick(pending);
          else { if (template7Transition) template7Transition.finish(); setTemplate7Error("No pudimos recuperar tu acceso. Intentá nuevamente."); }
        }
      }
      if (!template7IdentityReady) window.__LB_IDENTITY_READY__.then(releaseTemplate7Identity, function () { releaseTemplate7Identity(false); });
      var clickLocked = false;`);
    source = replaceOnce(source, "      function handleCtaClick(button) {", `      function handleCtaClick(button) {
        window.__T7_ENTRY_STARTED__ = true;
        if (!template7IdentityReady) {
          if (!template7PendingIdentityClick) { template7PendingIdentityClick = button; button.disabled = true; if (template7Transition) template7Transition.start("preparing"); }
          if (!template7IdentityWaiting && window.__LB_BOOTSTRAP_IDENTITY__) {
            template7IdentityWaiting = true;
            window.__LB_BOOTSTRAP_IDENTITY__().then(releaseTemplate7Identity, function () { releaseTemplate7Identity(false); });
          }
          return;
        }`);
  }
  // These functions only decorate templates 2/4/5. Leave attribution, identity,
  // phone normalization, retry and deduplication byte-for-byte unchanged.
  const decorationStart = source.indexOf("      function initSocialProof() {");
  const warmStart = source.indexOf("      function warmTemplate7Entry() {", decorationStart);
  const decorationEnd = warmStart >= 0 ? warmStart : source.indexOf("      function init() {", decorationStart);
  if (decorationStart < 0 || decorationEnd < 0) throw new Error("Template 7 decorations changed");
  source = source.slice(0, decorationStart) + source.slice(decorationEnd);
  for (const call of ["        initSocialProof();", "        initTemplate4LiveDetails();", "        initTemplate5LiveDetails();"]) {
    source = replaceOnce(source, call, "");
  }
  source = replaceOnce(source,
    '      if (document.readyState === "loading") {\n        document.addEventListener("DOMContentLoaded", init, { once: true });\n      } else {\n        init();\n      }',
    // Placed after the form: do not wait for unrelated deferred scripts/hydration.
    "      init();",
  );
  if (classicDeviceIdScript) {
    // React's document hydration root can stop early discrete events before
    // they reach native button listeners. Capture above that root; the existing
    // click lock and Contact deduplication still own submission.
    source = replaceOnce(source,
      '          button.addEventListener("click", function () { handleCtaClick(button); });',
      `          window.addEventListener("click", function (event) {
            if (event.target && event.target.nodeType && button.contains(event.target)) handleCtaClick(button);
          }, true);`,
    );
    source = replaceOnce(source, 'fetchWithEntryRecovery("/api/template7/prepare", {', 'fetchWithEntryRecovery("/api/template7/start", {');
    source = replaceOnce(source, "body: JSON.stringify({\n            landing_id: cfg.landingId,",
      "body: JSON.stringify({\n            device_id: getOrCreateDeviceId(),\n            landing_id: cfg.landingId,");
    source = replaceOnce(source, "      var clickLocked = false;", classicDeviceIdScript + "\n      var clickLocked = false;");
  }
  source = replaceOnce(source, "      function handleCtaClick(button) {", `      function handleCtaClick(button) {
        if (clickLocked || button.disabled) return;
        var entryName = document.querySelector("[data-template7-name]");
        if (!entryName || !String(entryName.value || "").trim()) return;
        window.__T7_ENTRY_STARTED__ = true;`);
  if (isTemplate8) source = adaptTemplate8Runtime(source, !!classicDeviceIdScript);
  return `window.__PUBLIC_LANDING_RUNTIME_CONFIG__=${bootstrap};${source}`;
}
