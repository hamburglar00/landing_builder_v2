type Props = {
  slug: string;
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

/** Starts advisor selection in <head>, in parallel with rendering and identity. */
export default function AtrioPrewarmScript({ slug }: Props) {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!baseUrl || !anonKey || !slug) return null;

  const endpoint = `${baseUrl.replace(/\/+$/, "")}/functions/v1/landing-atrio?name=${encodeURIComponent(slug)}`;
  const script = `
    (function () {
      try {
        var slug = ${escapeScriptJson(slug)};
        window.__PUBLIC_LANDING_ATRIO_PROMISES = window.__PUBLIC_LANDING_ATRIO_PROMISES || {};
        if (!window.__PUBLIC_LANDING_ATRIO_PROMISES[slug]) {
          window.__PUBLIC_LANDING_ATRIO_PROMISES[slug] = fetch(${escapeScriptJson(endpoint)}, {
            method: "GET",
            headers: {
              apikey: ${escapeScriptJson(anonKey)},
              Authorization: "Bearer " + ${escapeScriptJson(anonKey)}
            },
            cache: "no-store",
            keepalive: true
          }).then(function (response) {
            if (!response.ok) return null;
            return response.json();
          }).catch(function () { return null; });
        }
      } catch (e) {}
    })();
  `;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
