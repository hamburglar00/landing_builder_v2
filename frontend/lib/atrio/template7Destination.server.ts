import { template8Provider } from "../landing/template8";
import { createClient } from "@supabase/supabase-js";
import { template7WarmRateLimitKeys } from "../reyDeAses/rateLimit.server";

type Landing = { id: string; name: string; user_id: string; workspace_currency: string; config: unknown };
type Advisor = { id: string; atrio_id: string; slug: string; user_id: string; workspace_currency: string };
export type DestinationContext = { allowed: boolean; landing: Landing | null; blocked: boolean; advisors: Advisor[] };
export type DestinationResolutionBackend = {
  context(landingId: string, landingSlug: string, deviceId: string, request: Request, classic: boolean, cardIndex?: number): Promise<DestinationContext>;
  resolve(input: object, operation?: "resolve" | "verify"): Promise<Record<string, unknown>>;
  fallback(slug: string): Promise<Record<string, unknown> | null>;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json = (body: object, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });

/** Background selection, without creating a casino account or sending tracking. */
export async function handleTemplate7Destination(
  request: Request,
  deviceId: string | null,
  backend: DestinationResolutionBackend,
  classic = false,
): Promise<Response> {
  const startedAt = performance.now();
  const stages: Partial<Record<"scope" | "resolve" | "fallback", number>> = {};
  const timed = async <T,>(stage: keyof typeof stages, run: () => Promise<T>): Promise<T> => {
    const started = performance.now();
    try { return await run(); }
    finally { stages[stage] = Math.max(0, Math.round(performance.now() - started)); }
  };
  const respond = (body: object, status = 200) => {
    const response = json(body, status);
    response.headers.set("Server-Timing", [
      ...Object.entries(stages).map(([stage, duration]) => `t7-destination-${stage};dur=${duration}`),
      `t7-destination-total;dur=${Math.max(0, Math.round(performance.now() - startedAt))}`,
    ].join(", "));
    return response;
  };
  try {
    if (request.method !== "POST" || request.headers.get("origin") !== new URL(request.url).origin ||
        request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return respond({ error: "invalid_request" }, 400);
    if (!deviceId || !uuid.test(deviceId)) return respond({ error: "identity_pending" }, 409);
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 1024) return respond({ error: "invalid_request" }, 413);
    const input = JSON.parse(raw);
    if (!input || typeof input !== "object" || Array.isArray(input) ||
        Object.keys(input).some(key => !["landing_id", "landing_slug", "card_index", "commit", ...(classic ? ["device_id"] : [])].includes(key)) ||
        !uuid.test(input.landing_id) || typeof input.landing_slug !== "string" || !/^[a-z0-9][a-z0-9_-]{0,159}$/i.test(input.landing_slug)) return respond({ error: "invalid_request" }, 400);
    if (input.card_index !== undefined && (!Number.isInteger(input.card_index) || input.card_index < 1 || input.card_index > 6)) return respond({ error: "invalid_request" }, 400);
    if (input.commit !== undefined && typeof input.commit !== "boolean") return respond({ error: "invalid_request" }, 400);
    const context = await timed("scope", () =>
      backend.context(input.landing_id, input.landing_slug, deviceId, request, classic, input.card_index));
    if (!context || typeof context.allowed !== "boolean") throw new Error("invalid scope");
    if (!context.allowed) return respond({ error: "rate_limited" }, 429);
    const landing = context?.landing;
    const config = landing?.config && typeof landing.config === "object" ? landing.config as Record<string, unknown> : {};
    if (!landing || landing.id !== input.landing_id || landing.name !== input.landing_slug || !["template7", "template8"].includes(String(config.template)) || config.ctaDestination !== "atrio") return respond({ error: "landing_not_found" }, 404);
    const isTemplate8 = config.template === "template8";
    const provider = isTemplate8 ? template8Provider(config, input.card_index) : config.targetProvider || "rey_de_ases";
    if (isTemplate8 && !provider || !isTemplate8 && input.card_index !== undefined) return respond({ error: "invalid_page" }, 400);
    if (!["rey_de_ases", "ases_del_norte", "ganamos_net", "multi_skin"].includes(String(provider))) return respond({ error: "integration_pending" }, 503);
    if (context.blocked !== false) return respond({ error: "landing_unavailable" }, 403);
    const advisors = context.advisors;
    if (!advisors.length || advisors.some(a => a.user_id !== landing.user_id || a.workspace_currency !== landing.workspace_currency || !uuid.test(a.atrio_id))) return respond({ error: "advisor_not_assigned" }, 403);
    const resolution = await timed("resolve", () => backend.resolve({ landing_id: landing.id, target_provider: provider, device_id: deviceId, allowed_advisor_ids: advisors.map(advisor => advisor.atrio_id), ...(isTemplate8 ? { reserve_only: input.commit !== true } : {}) }));
    if (resolution.configuration === null) {
      if (isTemplate8) return respond({ error: "page_not_configured" }, 409);
      const fallback = await timed("fallback", () => backend.fallback(landing.name));
      if (!fallback || (fallback._status && fallback._status !== "ok") ||
          !advisors.some(advisor => advisor.id === fallback.atrioClientId && advisor.atrio_id === fallback.atrioId && advisor.slug === fallback.atrioSlug)) return respond({ error: "advisor_not_assigned" }, 403);
      return respond(fallback);
    }
    const advisor = advisors.find(row => row.atrio_id === resolution.advisor_id && row.slug === resolution.advisor_slug);
    if (!advisor || resolution.target_provider !== provider || !uuid.test(String(resolution.connection_id))) return respond({ error: "advisor_not_assigned" }, 403);
    return respond({
      atrioClientId: advisor.id, atrioId: advisor.atrio_id, atrioSlug: advisor.slug,
      atrioRedirectUrl: `https://www.atrio.website/${encodeURIComponent(advisor.slug)}`,
      managerId: resolution.manager_id, managerType: resolution.manager_type,
      targetProvider: provider, managerDestination: true,
      preparationReady: resolution.preparation_ready === true,
      ...(typeof resolution.existing_name === "string" && typeof resolution.promo_code === "string" ? {
        existingName: resolution.existing_name, promoCode: resolution.promo_code,
      } : {}),
    });
  } catch { return respond({ error: "destination_unavailable" }, 503); }
}

export function productionDestinationBackend(): DestinationResolutionBackend {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("database unavailable");
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return {
    async context(landingId, landingSlug, deviceId, request, classic, cardIndex) {
      const keys = template7WarmRateLimitKeys(request, cardIndex ? `${deviceId}:template8` : deviceId);
      const result = await db.rpc(cardIndex ? "resolve_template8_limited_destination_context" : "resolve_template7_limited_destination_context", {
        p_landing_id: landingId, p_landing_slug: landingSlug,
        p_ip_bucket_key: keys.ip, p_device_bucket_key: keys.device,
        p_consume_device_on_ip_denial: !classic,
      });
      if (result.error) throw result.error;
      if (!result.data || typeof result.data !== "object" || Array.isArray(result.data) ||
          typeof result.data.allowed !== "boolean" || typeof result.data.blocked !== "boolean" ||
          !Array.isArray(result.data.advisors)) throw new Error("invalid context");
      return result.data as DestinationContext;
    },
    async resolve(input, operation = "resolve") {
      const origin = new URL(process.env.INTERNAL_CHAT_ORIGIN || "");
      const secret = process.env.INTERNAL_CHAT_PLAYER_RESOLVE_KEY || process.env.INTERNAL_CHAT_GATEWAY_API_KEY;
      if (!secret || origin.protocol !== "https:" || origin.pathname !== "/" || origin.username || origin.password || origin.search || origin.hash) throw new Error("unavailable");
      const response = await fetch(new URL(`/api/gateway/manager-destinations/${operation}`, origin), {
        method: "POST", headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
        body: JSON.stringify(input), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error("unavailable");
      return response.json();
    },
    async fallback(slug) {
      const result = await db.rpc("resolve_landing_atrio_context", { p_landing_name: slug });
      if (result.error) throw result.error;
      return result.data;
    },
  };
}

export async function confirmTemplate8Destination(landingId: string, provider: string, deviceId: string, advisorId: string): Promise<boolean> {
  const result = await productionDestinationBackend().resolve({ landing_id: landingId, target_provider: provider, device_id: deviceId, allowed_advisor_ids: [advisorId] }, "verify");
  return result.advisor_id === advisorId && result.target_provider === provider;
}
