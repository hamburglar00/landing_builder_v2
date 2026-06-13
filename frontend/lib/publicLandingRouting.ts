export type PublicLandingRuntime = "legacy" | "constructor";

export type PublicLandingRoutingSettings = {
  runtime: PublicLandingRuntime;
  legacyBaseUrl: string;
};

const DEFAULT_PUBLIC_LANDING_HOST = "landing.panelbotadmin.com";
const DEFAULT_LEGACY_BASE_URL = "https://public-landing-bl.vercel.app";

export function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

export function getPublicLandingHost() {
  const configured =
    process.env.NEXT_PUBLIC_PUBLIC_LANDING_BASE_URL ||
    process.env.NEXT_PUBLIC_LANDING_PUBLIC_BASE_URL ||
    "";

  try {
    return configured ? new URL(configured).host.toLowerCase() : DEFAULT_PUBLIC_LANDING_HOST;
  } catch {
    return DEFAULT_PUBLIC_LANDING_HOST;
  }
}

export function getDefaultLegacyBaseUrl() {
  return normalizeBaseUrl(
    process.env.PUBLIC_LANDING_LEGACY_BASE_URL ||
      process.env.NEXT_PUBLIC_PUBLIC_LANDING_LEGACY_BASE_URL ||
      DEFAULT_LEGACY_BASE_URL,
  );
}

function normalizeRuntime(value: unknown): PublicLandingRuntime {
  return value === "constructor" ? "constructor" : "legacy";
}

export async function getPublicLandingRoutingSettings(): Promise<PublicLandingRoutingSettings> {
  const fallback: PublicLandingRoutingSettings = {
    runtime: "legacy",
    legacyBaseUrl: getDefaultLegacyBaseUrl(),
  };

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!baseUrl || !anonKey) return fallback;

  try {
    const response = await fetch(
      `${baseUrl.replace(/\/+$/, "")}/rest/v1/rpc/get_public_landing_routing`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
        body: "{}",
        cache: "no-store",
      },
    );

    if (!response.ok) return fallback;

    const data = (await response.json()) as
      | Array<{
          public_landing_runtime?: unknown;
          public_landing_legacy_base_url?: unknown;
        }>
      | {
          public_landing_runtime?: unknown;
          public_landing_legacy_base_url?: unknown;
        }
      | null;

    const row = Array.isArray(data) ? data[0] : data;
    const legacyBaseUrl =
      typeof row?.public_landing_legacy_base_url === "string" &&
      row.public_landing_legacy_base_url.trim()
        ? normalizeBaseUrl(row.public_landing_legacy_base_url)
        : fallback.legacyBaseUrl;

    return {
      runtime: normalizeRuntime(row?.public_landing_runtime),
      legacyBaseUrl,
    };
  } catch {
    return fallback;
  }
}
