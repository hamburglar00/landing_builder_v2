type Props = {
  slug: string;
  landingId: string;
  deviceIdScript?: string;
};

function escapeScriptJson(value: unknown) {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (character) => ({
    "<": "\\u003c",
    ">": "\\u003e",
    "&": "\\u0026",
    "\u2028": "\\u2028",
    "\u2029": "\\u2029",
  })[character] || character);
}

/** Starts persisted destination selection after identity, while the form renders. */
export default function AtrioPrewarmScript({ slug, landingId, deviceIdScript = "" }: Props) {
  if (!slug || !landingId) return null;
  const script = `
    (function () {
      try {
        ${deviceIdScript}
        var slug = ${escapeScriptJson(slug)};
        window.__PUBLIC_LANDING_ATRIO_PROMISES = window.__PUBLIC_LANDING_ATRIO_PROMISES || {};
        if (!window.__PUBLIC_LANDING_ATRIO_PROMISES[slug]) {
          window.__PUBLIC_LANDING_ATRIO_PROMISES[slug] = Promise.resolve(window.__LB_IDENTITY_READY__ || true).then(function (ready) {
            if (ready !== true) return null;
            return fetch("/api/template7/destination", {
            method: "POST", credentials: "same-origin",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ landing_id: ${escapeScriptJson(landingId)}, landing_slug: slug${deviceIdScript ? ", device_id: getOrCreateDeviceId()" : ""} }),
            cache: "no-store",
            keepalive: true
          }).then(function (response) {
            if (!response.ok) return null;
            return response.json();
          }); }).catch(function () { return null; });
        }
      } catch (e) {}
    })();
  `;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
