import { createClient } from "@supabase/supabase-js";
import type { MultiSkinCode, TargetProvider } from "../landing/types";
import type { AssignedAdvisor, Api2ResolveAccountRequest, HandoffResult, LinkedProviderAccount, TargetAccount, ResolvedPlayer, StartRequest, PlayerResolveRequest } from "./contracts";
import { getOrCreateClientIdentity, withClientIdentityCookie, type ClientIdentity } from "./clientIdentity.server";
import { isDemoLandingAllowed, readDemoConfig, readDemoCookie, verifyDemoSession, type DemoConfig } from "./demo.server";
import { logServerFlowTotal, timedServerStage } from "./performance.server";
import { allowTemplate7Start, template7StartRateLimitKeys } from "./rateLimit.server";
import { api2Readiness, createProviderHandoff, gatewayReadiness, linkInternalChatProviderAccount, resolveInternalChatPlayer, resolveTargetAccount, TargetIntegrationError, validateResolvedPlayer } from "./integrations.server";

type LandingRow = { id: string; name: string; user_id: string; workspace_currency: string; config: unknown; landing_config: unknown };
type AssignmentRow = { landing_id: string; atrio_client_id: string; user_id: string };
type AdvisorRow = { id: string; user_id: string; workspace_currency: string; slug: string; atrio_id: string };
type StartContextStatus = "ok" | "landing_not_found" | "integration_pending" | "landing_unavailable" | "rate_limited" | "advisor_not_assigned";
type ResolvedStartContext = {
  status: StartContextStatus;
  landing?: LandingRow;
  provider?: TargetProvider;
  advisor?: AdvisorRow;
};

export type StartDb = {
  landing(id: string): Promise<LandingRow | null>;
  assignment(landingId: string, atrioClientId: string): Promise<AssignmentRow | null>;
  advisor(atrioClientId: string): Promise<AdvisorRow | null>;
  blocked(userId: string): Promise<boolean>;
};

export type StartDependencies = {
  db: StartDb;
  resolveContext?(request: Request, payload: StartRequest, identity: ClientIdentity): Promise<ResolvedStartContext>;
  api2Status(): "integration_pending" | null;
  gatewayStatus(provider: TargetProvider): "integration_pending" | null;
  allowStart(request: Request, landingId: string, deviceId: string, needsCookie: boolean): Promise<boolean>;
  demoConfig(): DemoConfig | null;
  resolvePlayer(input: PlayerResolveRequest): Promise<ResolvedPlayer>;
  resolveAccount(request: Api2ResolveAccountRequest): Promise<TargetAccount>;
  linkProviderAccount(advisor: AssignedAdvisor, player: ResolvedPlayer, account: TargetAccount): Promise<LinkedProviderAccount>;
  createHandoff(provider: TargetProvider, advisor: AssignedAdvisor, deviceId: string, player: ResolvedPlayer, account: TargetAccount, skinCode: MultiSkinCode | null, testing: boolean): Promise<HandoffResult>;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{0,159}$/i;
const ADVISOR_SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{0,80}$/i;
const ATTRIBUTION_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbp", "fbc", "referrer", "target_provider", "skin_code"] as const;

function json(body: Record<string, string>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

export function parseTemplate7StartPayload(value: unknown): StartRequest | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  const name = typeof data.name === "string" ? data.name.trim().replace(/\s+/g, " ") : "";
  if (!UUID_PATTERN.test(String(data.landing_id ?? "")) || !SLUG_PATTERN.test(String(data.landing_slug ?? "")) ||
      !UUID_PATTERN.test(String(data.atrio_client_id ?? "")) || !UUID_PATTERN.test(String(data.advisor_id ?? "")) ||
      !ADVISOR_SLUG_PATTERN.test(String(data.advisor_slug ?? "")) ||
      !name || name.length > 80 || /[\x00-\x1f\x7f]/.test(name)) return null;
  const promo = typeof data.promo_code === "string" ? data.promo_code.trim() : "";
  if (!promo || promo.length > 128 || /[\x00-\x1f\x7f]/.test(promo)) return null;
  const rawAttribution = data.attribution;
  if (rawAttribution !== undefined && (!rawAttribution || typeof rawAttribution !== "object" || Array.isArray(rawAttribution))) return null;
  const attribution: Record<string, string> = {};
  for (const key of ATTRIBUTION_KEYS) {
    const field = (rawAttribution as Record<string, unknown> | undefined)?.[key];
    if (field !== undefined && (typeof field !== "string" || field.length > 500 || /[\x00-\x1f\x7f]/.test(field))) return null;
    if (field) attribution[key] = field;
  }
  return {
    landing_id: String(data.landing_id), landing_slug: String(data.landing_slug), name,
    atrio_client_id: String(data.atrio_client_id),
    advisor_id: String(data.advisor_id), advisor_slug: String(data.advisor_slug),
    promo_code: promo, attribution,
  };
}

function isTemplate7Landing(landing: LandingRow): boolean {
  const raw = landing.config && typeof landing.config === "object" ? landing.config as Record<string, unknown> : {};
  const published = landing.landing_config && typeof landing.landing_config === "object"
    ? landing.landing_config as Record<string, unknown> : {};
  const layout = published.layout && typeof published.layout === "object" ? published.layout as Record<string, unknown> : {};
  return (raw.template === "template7" || layout.template === 7) && raw.ctaDestination === "atrio";
}

function configuredTargetProvider(landing: LandingRow): TargetProvider | null {
  const raw = landing.config && typeof landing.config === "object" ? landing.config as Record<string, unknown> : {};
  // Landings 7 antiguas no tenian selector: se conserva Rey de Ases.
  if (raw.targetProvider === undefined || raw.targetProvider === null) return "rey_de_ases";
  if (raw.targetProvider === "rey_de_ases" || raw.targetProvider === "multi_skin") return raw.targetProvider;
  return null;
}

function configuredSkinCode(landing: LandingRow, provider: TargetProvider): MultiSkinCode | null {
  if (provider === "rey_de_ases") return null;
  const raw = landing.config && typeof landing.config === "object" ? landing.config as Record<string, unknown> : {};
  // Antes del selector solo existia Ganamos+, por lo que esa configuracion
  // historica puede migrarse sin cambiar el destino del jugador.
  if (raw.multiSkinCode === undefined || raw.multiSkinCode === null) return "ganamos_plus";
  return raw.multiSkinCode === "ganamos_plus" ? "ganamos_plus" : null;
}

async function bounded<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("timeout")), 7000);
    })]);
  } finally { if (timer) clearTimeout(timer); }
}

async function handleTemplate7StartInner(request: Request, deps: StartDependencies, identity: ClientIdentity): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") || "")) return json({ error: "invalid_request" }, 415);
  if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) return json({ error: "invalid_request" }, 403);
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 4096) return json({ error: "invalid_request" }, 413);
  let payload: StartRequest | null = null;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 4096) return json({ error: "invalid_request" }, 413);
    payload = parseTemplate7StartPayload(JSON.parse(raw));
  } catch { return json({ error: "invalid_request" }, 400); }
  if (!payload) return json({ error: "invalid_request" }, 400);

  const flowStartedAt = performance.now();
  try {
    let landing: LandingRow;
    let provider: TargetProvider;
    let assigned: AssignedAdvisor | null = null;
    const contextResolved = Boolean(deps.resolveContext);

    if (deps.resolveContext) {
      const context = await bounded(timedServerStage(
        "template7_start",
        "context_transaction",
        () => deps.resolveContext!(request, payload!, identity),
      ));
      if (context.status !== "ok") {
        const status = context.status === "landing_not_found" ? 404
          : context.status === "landing_unavailable" || context.status === "advisor_not_assigned" ? 403
            : context.status === "rate_limited" ? 429 : 503;
        const response = json({ error: context.status }, status);
        if (context.status === "rate_limited") response.headers.set("Retry-After", "45");
        return response;
      }
      if (!context.landing || !context.provider || !context.advisor) throw new Error("invalid start context");
      landing = context.landing;
      provider = context.provider;
      assigned = {
        atrioClientId: context.advisor.id,
        advisorId: context.advisor.atrio_id,
        advisorSlug: context.advisor.slug,
      };
    } else {
      const candidate = await bounded(deps.db.landing(payload.landing_id));
      if (!candidate || candidate.name !== payload.landing_slug || !isTemplate7Landing(candidate)) return json({ error: "landing_not_found" }, 404);
      landing = candidate;
      const candidateProvider = configuredTargetProvider(landing);
      if (!candidateProvider) return json({ error: "integration_pending" }, 503);
      provider = candidateProvider;
    }
    // El indicador selecciona el recorrido, pero jamás autoriza: eso exige
    // cookie firmada + configuración de servidor + allowlists.
    const demoRequested = request.headers.get("x-template7-demo-context") === "testing";
    const demoCookie = demoRequested ? readDemoCookie(request) : null;
    const demoConfig = demoCookie === null ? null : deps.demoConfig();
    if (demoRequested && (demoCookie === null || !demoConfig || !isDemoLandingAllowed(landing, demoConfig) ||
        !verifyDemoSession(demoCookie, landing.id, landing.name, demoConfig))) {
      return json({ error: "demo_not_authorized" }, 403);
    }
    const skinCode = configuredSkinCode(landing, provider);
    if (provider === "multi_skin" && !skinCode) return json({ error: "integration_pending" }, 503);
    // La atribucion puede venir del navegador; esta dimension se fija desde la landing guardada.
    payload.attribution = {
      ...payload.attribution,
      target_provider: provider,
      ...(skinCode ? { skin_code: skinCode } : {}),
    };
    if (!contextResolved) {
      if (await bounded(deps.db.blocked(landing.user_id))) return json({ error: "landing_unavailable" }, 403);
      if (!await bounded(deps.allowStart(request, landing.id, identity.deviceId, identity.needsCookie))) {
        const response = json({ error: "rate_limited" }, 429);
        response.headers.set("Retry-After", "45");
        return response;
      }
      const assignment = await bounded(deps.db.assignment(landing.id, payload.atrio_client_id));
      const advisor = assignment ? await bounded(deps.db.advisor(assignment.atrio_client_id)) : null;
      if (!assignment || !advisor || assignment.user_id !== landing.user_id || advisor.user_id !== landing.user_id ||
          advisor.workspace_currency !== landing.workspace_currency || advisor.id !== payload.atrio_client_id ||
          advisor.atrio_id !== payload.advisor_id || advisor.slug !== payload.advisor_slug) {
        return json({ error: "advisor_not_assigned" }, 403);
      }
      assigned = { atrioClientId: advisor.id, advisorId: advisor.atrio_id, advisorSlug: advisor.slug };
    }
    if (!assigned) throw new Error("advisor resolution unavailable");
    const resolvedAdvisor = assigned;
    if (demoConfig && !demoConfig.advisorIds.has(resolvedAdvisor.advisorId.toLowerCase())) return json({ error: "demo_not_authorized" }, 403);
    const gatewayPending = deps.gatewayStatus(provider);
    if (gatewayPending) return json({ error: gatewayPending }, 503);
    if (!demoConfig) {
      const pending = deps.api2Status();
      if (pending) return json({ error: pending }, 503);
    }
    const effectiveDeviceId = demoConfig ? demoConfig.deviceId : identity.deviceId;
    const resolveInput: PlayerResolveRequest = { advisor: resolvedAdvisor, deviceId: effectiveDeviceId, name: payload.name,
      landingId: landing.id, landingSlug: landing.name, promoCode: payload.promo_code, targetProvider: provider };
    const player = validateResolvedPlayer(await timedServerStage(
      "template7_start",
      "internal_chat_resolve",
      () => deps.resolvePlayer(resolveInput),
    ), resolveInput);
    let account: TargetAccount = demoConfig
      ? provider === "rey_de_ases"
        ? { username: demoConfig.username, password: demoConfig.password, platform: provider, created: false }
        : { username: "", password: "", platform: provider, created: false, testingBypass: true }
      : await timedServerStage("template7_start", "account_resolve", () => deps.resolveAccount({
          external_user_id: player.player_id,
          name: payload.name,
          target_provider: provider,
          advisor_id: resolvedAdvisor.advisorId,
          advisor_slug: resolvedAdvisor.advisorSlug,
          ...(skinCode ? { skin_code: skinCode } : {}),
        }));
    if (account.platform !== provider || (!account.testingBypass && (!account.username || !account.password))) {
      throw new TargetIntegrationError("upstream_unavailable");
    }
    if (account.testingBypass) {
      const handoff = await timedServerStage(
        "template7_start",
        "gateway_handoff",
        () => deps.createHandoff(provider, resolvedAdvisor, effectiveDeviceId, player, account, skinCode, true),
      );
      if (!handoff.provider_username) throw new TargetIntegrationError("upstream_unavailable");
      account = { ...account, username: handoff.provider_username };
      await timedServerStage(
        "template7_start",
        "internal_chat_account_link",
        () => deps.linkProviderAccount(resolvedAdvisor, player, account),
      );
      return json({ handoff_url: handoff.handoff_url }, 200);
    }
    const [, handoff] = await Promise.all([
      timedServerStage(
        "template7_start",
        "internal_chat_account_link",
        () => deps.linkProviderAccount(resolvedAdvisor, player, account),
      ),
      timedServerStage(
        "template7_start",
        "gateway_handoff",
        () => deps.createHandoff(provider, resolvedAdvisor, effectiveDeviceId, player, account, skinCode, false),
      ),
    ]);
    return json({ handoff_url: handoff.handoff_url }, 200);
  } catch (error) {
    if (error instanceof TargetIntegrationError) return json({ error: error.code }, 503);
    return json({ error: "service_unavailable" }, 503);
  } finally {
    logServerFlowTotal("template7_start", flowStartedAt);
  }
}

export async function handleTemplate7Start(request: Request, deps: StartDependencies): Promise<Response> {
  const identity = getOrCreateClientIdentity(request);
  return handleTemplate7StartWithIdentity(request, deps, identity);
}

/**
 * Variante privada para recorridos servidor-a-servidor que ya resolvieron el
 * identificador HttpOnly. No debe exponerse directamente al navegador.
 */
export async function handleTemplate7StartWithIdentity(
  request: Request,
  deps: StartDependencies,
  identity: ClientIdentity,
): Promise<Response> {
  const response = await handleTemplate7StartInner(request, deps, identity);
  // Una respuesta 429 sin cookie no puede pisar el CID de una solicitud concurrente exitosa.
  return withClientIdentityCookie(response,
    response.status === 429 ? { ...identity, needsCookie: false } : identity);
}

/** Ruta histórica, conservada para landings ya publicadas. */
export const handleReyStart = handleTemplate7Start;

function productionDb(): StartDb {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("server database unavailable");
  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  return {
    async landing(id) {
      const { data, error } = await supabase.from("landings").select("id,name,user_id,workspace_currency,config,landing_config").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as LandingRow | null;
    },
    async assignment(landingId, atrioClientId) {
      const { data, error } = await supabase.from("landings_atrio_clients").select("landing_id,atrio_client_id,user_id")
        .eq("landing_id", landingId).eq("atrio_client_id", atrioClientId).maybeSingle();
      if (error) throw error;
      return data as AssignmentRow | null;
    },
    async advisor(atrioClientId) {
      const { data, error } = await supabase.from("atrio_clients").select("id,user_id,workspace_currency,slug,atrio_id").eq("id", atrioClientId).maybeSingle();
      if (error) throw error;
      return data as AdvisorRow | null;
    },
    async blocked(userId) {
      const { data, error } = await supabase.rpc("is_client_access_blocked", { p_user_id: userId });
      if (error) throw error;
      return data === true;
    },
  };
}

function productionContextResolver() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("server database unavailable");
  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  return async (request: Request, payload: StartRequest, identity: ClientIdentity): Promise<ResolvedStartContext> => {
    const keys = template7StartRateLimitKeys(request, payload.landing_id, identity.deviceId, identity.needsCookie);
    const { data, error } = await supabase.rpc("resolve_template7_start_context", {
      p_landing_id: payload.landing_id,
      p_landing_slug: payload.landing_slug,
      p_atrio_client_id: payload.atrio_client_id,
      p_advisor_id: payload.advisor_id,
      p_advisor_slug: payload.advisor_slug,
      p_global_bucket_key: keys.global,
      p_start_bucket_key: keys.start,
      p_unbound_bucket_key: keys.unbound,
    });
    if (error || !Array.isArray(data) || data.length !== 1) throw error || new Error("invalid start context response");
    const row = data[0] as Record<string, unknown>;
    const knownStatuses = new Set<StartContextStatus>([
      "ok", "landing_not_found", "integration_pending", "landing_unavailable", "rate_limited", "advisor_not_assigned",
    ]);
    if (typeof row.status !== "string" || !knownStatuses.has(row.status as StartContextStatus)) throw new Error("invalid start context status");
    if (row.status !== "ok") return { status: row.status as StartContextStatus };
    const provider = row.target_provider;
    if ((provider !== "rey_de_ases" && provider !== "multi_skin") ||
        typeof row.landing_id !== "string" || typeof row.landing_name !== "string" ||
        typeof row.owner_user_id !== "string" || typeof row.workspace_currency !== "string" ||
        typeof row.atrio_client_id !== "string" || typeof row.advisor_id !== "string" || typeof row.advisor_slug !== "string") {
      throw new Error("invalid start context response");
    }
    return {
      status: "ok",
      provider,
      landing: {
        id: row.landing_id,
        name: row.landing_name,
        user_id: row.owner_user_id,
        workspace_currency: row.workspace_currency,
        config: row.landing_config_raw,
        landing_config: row.landing_config_published,
      },
      advisor: {
        id: row.atrio_client_id,
        user_id: row.owner_user_id,
        workspace_currency: row.workspace_currency,
        atrio_id: row.advisor_id,
        slug: row.advisor_slug,
      },
    };
  };
}

export function productionDependencies(): StartDependencies {
  return {
    db: productionDb(),
    resolveContext: productionContextResolver(),
    api2Status: api2Readiness,
    gatewayStatus: gatewayReadiness,
    allowStart: allowTemplate7Start,
    demoConfig: readDemoConfig,
    resolvePlayer: resolveInternalChatPlayer,
    resolveAccount: resolveTargetAccount,
    linkProviderAccount: linkInternalChatProviderAccount,
    createHandoff: createProviderHandoff,
  };
}
