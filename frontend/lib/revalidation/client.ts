import { supabase } from "@/lib/supabaseClient";
import type { RevalidationAction, RevalidationResult } from "./types";

async function panelRequest(action?: RevalidationAction): Promise<unknown> {
  let { data: { session }, error } = await supabase.auth.getSession();
  if (!session?.access_token && !error) {
    const refreshed = await supabase.auth.refreshSession();
    session = refreshed.data.session;
    error = refreshed.error;
  }
  if (error || !session?.access_token) throw new Error("La sesión no está disponible. Volvé a iniciar sesión.");
  let response: Response;
  try {
    response = await fetch("/api/landings/revalidate", {
      method: action ? "POST" : "GET", cache: "no-store", redirect: "error",
      signal: AbortSignal.timeout(35000),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: action ? JSON.stringify({ action: action.action, landingId: action.landingId, publishTarget: action.publishTarget }) : undefined,
    });
  } catch { throw new Error("No se pudo contactar el servicio de revalidación."); }
  if (!response.ok) throw new Error("No se pudo revalidar la landing. Revisá la sesión, el acceso y la configuración del servicio.");
  try { return await response.json(); } catch { throw new Error("Respuesta de revalidación inválida."); }
}

export async function getRevalidationStatus(): Promise<boolean> {
  const value = await panelRequest();
  if (!value || typeof value !== "object" || !("configured" in value) || typeof value.configured !== "boolean") {
    throw new Error("No se pudo consultar la configuración de revalidación.");
  }
  return value.configured;
}

export async function requestRevalidation(action: RevalidationAction): Promise<RevalidationResult> {
  const value = await panelRequest(action);
  if (!value || typeof value !== "object" || !("ok" in value) || value.ok !== true
    || !("revalidated" in value) || value.revalidated !== true) throw new Error("No se pudo revalidar la landing.");
  return { ok: true, revalidated: true };
}
