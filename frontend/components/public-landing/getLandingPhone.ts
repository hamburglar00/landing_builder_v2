import type { PublicLandingPhoneResponse } from "./types";

export async function getPublicLandingPhone(
  name: string,
): Promise<PublicLandingPhoneResponse | null> {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!baseUrl || !anonKey) {
    throw new Error("Missing Supabase environment variables");
  }

  const url = new URL("/functions/v1/landing-phone", baseUrl);
  url.searchParams.set("name", name);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    cache: "no-store",
  });

  if (!response.ok) return null;

  const data = (await response.json()) as PublicLandingPhoneResponse;
  return data?.phone ? data : null;
}
