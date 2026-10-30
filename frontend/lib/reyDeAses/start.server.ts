import { confirmTemplate8Destination } from "../atrio/template7Destination.server";
import { template8Provider, template8SkinCode } from "../landing/template8";
import { createClient } from "@supabase/supabase-js";
import type { MultiSkinCode, TargetProvider } from "../landing/types";
import { isMultiSkinCode } from "../multi-skin-catalog";
import type { AssignedAdvisor, Api2ResolveAccountRequest, HandoffResult, LinkedProviderAccount, TargetAccount, ResolvedPlayer, StartRequest, PlayerResolveRequest } from "./contracts";
import { getOrCreateClientIdentity, withClientIdentityCookie, type ClientIdentity } from "./clientIdentity.server";
import { logServerFlowTotal, timedServerStage, template7ServerTiming, type Template7StageTimings } from "./performance.server";
import { allowTemplate7Start, template7StartRateLimitKeys } from "./rateLimit.server";
import { api2Readiness, createProviderHandoff, gatewayReadiness, linkInternalChatProviderAccount, resolveInternalChatPlayer, resolveTargetAccount, TargetIntegrationError, validateResolvedPlayer } from "./integrations.server";
import { parseTemplate7StartPayload } from "./start-payload.server";
export { parseTemplate7StartPayload } from "./start-payload.server";

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
  resolvePlayer(input: PlayerResolveRequest): Promise<ResolvedPlayer>;
  resolveAccount(request: Api2ResolveAccountRequest): Promise<TargetAccount>;
  linkProviderAccount(advisor: AssignedAdvisor, player: ResolvedPlayer, account: TargetAccount): Promise<LinkedProviderAccount>;
  createHandoff(provider: TargetProvider, advisor: AssignedAdvisor, deviceId: string, player: ResolvedPlayer, account: TargetAccount, skinCode: MultiSkinCode | null, promoCode?: string): Promise<HandoffResult>;
};

export type Template7PreparedStart = {
  provider: TargetProvider;
  advisor: AssignedAdvisor;
  deviceId: string;
  player: ResolvedPlayer;
  account: TargetAccount;
  skinCode: MultiSkinCode | null;
  promoCode: string;
  completedHandoff?: HandoffResult;
  accountResolutionMs?: number;
  stageTimings?: Template7StageTimings;
};

type AccountReadyResponder = (
  prepared: Template7PreparedStart,
) => Response | Promise<Response>;

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

export function isTemplate7Landing(landing: LandingRow): boolean {
  const raw = landing.config && typeof landing.config === "object" ? landing.config as Record<string, unknown> : {};
  const published = landing.landing_config && typeof landing.landing_config === "object"
    ? landing.landing_config as Record<string, unknown> : {};
  const layout = published.layout && typeof published.layout === "object" ? published.layout as Record<string, unknown> : {};
  return (raw.template === "template7" || raw.template === "template8" || layout.template === 7) && raw.ctaDestination === "atrio";
}

export function configuredTargetProvider(landing: LandingRow): TargetProvider | null {
  const raw = landing.config && typeof landing.config === "object" ? landing.config as Record<string, unknown> : {};
  // Landings 7 antiguas no tenian selector: se conserva Rey de Ases.
  if (raw.targetProvider === undefined || raw.targetProvider === null) return "rey_de_ases";
  if (raw.targetProvider === "rey_de_ases" || raw.targetProvider === "multi_skin" || raw.targetProvider === "ases_del_norte" || raw.targetProvider === "ganamos_net") return raw.targetProvider;
  return null;
}

export function configuredSkinCode(landing: LandingRow, provider: TargetProvider, cardIndex?: unknown): MultiSkinCode | null {
  if (provider !== "multi_skin") return null;
  const raw = landing.config && typeof landing.config === "object" ? landing.config as Record<string, unknown> : {};
  if (raw.template === "template8") return template8SkinCode(landing.config, cardIndex);
  // Antes del selector solo existia Ganamos+, por lo que esa configuracion
  // historica puede migrarse sin cambiar el destino del jugador.
  if (raw.multiSkinCode === undefined || raw.multiSkinCode === null) return "ganamos_plus";
  return isMultiSkinCode(raw.multiSkinCode) ? raw.multiSkinCode : null;
}

async function bounded<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("timeout")), 7000);
    })]);
  } finally { if (timer) clearTimeout(timer); }
}

export async function finalizeTemplate7PreparedStart(
  prepared: Template7PreparedStart,
  deps: StartDependencies,
): Promise<HandoffResult> {
  if (prepared.completedHandoff) return prepared.completedHandoff;
  const timings = prepared.stageTimings ??= {};
  const startedAt = performance.now();
  const [, handoff] = await Promise.all([
    timedServerStage(
      "template7_start",
      "internal_chat_account_link",
      () => deps.linkProviderAccount(prepared.advisor, prepared.player, prepared.account),
      ms => { timings.link = ms; },
    ),
    timedServerStage(
      "template7_start",
      "gateway_handoff",
      () => deps.createHandoff(
        prepared.provider,
        prepared.advisor,
        prepared.deviceId,
        prepared.player,
        prepared.account,
        prepared.skinCode,
        prepared.promoCode,
      ),
      ms => { timings.handoff = ms; },
    ),
  ]);
  timings.finalize = Math.round(performance.now() - startedAt);
  return handoff;
}

async function handleTemplate7StartInner(
  request: Request,
  deps: StartDependencies,
  identity: ClientIdentity,
  accountReadyResponder?: AccountReadyResponder,
): Promise<Response> {
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
  const stageTimings: Template7StageTimings = {};
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
        ms => { stageTimings.context = ms; },
      ));
      if (context.status !== "ok") {
        const status = context.status === "landing_not_found" ? 404
          : context.status === "landing_unavailable" || context.status === "advisor_not_assigned" ? 403
            : context.status === "rate_limited" ? 429 : 503;
        const response = json({ error: context.status }, status);
        if (context.status === "rate_limited") response.headers.set("Retry-After", "10");
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
      const candidateProvider = (landing.config as { template?: string })?.template === "template8" ? template8Provider(landing.config, payload.card_index) : configuredTargetProvider(landing);
      if (!candidateProvider) return json({ error: "integration_pending" }, 503);
      provider = candidateProvider;
    }
    const skinCode = configuredSkinCode(landing, provider, payload.card_index);
    if (provider === "multi_skin" && !skinCode) return json({ error: "integration_pending" }, 503);
    // La atribucion puede venir del navegador; esta dimension se fija desde la landing guardada.
    payload.attribution = {
      ...payload.attribution,
      target_provider: provider,
      ...(payload.card_index ? { card_index: String(payload.card_index) } : {}),
      ...(skinCode ? { skin_code: skinCode } : {}),
    };
    if (!contextResolved) {
      if (await bounded(deps.db.blocked(landing.user_id))) return json({ error: "landing_unavailable" }, 403);
      if (!await bounded(deps.allowStart(request, landing.id, identity.deviceId, identity.needsCookie))) {
        const response = json({ error: "rate_limited" }, 429);
        response.headers.set("Retry-After", "10");
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
    const gatewayPending = deps.gatewayStatus(provider);
    if (gatewayPending) return json({ error: gatewayPending }, 503);
    const pending = deps.api2Status();
    if (pending) return json({ error: pending }, 503);
    const effectiveDeviceId = identity.deviceId;
    const resolveInput: PlayerResolveRequest = { advisor: resolvedAdvisor, deviceId: effectiveDeviceId, name: payload.name,
      ...(payload.phone ? { phone: payload.phone } : {}),
      landingId: landing.id, landingSlug: landing.name, promoCode: payload.promo_code, targetProvider: provider };
    const player = validateResolvedPlayer(await timedServerStage(
      "template7_start",
      "internal_chat_resolve",
      () => deps.resolvePlayer(resolveInput),
      ms => { stageTimings.identity = ms; },
    ), resolveInput);
    const accountStartedAt = performance.now();
    const account = await timedServerStage("template7_start", "account_resolve", () => deps.resolveAccount({
      external_user_id: player.player_id, manager_id: player.manager_id, agency_id: player.agency_id,
      name: payload.name, target_provider: provider, advisor_id: resolvedAdvisor.advisorId,
      advisor_slug: resolvedAdvisor.advisorSlug, ...(skinCode ? { skin_code: skinCode } : {}),
    }));
    if (account.platform !== provider || (!account.username || !account.password)) {
      throw new TargetIntegrationError("upstream_unavailable");
    }
    const prepared: Template7PreparedStart = {
      provider,
      advisor: resolvedAdvisor,
      deviceId: effectiveDeviceId,
      player,
      account,
      skinCode,
      promoCode: payload.promo_code,
      accountResolutionMs: Math.round(performance.now() - accountStartedAt),
      stageTimings,
    };
    const response = accountReadyResponder ? await accountReadyResponder(prepared)
      : json({ handoff_url: (await finalizeTemplate7PreparedStart(prepared, deps)).handoff_url }, 200);
    stageTimings.total = Math.round(performance.now() - flowStartedAt);
    response.headers.set("Server-Timing", template7ServerTiming(prepared.accountResolutionMs!, account.created, stageTimings));
    return response;
  } catch (error) {
    if (error instanceof TargetIntegrationError) return json({ error: error.code, retryable: error.retryable }, 503);
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

export async function handleTemplate7AccountWithIdentity(
  request: Request,
  deps: StartDependencies,
  identity: ClientIdentity,
  responder: AccountReadyResponder,
): Promise<Response> {
  const response = await handleTemplate7StartInner(request, deps, identity, responder);
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
    const { data, error } = await supabase.rpc(payload.card_index ? "resolve_template8_start_context" : "resolve_template7_start_context", {
      ...(payload.card_index ? { p_card_index: payload.card_index } : {}),
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
    if (payload.card_index && !(await confirmTemplate8Destination(String(row.landing_id), String(row.target_provider), identity.deviceId, payload.advisor_id))) return { status: "advisor_not_assigned" };
    const provider = row.target_provider;
    if ((provider !== "rey_de_ases" && provider !== "multi_skin" && provider !== "ases_del_norte" && provider !== "ganamos_net") ||
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
    resolvePlayer: resolveInternalChatPlayer,
    resolveAccount: resolveTargetAccount,
    linkProviderAccount: linkInternalChatProviderAccount,
    createHandoff: createProviderHandoff,
  };
}
