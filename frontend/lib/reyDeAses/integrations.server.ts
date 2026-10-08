import type { AssignedAdvisor, Api2ResolveAccountRequest, HandoffResult, TargetAccount, ResolvedPlayer, PlayerResolveRequest } from "./contracts";
import type { TargetProvider } from "../landing/types";
import { isDeviceId } from "./clientIdentity.server";

export class TargetIntegrationError extends Error {
  constructor(public readonly code: "integration_pending" | "upstream_unavailable") {
    super(code);
  }
}

function configuredOrigin(raw: string | undefined): URL {
  if (!raw) throw new TargetIntegrationError("integration_pending");
  try {
    const origin = new URL(raw);
    if (origin.protocol !== "https:" && !(origin.protocol === "http:" && ["localhost", "127.0.0.1"].includes(origin.hostname))) {
      throw new Error("unsafe origin");
    }
    if (origin.pathname !== "/" || origin.search || origin.hash || origin.username || origin.password) throw new Error("origin only");
    return origin;
  } catch {
    throw new TargetIntegrationError("integration_pending");
  }
}

async function postJson(origin: URL, path: string, key: string | undefined, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!key) throw new TargetIntegrationError("integration_pending");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(new URL(path, origin), {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
      redirect: "error",
    });
    if (!response.ok) throw new TargetIntegrationError("upstream_unavailable");
    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new TargetIntegrationError("upstream_unavailable");
    return data as Record<string, unknown>;
  } catch (error) {
    if (error instanceof TargetIntegrationError) throw error;
    throw new TargetIntegrationError("upstream_unavailable");
  } finally {
    clearTimeout(timer);
  }
}

export function api2Readiness(): "integration_pending" {
  // API2 aún no publicó el endpoint idempotente ni su ruta contractual.
  return "integration_pending";
}

export function gatewayReadiness(provider: TargetProvider): "integration_pending" | null {
  return provider === "multi_skin" ? "integration_pending" : null;
}

export async function resolveInternalChatPlayer(input: PlayerResolveRequest): Promise<ResolvedPlayer> {
  const origin = configuredOrigin(process.env.INTERNAL_CHAT_ORIGIN);
  const result = await postJson(origin, "/api/gateway/players/resolve", process.env.INTERNAL_CHAT_PLAYER_RESOLVE_KEY, {
    advisor_id: input.advisor.advisorId,
    advisor_slug: input.advisor.advisorSlug,
    device_id: input.deviceId,
    name: input.name,
    landing_id: input.landingId,
    landing_slug: input.landingSlug,
    atrio_client_id: input.advisor.atrioClientId,
    promo_code: input.promoCode,
    source: "landing_builder",
  });
  if (result.advisor_id !== input.advisor.advisorId || result.advisor_slug !== input.advisor.advisorSlug ||
      !isDeviceId(result.player_id) || !isDeviceId(result.device_id) || result.device_id !== input.deviceId ||
      typeof result.created !== "boolean") {
    throw new TargetIntegrationError("upstream_unavailable");
  }
  return result as ResolvedPlayer;
}

export async function resolveTargetAccount(_request: Api2ResolveAccountRequest): Promise<TargetAccount> {
  void _request;
  // PENDIENTE: API2 debe confirmar la ruta, autenticación e idempotencia de
  // external_user_id=player_id. Nunca fabricar usuario/contraseña de prueba.
  throw new TargetIntegrationError("integration_pending");
}

export async function createProviderHandoff(provider: TargetProvider, advisor: AssignedAdvisor, deviceId: string, player: ResolvedPlayer, account: TargetAccount): Promise<HandoffResult> {
  if (provider === "multi_skin") throw new TargetIntegrationError("integration_pending");
  const origin = configuredOrigin(process.env.REY_GATEWAY_ORIGIN);
  if (account.platform !== provider || !account.username || !account.password) throw new TargetIntegrationError("upstream_unavailable");
  const result = await postJson(origin, "/api/handoffs", process.env.REY_GATEWAY_HANDOFF_API_KEY, {
    advisor_id: advisor.advisorId,
    advisor_slug: advisor.advisorSlug,
    device_id: deviceId,
    external_user_id: player.player_id,
    platform: "rey_de_ases",
    username: account.username,
    password: account.password,
    target_path: "/casino/list/home",
  });
  try {
    const url = new URL(String(result.handoff_url ?? ""));
    if (url.origin !== origin.origin || url.pathname !== "/start" || url.username || url.password || url.hash ||
        url.searchParams.size !== 1 || url.searchParams.getAll("t").length !== 1 || !url.searchParams.get("t")) {
      throw new Error("unexpected handoff");
    }
    if (typeof result.expires_at !== "string" || typeof result.binding_created !== "boolean") throw new Error("invalid handoff");
    return result as HandoffResult;
  } catch {
    throw new TargetIntegrationError("upstream_unavailable");
  }
}
