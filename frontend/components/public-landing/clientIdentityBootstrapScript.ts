/** Se ejecuta solo en Template 7, antes del Pixel y del runtime principal. */
export function buildClientIdentityBootstrapScript(): string {
  return `<script>
    window.__LB_BOOTSTRAP_IDENTITY__ = function () {
      var controller = typeof AbortController === "function" ? new AbortController() : null;
      var timer;
      var timeout = new Promise(function (resolve) {
        timer = window.setTimeout(function () { if (controller) controller.abort(); resolve(false); }, 5000);
      });
      var saved = ""; try { saved = localStorage.getItem("template7:identity-recovery:v1") || ""; } catch (e) {}
      var request = fetch("/api/client-identity/bootstrap", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recovery_token: saved || null }),
        signal: controller ? controller.signal : undefined
      }).then(function (response) { return response && response.ok ? response.json() : null; })
        .then(function (data) { if (!data || !data.ok) return false; if (typeof data.recovery_token === "string") { try { localStorage.setItem("template7:identity-recovery:v1", data.recovery_token); } catch(e) {} } return fetch("/api/client-identity/bootstrap",{method:"POST",credentials:"same-origin",cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify({verify:true}),signal:controller?controller.signal:undefined}).then(function(r){return r.ok}); })
        .catch(function () { return false; });
      return Promise.race([request, timeout])
        .finally(function () { window.clearTimeout(timer); });
    };
    window.__LB_IDENTITY_READY__ = window.__LB_BOOTSTRAP_IDENTITY__();
  </script>`;
}
