import { buildTemplate7BoundedRequestScript } from './template7BoundedRequest';
type Destination = { landingId: string; slug: string };

/** Se ejecuta solo en Template 7, antes del Pixel y del runtime principal.
 * Destination selection already requires the newly stored HttpOnly cookie, so
 * it can verify persistence and prepare the manager in the same round trip. */
export function buildClientIdentityBootstrapScript(destination?: Destination): string {
  const destinationConfig = destination
    ? JSON.stringify(destination).replace(/[<>&\u2028\u2029]/g, value =>
      `\\u${value.charCodeAt(0).toString(16).padStart(4, "0")}`)
    : "null";
  return `<script>
    ${buildTemplate7BoundedRequestScript()}
    window.__LB_BOOTSTRAP_IDENTITY__ = function () {
      if (window.__LB_IDENTITY_INFLIGHT__) return window.__LB_IDENTITY_INFLIGHT__;
      var destination = ${destinationConfig};
      var saved = ""; try { saved = localStorage.getItem("template7:identity-recovery:v1") || ""; } catch (e) {}
      var request = window.__T7_FETCH_JSON__("/api/client-identity/bootstrap", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recovery_token: saved || null })
      }, 5000)
        .then(function (data) {
          if (!data || !data.ok) return false;
          if (typeof data.recovery_token === "string") {
            try { localStorage.setItem("template7:identity-recovery:v1", data.recovery_token); } catch(e) {}
          }
          if (destination) {
            return window.__T7_FETCH_JSON__("/api/template7/destination", {
              method: "POST", credentials: "same-origin", cache: "no-store",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ landing_id: destination.landingId, landing_slug: destination.slug })
            }, 12000);
          }
          return window.__T7_FETCH_JSON__("/api/client-identity/bootstrap",{method:"POST",credentials:"same-origin",cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify({verify:true})},5000).then(function(data){return !!(data && data.ok)});
        })
        .catch(function () { return false; });
      if (destination) {
        window.__PUBLIC_LANDING_ATRIO_PROMISES = window.__PUBLIC_LANDING_ATRIO_PROMISES || {};
        window.__PUBLIC_LANDING_ATRIO_PROMISES[destination.slug] = request.then(function (data) {
          return data && (data.atrioClientId || data.atrio_client_id) &&
            (data.atrioId || data.atrio_id) && (data.atrioSlug || data.atrio_slug) ? data : null;
        });
        request = window.__PUBLIC_LANDING_ATRIO_PROMISES[destination.slug].then(function (data) { return !!data; });
      }
      var ready = request.finally(function () { if (window.__LB_IDENTITY_INFLIGHT__ === ready) window.__LB_IDENTITY_INFLIGHT__ = null; });
      window.__LB_IDENTITY_INFLIGHT__ = ready;
      window.__LB_IDENTITY_READY__ = ready;
      return ready;
    };
    window.__LB_IDENTITY_READY__ = window.__LB_BOOTSTRAP_IDENTITY__();
  </script>`;
}
