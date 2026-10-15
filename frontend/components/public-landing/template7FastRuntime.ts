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
  const settings = { ...buildRuntimeConfig({ slug, config }), socialProofItems: [] };
  const bootstrap = JSON.stringify(settings).replace(/[<>&\u2028\u2029]/g,
    value => `\\u${value.charCodeAt(0).toString(16).padStart(4, "0")}`);
  let source = buildPublicLandingRuntimeSource();
  if (!classicDeviceIdScript) {
    // A very early click must not race the HttpOnly identity bootstrap. The
    // visitor can type immediately; only submission waits for the existing promise.
    source = replaceOnce(source, "      var clickLocked = false;", `
      var template7IdentityReady = !window.__LB_IDENTITY_READY__;
      var template7PendingIdentityClick = null;
      function releaseTemplate7Identity() {
        template7IdentityReady = true;
        if (template7PendingIdentityClick) {
          var pending = template7PendingIdentityClick;
          template7PendingIdentityClick = null;
          pending.disabled = false;
          handleCtaClick(pending);
        }
      }
      if (!template7IdentityReady) window.__LB_IDENTITY_READY__.then(releaseTemplate7Identity, releaseTemplate7Identity);
      var clickLocked = false;`);
    source = replaceOnce(source, "      function handleCtaClick(button) {", `      function handleCtaClick(button) {
        if (!template7IdentityReady) {
          if (!template7PendingIdentityClick) { template7PendingIdentityClick = button; button.disabled = true; }
          return;
        }`);
  }
  // These functions only decorate templates 2/4/5. Leave attribution, identity,
  // phone normalization, retry and deduplication byte-for-byte unchanged.
  const decorationStart = source.indexOf("      function initSocialProof() {");
  const decorationEnd = source.indexOf("      function init() {", decorationStart);
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
    source = replaceOnce(source, 'fetch("/api/template7/prepare", {', 'fetch("/api/template7/start", {');
    source = replaceOnce(source, "body: JSON.stringify({\n            landing_id: cfg.landingId,",
      "body: JSON.stringify({\n            device_id: getOrCreateDeviceId(),\n            landing_id: cfg.landingId,");
    source = replaceOnce(source, "      var clickLocked = false;", classicDeviceIdScript + "\n      var clickLocked = false;");
  }
  return `window.__PUBLIC_LANDING_RUNTIME_CONFIG__=${bootstrap};${source}`;
}
