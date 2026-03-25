import type { SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export type InvokeResult<T = unknown> =
  | { data: T | null; error: null }
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

  // Evita refrescar siempre: con lock de auth desactivado pueden darse carreras
  // entre refresh concurrentes y terminar en "Invalid JWT".
  let {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    const refreshed = await supabase.auth.refreshSession();
    session = refreshed.data.session;
    sessionError = refreshed.error;
  }

  if (sessionError || !session?.access_token) {
    return {
      data: null,
      error: {
        message:
          "Sesion expirada o invalida. Cierra sesion y vuelve a iniciar sesion.",
      },
    };
  }

  const url = `${supabaseUrl}/functions/v1/${name}`;
  const method = options.method ?? "POST";

  const sendRequest = async (accessToken: string): Promise<Response> =>
    fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        apikey: supabaseAnonKey,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

  let res: Response;
  try {
    res = await sendRequest(session.access_token);
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
            ? "No se pudo conectar con el servidor. Prueba de nuevo; si sigue fallando, revisa la consola (F12   Network) y tu conexion."
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

  // Algunos entornos quedan con token desfasado y la Edge devuelve "Invalid JWT".
  // Reintentamos una sola vez tras refresh de sesin.
  if (!res.ok) {
    const looksLikeInvalidJwt =
      rawText.toLowerCase().includes("invalid jwt") ||
      rawText.toLowerCase().includes("jwt malformed");

    if (looksLikeInvalidJwt) {
      const refreshed = await supabase.auth.refreshSession();
      const retriedToken = refreshed.data.session?.access_token;
      if (retriedToken) {
        try {
          const retryRes = await sendRequest(retriedToken);
          const retryText = await retryRes.text();
          let retryData: T | null = null;
          try {
            retryData = retryText ? (JSON.parse(retryText) as T) : null;
          } catch {
            // body no es JSON
          }
          if (retryRes.ok) {
            return { data: retryData, error: null };
          }
          res = retryRes;
          data = retryData;
          rawText = retryText;
        } catch {
          // Si falla el retry, dejamos manejar error normal abajo.
        }
      }
    }
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
      else if (rawText) serverMessage += `: ${rawText.slice(0, 200)}`;
    }
    return { data: null, error: { message: serverMessage } };
  }

  return { data, error: null };
}
