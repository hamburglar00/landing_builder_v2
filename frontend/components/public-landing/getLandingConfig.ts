import type { PublicLandingConfig } from "./types";

// Bump whenever the Edge Function changes the public payload semantics so a
// deployment cannot keep serving an older force-cached normalization.
const BUILDER_CONFIG_CACHE_VERSION = "4";

export async function getPublicLandingConfig(
  name: string,
  options: { fresh?: boolean } = {},
): Promise<PublicLandingConfig | null> {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!baseUrl || !anonKey) {
    throw new Error("Missing Supabase environment variables");
  }

  const url = new URL("/functions/v1/builder-config", baseUrl);
  url.searchParams.set("name", name);
  url.searchParams.set("v", BUILDER_CONFIG_CACHE_VERSION);

  const response = await fetch(url.toString(), {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    ...(options.fresh ? { cache: "no-store" as const, signal: AbortSignal.timeout(8000) } : {
      cache: "force-cache" as const, next: { tags: [`landing-config:${name}`] },
    }),
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`builder-config responded ${response.status}`);
  }

  const data = (await response.json()) as PublicLandingConfig;
  return data?.name ? data : null;
}
