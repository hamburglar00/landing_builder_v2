import type { PublishTarget } from "./types";

const DEFAULT_CLASSIC_LANDING_BASE_URL = "https://landing.panelbotadmin.com";
const DEFAULT_CONSTRUCTOR_LANDING_BASE_URL = "https://mkt.panelbotadmin.com";

export function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

export function getConstructorLandingBaseUrl(): string {
  return normalizeBaseUrl(
    process.env.NEXT_PUBLIC_CONSTRUCTOR_LANDING_BASE_URL ||
      DEFAULT_CONSTRUCTOR_LANDING_BASE_URL,
  );
}

export function getClassicLandingBaseUrl(urlBase?: string | null): string {
  return normalizeBaseUrl(
    urlBase ||
      process.env.NEXT_PUBLIC_CLASSIC_LANDING_BASE_URL ||
      DEFAULT_CLASSIC_LANDING_BASE_URL,
  );
}

export function getLandingPublicBaseUrl(
  publishTarget: PublishTarget,
  classicBaseUrl?: string | null,
): string {
  return publishTarget === "constructor"
    ? getConstructorLandingBaseUrl()
    : getClassicLandingBaseUrl(classicBaseUrl);
}

export function buildLandingPublicUrl(
  name: string,
  publishTarget: PublishTarget,
  classicBaseUrl?: string | null,
): string {
  const encodedName = encodeURIComponent(name);
  if (publishTarget === "constructor") {
    return `${getLandingPublicBaseUrl(publishTarget, classicBaseUrl)}/l/${encodedName}`;
  }

  return `${getLandingPublicBaseUrl(publishTarget, classicBaseUrl)}/${encodedName}`;
}
