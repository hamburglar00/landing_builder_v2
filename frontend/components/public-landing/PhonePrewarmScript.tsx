import type { PublicLandingPhoneResponse } from "./types";

type Props = {
  slug: string;
  initialPhone?: PublicLandingPhoneResponse | null;
};

function escapeScriptJson(value: unknown) {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (character) => {
    switch (character) {
      case "<":
        return "\\u003c";
      case ">":
        return "\\u003e";
      case "&":
        return "\\u0026";
      case "\u2028":
        return "\\u2028";
      case "\u2029":
        return "\\u2029";
      default:
        return character;
    }
  });
}

export default function PhonePrewarmScript({ slug, initialPhone }: Props) {
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
        var initialPhone = ${escapeScriptJson(initialPhone ?? null)};
        window.__PUBLIC_LANDING_PHONE_PROMISES = window.__PUBLIC_LANDING_PHONE_PROMISES || {};
        if (!window.__PUBLIC_LANDING_PHONE_PROMISES[slug]) {
          var refreshedAt = initialPhone && initialPhone.cacheRefreshedAt
            ? Date.parse(initialPhone.cacheRefreshedAt)
            : 0;
          var isInitialFresh = initialPhone && initialPhone.phone && refreshedAt && Date.now() - refreshedAt <= 90000;

          window.__PUBLIC_LANDING_PHONE_PROMISES[slug] = isInitialFresh
            ? Promise.resolve(initialPhone)
            : fetch(url, {
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
