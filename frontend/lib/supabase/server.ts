import { createClient } from "@supabase/supabase-js";

export function getSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL");
  }

  const key = serviceRole || anonKey || "";
  if (!key) {
    throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY o NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
