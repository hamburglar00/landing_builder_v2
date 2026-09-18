import "server-only";
import { timingSafeEqual } from "node:crypto";
import { assertLocalSyntheticSecret, destinationFor, isLandingName, type Destination, type RevalidationEnvironment } from "./catalog.server";
import type { RevalidationAction, RevalidationResult } from "./types";

export type Actor = { id: string; role: "admin" | "client" };
export type AuthorizedLanding = { id: string; user_id: string; name: string; publish_target: "classic" | "constructor" };
export type RevalidationBackend = {
  authenticate: (token: string) => Promise<Actor | null>;
  landing: (actor: Actor, token: string, id: string) => Promise<AuthorizedLanding | null>;
  secret: () => Promise<string>;
};
type Dependencies = {
  environment: RevalidationEnvironment;
  backend: RevalidationBackend;
  send: (destination: Destination, name: string, secret: string) => Promise<RevalidationResult>;
};

export function safeJson(body: Record<string, unknown>, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
const denied = (status: number, code: string) => safeJson({ ok: false, revalidated: false, error: code }, status);

export async function boundedJson(request: Request): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") throw new Error("invalid_request");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("invalid_request");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.byteLength;
    if (size > 16384) { await reader.cancel(); throw new Error("invalid_request"); }
    chunks.push(part.value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function actionFrom(value: unknown): RevalidationAction | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (Object.keys(row).length !== 3 || Object.keys(row).some(k => !["action", "landingId", "publishTarget"].includes(k))) return null;
  if (row.action !== "publish" && row.action !== "test-classic") return null;
  if (row.publishTarget !== "classic" && row.publishTarget !== "constructor") return null;
  if (typeof row.landingId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.landingId)) return null;
  return { action: row.action, landingId: row.landingId, publishTarget: row.publishTarget };
}

export async function handlePanelRevalidation(request: Request, dependencies: Dependencies): Promise<Response> {
  try {
    if (request.method !== "GET" && request.method !== "POST") return denied(405, "invalid_request");
    if (new URL(request.url).search) return denied(400, "invalid_request");
    const token = request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/i)?.[1];
    if (!token || token.length > 8192) return denied(401, "unauthorized");
    const actor = await dependencies.backend.authenticate(token);
    if (!actor || (actor.role !== "admin" && actor.role !== "client")) return denied(403, "forbidden");
    if (request.method === "GET") {
      if (actor.role !== "admin") return denied(403, "forbidden");
      const secret = await dependencies.backend.secret();
      if (secret) assertLocalSyntheticSecret(dependencies.environment, secret);
      return safeJson({ configured: secret.length > 0 });
    }
    let value: unknown;
    try { value = await boundedJson(request); } catch { return denied(400, "invalid_request"); }
    const action = actionFrom(value);
    if (!action) return denied(400, "invalid_request");
    if (action.action === "test-classic" && (actor.role !== "admin" || action.publishTarget !== "classic")) return denied(403, "forbidden");
    const landing = await dependencies.backend.landing(actor, token, action.landingId);
    if (!landing || landing.id !== action.landingId || (actor.role !== "admin" && landing.user_id !== actor.id)) return denied(403, "forbidden");
    if (!isLandingName(landing.name)) return denied(400, "invalid_request");
    if (action.action === "publish" && action.publishTarget !== landing.publish_target) return denied(409, "target_changed");
    // The administrative diagnostic is explicitly classic; publication uses persisted state.
    const motor = action.action === "test-classic" ? "classic" : landing.publish_target;
    const destination = destinationFor(dependencies.environment, motor);
    const secret = await dependencies.backend.secret();
    if (!secret) return denied(503, "not_configured");
    assertLocalSyntheticSecret(dependencies.environment, secret);
    const result = await dependencies.send(destination, landing.name, secret);
    if (!result.ok || !result.revalidated) return denied(502, "upstream_failed");
    // Construct a fresh projection even if a transport accidentally returns extra fields.
    const body: Record<string, unknown> = { ok: true, revalidated: true };
    if (result.warmed) body.warmed = {
      config: typeof result.warmed.config === "boolean" ? result.warmed.config : null,
      page: result.warmed.page === true, retried: result.warmed.retried === true,
    };
    return safeJson(body);
  } catch { return denied(502, "revalidation_unavailable"); }
}

export async function handleConstructorRevalidation(request: Request, dependencies: {
  environment: RevalidationEnvironment; secret: () => Promise<string>;
  invalidate: (name: string) => void; warm: (name: string) => Promise<boolean>;
}): Promise<Response> {
  try {
    if (request.method !== "POST" || new URL(request.url).search) return denied(400, "invalid_request");
    let value: unknown;
    try { value = await boundedJson(request); } catch { return denied(400, "invalid_json"); }
    if (!value || typeof value !== "object" || Array.isArray(value)) return denied(400, "invalid_request");
    const body = value as Record<string, unknown>;
    if (Object.keys(body).some(k => k !== "name" && k !== "secret") || !isLandingName(body.name)) return denied(400, "invalid_name");
    if (typeof body.secret !== "string") return denied(401, "invalid_secret");
    const secret = await dependencies.secret();
    if (!secret) return denied(401, "invalid_secret");
    assertLocalSyntheticSecret(dependencies.environment, secret);
    const expected = Buffer.from(secret), supplied = Buffer.from(body.secret);
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return denied(401, "invalid_secret");
    dependencies.invalidate(body.name);
    if (!await dependencies.warm(body.name)) return denied(502, "warm_failed");
    return safeJson({ ok: true, revalidated: true, warmed: { ok: true } });
  } catch { return denied(503, "revalidation_unavailable"); }
}
