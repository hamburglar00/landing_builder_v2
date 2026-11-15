import { GATEWAY_LANDING_BODY_LIMIT, GATEWAY_LANDING_PROOF_HEADER, isGatewayLandingOperation, isGatewayLandingSlug, verifyGatewayLandingRequest, type GatewayLandingClaims, type GatewayLandingProvider, type GatewayLandingResource } from "../gateway-landing-contract";
import { resolveEffectiveLandingConfig } from "./effectiveLandingConfig";
import { gatewayOriginFor } from "../reyDeAses/gatewayOrigins";
import { isMultiSkinCode } from "../multi-skin-catalog";

export type GatewayLandingRow = {
  id: string; user_id: string; name: string; publish_target: string; landing_type?: string;
  config: unknown; landing_config: unknown; pixel_id?: string;
};
export type GatewayLandingDependencies = {
  env: Record<string, string | undefined>;
  landing(slug: string): Promise<GatewayLandingRow | null>;
  blocked(owner: string): Promise<boolean>;
  render(row: GatewayLandingRow, claims: GatewayLandingClaims): Promise<Response>;
  dispatch(operation: string, request: Request): Promise<Response>;
  now?: () => number;
};
const keys: Record<string, string> = {
  rey_de_ases: "REY_GATEWAY_HANDOFF_API_KEY", ases_del_norte: "ASES_DEL_NORTE_GATEWAY_HANDOFF_API_KEY",
  ganamos_net: "GANAMOS_NET_GATEWAY_HANDOFF_API_KEY", multi_skin: "MULTI_SKIN_GATEWAY_HANDOFF_API_KEY",
};
const record = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const denied = (status: number) => Response.json({ error: "landing_unavailable" }, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });

/** All identities and hosts come from verified gateway metadata, never public headers. */
export function gatewayLandingMatches(row: GatewayLandingRow, claims: GatewayLandingClaims, env: GatewayLandingDependencies["env"]): boolean {
  const config = resolveEffectiveLandingConfig(row.config, row.landing_config);
  const provider = config.targetProvider ?? "rey_de_ases";
  const skin = provider === "multi_skin" ? config.multiSkinCode ?? "ganamos_plus" : null;
  if (row.publish_target !== "gateway" || row.name !== claims.slug || row.name.toLowerCase() === "nexobet" || row.landing_type === "external"
    || !["template7", "template9"].includes(String(config.template)) || config.ctaDestination !== "atrio"
    || provider !== claims.provider || skin !== claims.skin || skin !== null && !isMultiSkinCode(skin)) return false;
  const origin = gatewayOriginFor(String(provider), typeof skin === "string" ? skin : null, env);
  try { return !!origin && new URL(origin).origin === claims.origin; } catch { return false; }
}

function payloadMatches(operation: string, value: unknown, row: GatewayLandingRow, claims: GatewayLandingClaims): boolean {
  const body = record(value);
  if (operation === "client-identity/bootstrap") return !Object.keys(body).some(key => !["verify", "recovery_token"].includes(key));
  if (operation === "track") {
    const payload = record(body.payload);
    return payload.landing_id === row.id && (!payload.landing_name || payload.landing_name === row.name)
      && (!payload.meta_pixel_id || String(payload.meta_pixel_id) === String(row.pixel_id || ""));
  }
  if (body.landing_id !== row.id) return false;
  if (body.landing_slug !== undefined && body.landing_slug !== row.name || body.slug !== undefined && body.slug !== row.name) return false;
  if (body.card_index !== undefined) return false;
  if (operation === "template7/prepare" || operation === "template7/warm") {
    const attribution = record(body.attribution);
    if (attribution.target_provider !== undefined && attribution.target_provider !== claims.provider
      || attribution.skin_code !== undefined && attribution.skin_code !== (claims.skin || "")) return false;
  }
  return true;
}

export async function handleGatewayLanding(request: Request, path: { provider: string; slug: string; resource: string[] }, deps: GatewayLandingDependencies): Promise<Response> {
  const [resource, ...segments] = path.resource;
  const operation = segments.join("/");
  if (!Object.hasOwn(keys, path.provider) || !isGatewayLandingSlug(path.slug)
    || !isGatewayLandingOperation(resource, operation, request.method) || new URL(request.url).search) return denied(404);
  const contentType = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() || "";
  const cookie = request.headers.get("cookie") || "";
  // The only allowed incoming cookie is the translated identity UUID. No casino session crosses this boundary.
  if (cookie && !/^lb_cid=[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cookie)) return denied(400);
  let body = "";
  try {
    const reader = request.body?.getReader(); let size = 0; const chunks: Uint8Array[] = [];
    if (reader) while (true) { const part = await reader.read(); if (part.done) break;
      size += part.value.byteLength; if (size > GATEWAY_LANDING_BODY_LIMIT) { await reader.cancel(); return denied(413); } chunks.push(part.value); }
    body = Buffer.concat(chunks).toString("utf8");
  } catch { return denied(400); }
  const claims = verifyGatewayLandingRequest(request.headers.get(GATEWAY_LANDING_PROOF_HEADER), {
    backend: "builder", provider: path.provider as GatewayLandingProvider, slug: path.slug,
    resource: resource as GatewayLandingResource, operation, method: request.method as "GET" | "HEAD" | "POST", contentType, body, cookie,
  }, deps.env[keys[path.provider]] || "", deps.now?.());
  if (!claims) return denied(401);
  try {
    const row = await deps.landing(path.slug);
    if (!row || !gatewayLandingMatches(row, claims, deps.env) || await deps.blocked(row.user_id)) return denied(404);
    if (resource !== "api") return deps.render(row, claims);
    let payload: unknown; try { payload = JSON.parse(body); } catch { return denied(400); }
    if (!payloadMatches(operation, payload, row, claims)) return denied(400);
    const headers = new Headers({ "Content-Type": contentType, Origin: claims.origin, "User-Agent": claims.userAgent });
    if (cookie) headers.set("Cookie", cookie);
    if (claims.clientIp) { headers.set("X-Forwarded-For", claims.clientIp); headers.set("X-Real-IP", claims.clientIp); }
    const internal = new Request(new URL(`/api/${operation}`, claims.origin), { method: "POST", headers, body });
    const response = await deps.dispatch(operation, internal);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch { return denied(503); }
}
