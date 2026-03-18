import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
  );
}

/** Fetch sin caché para evitar que el navegador devuelva datos viejos (ej. funnel/ocultos). */
function fetchNoCache(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  return fetch(input, { ...init, cache: "no-store" });
}

/**
 * Cliente de Supabase con lock de auth desactivado para evitar
 * "Lock broken by another request with the 'steal' option" (Navigator LockManager).
 * Ejecutamos las operaciones de auth sin lock entre pestañas.
 * Usa fetch sin caché para que funnel/hidden_contacts no devuelvan datos obsoletos.
 */
export const supabase: SupabaseClient = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    global: { fetch: fetchNoCache },
    auth: {
      lock: (_name, _acquireTimeout, fn) => fn(),
    },
  },
);

