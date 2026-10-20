/** The gateway checks its own HttpOnly cookie during a top-level navigation.
 * Cross-site fetch/iframes cannot reliably read a SameSite=Lax session. */
export function buildTemplate7ReentryScript(gatewayOrigin: string): string {
  let origin: string;
  try {
    const url = new URL(gatewayOrigin);
    if (url.protocol !== "https:" || url.username || url.password) return "";
    origin = url.origin;
  } catch { return ""; }
  const encoded = JSON.stringify(origin).replace(/</g, "\\u003c");
  const landingOrigins = ["https://mkt.panelbotadmin.com", "https://landing.panelbotadmin.com",
    ...(process.env.TEMPLATE7_LANDING_ORIGINS || "").split(",").map(value => value.trim()).filter(Boolean)];
  const allowed = JSON.stringify(landingOrigins).replace(/[<>&\u2028\u2029]/g,
    value => `\\u${value.charCodeAt(0).toString(16).padStart(4, "0")}`);
  return `<script data-template7-reentry>
    (function () {
      if (window.self !== window.top) return;
      try {
        var gateway = ${encoded};
        var url = new URL(window.location.href);
        if (${allowed}.indexOf(url.origin) === -1) return;
        if (!/^\\/(?:l\\/)?[a-z0-9][a-z0-9_-]{0,159}\\/?$/i.test(url.pathname) && url.pathname !== "/") return;
        var key = "template7:reentry:" + gateway;
        var stored = JSON.parse(window.sessionStorage.getItem(key) || "null");
        var returned = url.searchParams.get("__t7_resume");
        if (returned && stored && stored.nonce === returned && stored.expiresAt > Date.now()) {
          var original = new URL(stored.url);
          if (original.origin === url.origin && original.pathname === url.pathname) {
            window.sessionStorage.removeItem(key);
            window.history.replaceState(window.history.state, "", original.pathname + original.search + original.hash);
            return;
          }
        }
        // Keep attribution and form-prefill parameters on the landing's origin.
        // The gateway receives only the landing path and a random loop guard.
        url.searchParams.delete("__t7_resume");
        var nonce = window.crypto.randomUUID();
        window.sessionStorage.setItem(key, JSON.stringify({ nonce: nonce, url: url.href, expiresAt: Date.now() + 120000 }));
        var back = new URL(url.pathname, url.origin);
        back.searchParams.set("__t7_resume", nonce);
        var destination = new URL("/resume", gateway);
        destination.searchParams.set("return_to", back.href);
        window.__TEMPLATE7_REENTRY_PENDING__ = true;
        window.location.replace(destination.href);
      } catch (e) { window.__TEMPLATE7_REENTRY_PENDING__ = false; }
    })();
  </script>`;
}

/** A session check must not reserve another advisor, bootstrap identity, or
 * emit tracking while the browser is leaving for the gateway. */
export function guardTemplate7ReentryScripts(html: string): string {
  return html.replace(/<script>([\s\S]*?)<\/script>/g,
    (_, source: string) => `<script>if (!window.__TEMPLATE7_REENTRY_PENDING__) {${source}\n}</script>`);
}
