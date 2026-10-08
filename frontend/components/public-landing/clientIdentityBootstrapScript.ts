/** Se ejecuta solo en Template 7, antes del Pixel y del runtime principal. */
export function buildClientIdentityBootstrapScript(): string {
  return `<script>
    window.__LB_IDENTITY_READY__ = (function () {
      var controller = typeof AbortController === "function" ? new AbortController() : null;
      var timer;
      var timeout = new Promise(function (resolve) {
        timer = window.setTimeout(function () { if (controller) controller.abort(); resolve(false); }, 2500);
      });
      var request = fetch("/api/client-identity/bootstrap", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        signal: controller ? controller.signal : undefined
      }).then(function (response) { return !!(response && response.ok); })
        .catch(function () { return false; });
      return Promise.race([request, timeout])
        .finally(function () { window.clearTimeout(timer); });
    })();
  </script>`;
}
