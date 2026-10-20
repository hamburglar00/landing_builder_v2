export type DestinationClient = { id: string; user_id: string; workspace_currency: string; atrio_id: string };
export type DestinationLanding = { id: string; user_id: string; workspace_currency: string; config: unknown };
export type DestinationBackend = {
  authenticate(token: string): Promise<boolean>;
  clients(token: string, ids: string[]): Promise<DestinationClient[]>;
  landing(token: string, id: string): Promise<DestinationLanding | null>;
  workspaceClients(token: string, owner: string, workspace: string): Promise<DestinationClient[]>;
  call(action: "directory" | "configuration" | "configure" | "reset", input: object): Promise<unknown>;
  assign(token: string, landingId: string, clientIds: string[]): Promise<void>;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const providers = ["rey_de_ases", "ases_del_norte", "ganamos_net"];
const json = (body: object, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function handleManagerDestinations(request: Request, backend: DestinationBackend) {
  try {
    if (request.method !== "POST") return json({ error: "Método no permitido." }, 405);
    if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) return json({ error: "Origen no permitido." }, 403);
    const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
    if (!token || !await backend.authenticate(token)) return json({ error: "Sesión no válida." }, 401);
    if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return json({ error: "Solicitud no válida." }, 415);
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 16384) return json({ error: "Solicitud demasiado grande." }, 413);
    const input = JSON.parse(raw);
    if (!input || typeof input !== "object" || Array.isArray(input)) return json({ error: "Solicitud no válida." }, 400);
    if (input.action === "directory" || input.action === "reset") {
      if (!Array.isArray(input.clientIds) || !input.clientIds.length || input.clientIds.length > 100 || input.clientIds.some((id: unknown) => typeof id !== "string" || !uuid.test(id))) return json({ error: "Asesores no válidos." }, 400);
      if (input.action === "reset" && !["usage_count", "messages_received"].includes(input.metric)) return json({ error: "Métrica no válida." }, 400);
      const ids = [...new Set<string>(input.clientIds)];
      const clients = await backend.clients(token, ids);
      if (clients.length !== ids.length || clients.some(client => !uuid.test(client.atrio_id))) return json({ error: "No tenés acceso a estos asesores." }, 403);
      return json(await backend.call(input.action, { advisor_ids: [...new Set(clients.map(client => client.atrio_id))], ...(input.action === "reset" ? { metric: input.metric } : {}) }) as object);
    }
    if (!["configuration", "configure"].includes(input.action) || !uuid.test(input.landingId) || !providers.includes(input.targetProvider)) return json({ error: "Destino no válido. Ganamos+ todavía no está integrado con PBAdmin." }, 400);
    const landing = await backend.landing(token, input.landingId);
    if (!landing) return json({ error: "No tenés acceso a esta landing." }, 403);
    const config = landing.config && typeof landing.config === "object" ? landing.config as Record<string, unknown> : {};
    if (config.template !== "template7" || config.ctaDestination !== "atrio" || (input.action === "configure" && (config.targetProvider || "rey_de_ases") !== input.targetProvider)) return json({ error: "Guardá primero el casino de Template 7." }, 409);
    const clients = await backend.workspaceClients(token, landing.user_id, landing.workspace_currency);
    if (!clients.length || clients.some(client => !uuid.test(client.atrio_id))) return json({ error: "No hay asesores válidos en este workspace." }, 409);
    const scope = { landing_id: landing.id, target_provider: input.targetProvider, allowed_advisor_ids: clients.map(client => client.atrio_id) };
    if (input.action === "configuration") {
      const [configuration, directory] = await Promise.all([backend.call("configuration", scope), backend.call("directory", { advisor_ids: scope.allowed_advisor_ids })]);
      return json({ configuration: (configuration as { configuration?: unknown })?.configuration === null ? null : configuration, directory });
    }
    if (!["fixed", "weighted_random", "fair"].includes(input.mode) || !["usage_count", "messages_received"].includes(input.criterion) ||
        !Array.isArray(input.destinations) || input.destinations.length < 1 || input.destinations.length > 100 ||
        input.destinations.some((d: unknown) => !d || typeof d !== "object" || !uuid.test(String(Reflect.get(d, "connection_id"))) || !Number.isInteger(Reflect.get(d, "weight")) || Reflect.get(d, "weight") < 1 || Reflect.get(d, "weight") > 1000) ||
        new Set(input.destinations.map((d: { connection_id: string }) => d.connection_id)).size !== input.destinations.length ||
        (input.mode === "fixed" && input.destinations.length !== 1)) return json({ error: "Elegí destinos válidos; el modo fijo requiere un solo bot." }, 400);
    // Validate and atomically save the explicit pool before expanding authorization:
    // a rejected pool must never alter the legacy landing's eligible advisors.
    const saved = await backend.call("configure", { ...scope, mode: input.mode, criterion: input.criterion, destinations: input.destinations });
    try { await backend.assign(token, landing.id, clients.map(client => client.id)); }
    catch { return json({ error: "Los destinos se guardaron, pero falta vincularlos con la landing. Volvé a guardar la landing para completar.", saved: true }, 503); }
    return json(saved as object);
  } catch {
    return json({ error: "No se pudieron guardar o consultar los destinos. Reintentá." }, 503);
  }
}
