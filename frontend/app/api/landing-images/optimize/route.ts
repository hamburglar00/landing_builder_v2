import { createClient } from "@supabase/supabase-js";
import { handleLandingImageOptimization } from "@/lib/landing/imageUploadRoute.server";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  return handleLandingImageOptimization(request, { async authenticate(token) {
    const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${token}` }, fetch: (input, init) => fetch(input, {
        ...init, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000),
      }) },
    });
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user || data.user.is_anonymous) return false;
    const profile = await client.from("profiles").select("id,role").eq("id", data.user.id).maybeSingle();
    return !profile.error && profile.data?.id === data.user.id && ["admin", "client"].includes(profile.data.role);
  } });
}
