import { supabase } from "@/lib/supabaseClient";

export async function phoneAdministrationHeaders(): Promise<Record<string, string>> {
  // Session is used only to transport the token. The Edge handler verifies it.
  const { data, error } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (error || !token) throw new Error("Se requiere una sesion valida.");
  const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    ...(apiKey ? { apikey: apiKey } : {}),
  };
}
