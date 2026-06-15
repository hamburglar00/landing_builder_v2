import type { PublicLandingPhoneResponse } from "./types";

type RpcResponse = PublicLandingPhoneResponse & {
  cacheRefreshedAt?: string;
  cacheSource?: string;
};

export async function getCachedLandingPhone(
  name: string,
): Promise<RpcResponse | null> {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!baseUrl || !anonKey || !name) return null;

  try {
    const response = await fetch(
      `${baseUrl.replace(/\/+$/, "")}/rest/v1/rpc/get_cached_constructor_landing_phone`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify({ p_landing_name: name }),
        next: {
          revalidate: 60,
          tags: [`landing-phone:${name}`],
        },
      },
    );

    if (!response.ok) return null;

    const data = (await response.json()) as RpcResponse | null;
    return data?.phone ? data : null;
  } catch {
    return null;
  }
}
