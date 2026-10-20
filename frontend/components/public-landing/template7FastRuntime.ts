import { buildPublicLandingRuntimeSource, buildRuntimeConfig } from "./PublicLandingRuntimeScript";
import type { PublicLandingConfig } from "./types";

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
  const settings = { ...buildRuntimeConfig({ slug, config }), socialProofItems: [], automaticLandingSelection: !!classicDeviceIdScript };
  const bootstrap = JSON.stringify(settings).replace(/[<>&\u2028\u2029]/g,
    value => `\\u${value.charCodeAt(0).toString(16).padStart(4, "0")}`);
  let source = buildPublicLandingRuntimeSource();
  {
    source = replaceOnce(source, '      function init() {', `
      function warmTemplate7Entry() {
        Promise.all([window.__LB_IDENTITY_READY__ || Promise.resolve(), ensureAtrioPromise()]).then(function (values) {
          var advisor = values[1];
          if (!advisor || (window.__LB_IDENTITY_READY__ && values[0] !== true)) return;
          return fetch('/api/template7/warm', {
            method: 'POST', credentials: 'same-origin', cache: 'no-store',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ landing_id: cfg.landingId, landing_slug: cfg.slug,
              atrio_client_id: advisor.atrioClientId || advisor.atrio_client_id,
              advisor_id: advisor.atrioId || advisor.atrio_id,
              advisor_slug: advisor.atrioSlug || advisor.atrio_slug })
          }).then(function (response) { return response.ok ? response.json() : null; }).then(function (result) {
            if (result && typeof result.handoff_url === 'string' && !window.__T7_ENTRY_STARTED__) {
              var restored = new URL(result.handoff_url);
              if (restored.protocol === 'https:' && restored.pathname === '/prepare' && restored.searchParams.has('t')) {
                window.__T7_ENTRY_STARTED__ = true;
                window.location.replace(restored.href);
                return;
              }
            }
            if (!result || !result.gateway_origin) return;
            var destination = new URL(result.gateway_origin);
            if (destination.protocol !== 'https:') return;
            var link = document.createElement('link'); link.rel = 'preconnect'; link.href = destination.origin;
            document.head.appendChild(link);
            return fetch(destination.origin + '/api/preparations/warm', { mode: 'no-cors', credentials: 'omit', cache: 'no-store' });
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
          else setTemplate7Error("No pudimos recuperar tu acceso. Intentá nuevamente.");
        }
      }
      if (!template7IdentityReady) window.__LB_IDENTITY_READY__.then(releaseTemplate7Identity, function () { releaseTemplate7Identity(false); });
      var clickLocked = false;`);
    source = replaceOnce(source, "      function handleCtaClick(button) {", `      function handleCtaClick(button) {
        window.__T7_ENTRY_STARTED__ = true;
        if (!template7IdentityReady) {
          if (!template7PendingIdentityClick) { template7PendingIdentityClick = button; button.disabled = true; }
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
    source = replaceOnce(source, "body: JSON.stringify({ landing_id: cfg.landingId, landing_slug: cfg.slug,",
      "body: JSON.stringify({ device_id: getOrCreateDeviceId(), landing_id: cfg.landingId, landing_slug: cfg.slug,");
    // React's document hydration root can stop early discrete events before
    // they reach native button listeners. Capture above that root; the existing
    // click lock and Contact deduplication still own submission.
    source = replaceOnce(source,
      '          button.addEventListener("click", function () { handleCtaClick(button); });',
      `          window.addEventListener("click", function (event) {
            if (event.target && event.target.nodeType && button.contains(event.target)) handleCtaClick(button);
          }, true);`,
    );
    source = replaceOnce(source, 'fetch("/api/template7/prepare", {', 'fetch("/api/template7/start", {');
    source = replaceOnce(source, "body: JSON.stringify({\n            landing_id: cfg.landingId,",
      "body: JSON.stringify({\n            device_id: getOrCreateDeviceId(),\n            landing_id: cfg.landingId,");
    source = replaceOnce(source, "      var clickLocked = false;", classicDeviceIdScript + "\n      var clickLocked = false;");
  }
  return `window.__PUBLIC_LANDING_RUNTIME_CONFIG__=${bootstrap};${source}`;
}
