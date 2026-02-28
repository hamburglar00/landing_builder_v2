import type { SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export type InvokeResult<T = unknown> =
  | { data: T; error: null }
  | { data: null; error: { message: string } };

/**
 * Llama a una Edge Function con fetch para poder leer el mensaje de error
 * del servidor cuando la respuesta no es 2xx.
 */
export async function invokeFunction<T = unknown>(
  supabase: SupabaseClient,
  name: string,
  options: { body?: object; method?: string } = {},
): Promise<InvokeResult<T>> {
  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      data: null,
      error: {
        message:
          "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      },
    };
  }

  // Refrescar la sesión para enviar un access_token válido (evita "Invalid JWT" en Edge Functions)
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.refreshSession();

  if (sessionError || !session?.access_token) {
    return {
      data: null,
      error: {
        message:
          "Sesión expirada o inválida. Cierra sesión y vuelve a iniciar sesión.",
      },
    };
  }

  const url = `${supabaseUrl}/functions/v1/${name}`;
  const method = options.method ?? "POST";
  const accessToken = session.access_token;

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        apikey: supabaseAnonKey,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch (err) {
    const msg =
      err && typeof err === "object" && "message" in err
        ? String((err as { message: unknown }).message)
        : "Error de red";
    return {
      data: null,
      error: {
        message:
          msg === "Failed to fetch" || msg.includes("fetch")
            ? "No se pudo conectar con el servidor. Prueba de nuevo; si sigue fallando, revisa la consola (F12 → Network) y tu conexión."
            : msg,
      },
    };
  }

  let data: T | null = null;
  let rawText = "";
  try {
    rawText = await res.text();
    if (rawText) data = JSON.parse(rawText) as T;
  } catch {
    // body no es JSON
  }

  if (!res.ok) {
    let serverMessage = "";
    if (data && typeof data === "object" && data !== null) {
      if ("error" in data) serverMessage = String((data as { error: unknown }).error);
      else if ("message" in data) serverMessage = String((data as { message: unknown }).message);
    }
    if (!serverMessage) {
      serverMessage = res.statusText || `Error del servidor (${res.status})`;
      if (rawText && rawText.length < 500) serverMessage += `: ${rawText}`;
      else if (rawText) serverMessage += `: ${rawText.slice(0, 200)}…`;
    }
    return { data: null, error: { message: serverMessage } };
  }

  return { data, error: null };
}
