import "server-only";
import { createHash, randomInt, randomUUID } from "node:crypto";

/** Canonical Meta connection checks, shared with NexoBet through its pinned module. */
export const META_GRAPH_VERSION = "v25.0";
export type MetaConnectionCheck = { connected: true; mode: "test_event"; testCodeSource: "generated" | "provided"; message: string };
export class MetaConnectionError extends Error {
  constructor(public readonly reason: string, message: string, public readonly status = 422) { super(message); }
}
export async function checkMetaConnection(input: { pixelId: string; token: string; testEventCode?: string; scope: string }, network: typeof fetch = fetch): Promise<MetaConnectionCheck> {
  const pixelId = input.pixelId.trim(), token = input.token.trim(), suppliedCode = input.testEventCode?.trim() ?? "";
  if (!/^\d{5,25}$/.test(pixelId) || token.length < 8 || token.length > 5000 || /[\r\n]/.test(token))
    throw new MetaConnectionError("invalid_pixel_credentials", "Ingresá el ID y el token del píxel para probar la conexión.");
  if (suppliedCode && !/^[a-zA-Z0-9_-]{4,100}$/.test(suppliedCode))
    throw new MetaConnectionError("invalid_test_code", "Copiá el código de la pestaña Probar eventos de Meta.");
  // Meta accepted generated codes in the controlled v25.0 probe (2026-11-08).
  // Always test CAPI writes; metadata reads can reject valid CAPI-only tokens.
  const code = suppliedCode || `TEST${randomInt(100000, 1000000)}`;
  const path = `https://graph.facebook.com/${META_GRAPH_VERSION}/${pixelId}`;
  let response: Response, result: any;
  try {
    response = await network(`${path}/events`, {
      method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000),
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ test_event_code: code, data: [{
        event_name: "ConnectionTest", event_id: `connection-test:${randomUUID()}`, event_time: Math.floor(Date.now() / 1000),
        action_source: "system_generated", user_data: { external_id: [createHash("sha256").update(`connection-test:${input.scope}:${pixelId}`).digest("hex")] },
      }] }),
    });
    result = await response.json();
  } catch {
    throw new MetaConnectionError("meta_unavailable", "No pudimos conectar con Meta. Volvé a intentar en unos minutos.", 503);
  }
  if (!response.ok || result?.error) {
    if (Number(result?.error?.code) === 190)
      throw new MetaConnectionError("invalid_meta_token", "Meta rechazó el token. Revisá que esté vigente y pertenezca al píxel.");
    if (response.status >= 500 || response.status === 429)
      throw new MetaConnectionError("meta_unavailable", "Meta no está disponible en este momento. Volvé a intentar.", 503);
    const codeRejected = Number(result?.error?.code) === 100 && (
      /\btest[ _-]*event[ _-]*code\b/i.test(String(result?.error?.message ?? "")) ||
      JSON.stringify(result?.error?.error_data?.blame_field_specs ?? []).includes('"test_event_code"')
    );
    if (!suppliedCode && codeRejected)
      throw new MetaConnectionError("meta_test_code_required", "Meta pidió el código de Probar eventos. Copialo desde el administrador de eventos para completar la prueba.");
    throw new MetaConnectionError("meta_access_rejected", suppliedCode
      ? "Meta no aceptó la prueba. Revisá el píxel, los permisos del token y el código de Probar eventos."
      : "Meta no aceptó la prueba. Revisá el ID del píxel y los permisos del token.");
  }
  if (result?.events_received === 1)
    return { connected: true, mode: "test_event", testCodeSource: suppliedCode ? "provided" : "generated", message: "Conexión CAPI verificada: Meta recibió correctamente el evento de prueba." };
  throw new MetaConnectionError("meta_response_unconfirmed", "Meta no confirmó esta prueba. Revisá los datos y volvé a intentar.");
}
