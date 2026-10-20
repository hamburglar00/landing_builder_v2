import type { TargetProvider } from "../landing/types";

export type ManagerRouteRequest = { landingId: string; atrioClientId: string; targetProvider: TargetProvider; connectionId?: string };
type Landing = { id: string; user_id: string; workspace_currency: string };
type Advisor = { id: string; user_id: string; workspace_currency: string; atrio_id: string };
export type ManagerRouteBackend = {
  authenticate(token: string): Promise<boolean>;
  landing(token: string, id: string): Promise<Landing | null>;
  advisor(token: string, id: string): Promise<Advisor | null>;
  configure(input: { advisor_id: string; landing_id: string; target_provider: TargetProvider; connection_id?: string }): Promise<unknown>;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const providers = ["rey_de_ases", "multi_skin", "ases_del_norte", "ganamos_net"];
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });

export async function handleManagerRoute(request: Request, backend: ManagerRouteBackend) {
  try {
    if (request.method !== "POST") return json({ error: "Método no permitido." }, 405);
    if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) return json({ error: "Origen no permitido." }, 403);
    const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
    if (!token || !await backend.authenticate(token)) return json({ error: "Sesión no válida." }, 401);
    if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return json({ error: "Solicitud no válida." }, 415);
    const reader = request.body?.getReader();
    if (!reader) return json({ error: "Solicitud no válida." }, 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > 2048) { await reader.cancel(); return json({ error: "Solicitud demasiado grande." }, 413); }
      chunks.push(part.value);
    }
    let value: unknown;
    try { value = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return json({ error: "Solicitud no válida." }, 400); }
    if (!value || typeof value !== "object" || Array.isArray(value)) return json({ error: "Solicitud no válida." }, 400);
    const row = value as Record<string, unknown>;
    if (Object.keys(row).some((key) => !["landingId", "atrioClientId", "targetProvider", "connectionId"].includes(key)) ||
      typeof row.landingId !== "string" || !uuid.test(row.landingId) || typeof row.atrioClientId !== "string" || !uuid.test(row.atrioClientId) ||
      !providers.includes(String(row.targetProvider)) ||
      (row.connectionId !== undefined && (typeof row.connectionId !== "string" || !uuid.test(row.connectionId)))) return json({ error: "Solicitud no válida." }, 400);
    const input = row as ManagerRouteRequest;
    const [landing, advisor] = await Promise.all([backend.landing(token, input.landingId), backend.advisor(token, input.atrioClientId)]);
    if (!landing || !advisor || landing.user_id !== advisor.user_id || landing.workspace_currency !== advisor.workspace_currency || !uuid.test(advisor.atrio_id)) return json({ error: "El asesor no pertenece al workspace de esta landing." }, 403);
    return json(await backend.configure({ advisor_id: advisor.atrio_id, landing_id: landing.id, target_provider: input.targetProvider,
      ...(input.connectionId ? { connection_id: input.connectionId } : {}) }));
  } catch {
    return json({ error: "No se pudieron consultar o guardar los managers. Reintentá." }, 503);
  }
}
