import type { PublicLandingConfig } from "./types";

export async function getPublicLandingConfig(
  name: string,
): Promise<PublicLandingConfig | null> {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!baseUrl || !anonKey) {
    throw new Error("Missing Supabase environment variables");
  }

  const url = new URL("/functions/v1/builder-config", baseUrl);
  url.searchParams.set("name", name);

  const response = await fetch(url.toString(), {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    cache: "force-cache",
    next: { tags: [`landing-config:${name}`] },
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`builder-config responded ${response.status}`);
  }

  const data = (await response.json()) as PublicLandingConfig;
  return data?.name ? data : null;
}
