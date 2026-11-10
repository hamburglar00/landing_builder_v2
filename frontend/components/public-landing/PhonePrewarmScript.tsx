import type { PublicLandingPhoneResponse } from "./types";
import { buildLandingPhoneRequestFactoryScript } from "@/lib/landing/landingPhoneRequest.client";

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

  const script = `
    (function () {
      try {
        (${buildLandingPhoneRequestFactoryScript()})().request(${escapeScriptJson({ slug, supabaseUrl: baseUrl, supabaseAnonKey: anonKey, initialPhone: initialPhone ?? null })});
      } catch (e) {}
    })();
  `;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
