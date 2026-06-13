type Props = {
  slug: string;
};

function escapeScriptJson(value: string) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export default function PhonePrewarmScript({ slug }: Props) {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!baseUrl || !anonKey || !slug) return null;

  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  const endpoint = `${normalizedBaseUrl}/functions/v1/landing-phone?name=${encodeURIComponent(slug)}`;

  const script = `
    (function () {
      try {
        var slug = ${escapeScriptJson(slug)};
        var url = ${escapeScriptJson(endpoint)};
        var anonKey = ${escapeScriptJson(anonKey)};
        window.__PUBLIC_LANDING_PHONE_PROMISES = window.__PUBLIC_LANDING_PHONE_PROMISES || {};
        if (!window.__PUBLIC_LANDING_PHONE_PROMISES[slug]) {
          window.__PUBLIC_LANDING_PHONE_PROMISES[slug] = fetch(url, {
            method: 'GET',
            headers: {
              apikey: anonKey,
              Authorization: 'Bearer ' + anonKey
            },
            cache: 'no-store',
            keepalive: true
          }).then(function (response) {
            if (!response.ok) return null;
            return response.json();
          }).catch(function () {
            return null;
          });
        }
      } catch (e) {}
    })();
  `;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
