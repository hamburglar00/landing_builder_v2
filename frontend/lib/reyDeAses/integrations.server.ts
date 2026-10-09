import type { AssignedAdvisor, Api2ResolveAccountRequest, HandoffResult, LinkedProviderAccount, TargetAccount, ResolvedPlayer, PlayerResolveRequest } from "./contracts";
import type { MultiSkinCode, TargetProvider } from "../landing/types";
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
  return provider === "multi_skin" && !process.env.MULTI_SKIN_GATEWAY_ORIGIN ? "integration_pending" : null;
}

export function validateResolvedPlayer(result: unknown, input: Pick<PlayerResolveRequest, "advisor" | "deviceId" | "targetProvider">): ResolvedPlayer {
  if (!result || typeof result !== "object" || Array.isArray(result)) throw new TargetIntegrationError("upstream_unavailable");
  const player = result as Record<string, unknown>;
  if (player.advisor_id !== input.advisor.advisorId || player.advisor_slug !== input.advisor.advisorSlug ||
      !isDeviceId(player.player_id) || !isDeviceId(player.device_id) || player.device_id !== input.deviceId ||
      !isDeviceId(player.player_provider_account_id) || player.target_provider !== input.targetProvider ||
      typeof player.created !== "boolean" || typeof player.provider_account_created !== "boolean") {
    throw new TargetIntegrationError("upstream_unavailable");
  }
  return player as ResolvedPlayer;
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
    target_provider: input.targetProvider,
    source: "landing_builder",
  });
  return validateResolvedPlayer(result, input);
}

export async function resolveTargetAccount(_request: Api2ResolveAccountRequest): Promise<TargetAccount> {
  void _request;
  // PENDIENTE: API2 debe confirmar la ruta, autenticación e idempotencia de
  // external_user_id=player_id. Nunca fabricar usuario/contraseña de prueba.
  throw new TargetIntegrationError("integration_pending");
}

export async function linkInternalChatProviderAccount(
  advisor: AssignedAdvisor,
  player: ResolvedPlayer,
  account: TargetAccount,
): Promise<LinkedProviderAccount> {
  if (
    player.advisor_id !== advisor.advisorId ||
    player.advisor_slug !== advisor.advisorSlug ||
    player.target_provider !== account.platform ||
    !isDeviceId(player.player_id) ||
    !isDeviceId(player.player_provider_account_id) ||
    !account.username
  ) {
    throw new TargetIntegrationError("upstream_unavailable");
  }

  const origin = configuredOrigin(process.env.INTERNAL_CHAT_ORIGIN);
  const result = await postJson(
    origin,
    "/api/gateway/provider-accounts/link",
    process.env.INTERNAL_CHAT_PLAYER_RESOLVE_KEY,
    {
      advisor_id: advisor.advisorId,
      advisor_slug: advisor.advisorSlug,
      player_id: player.player_id,
      player_provider_account_id: player.player_provider_account_id,
      target_provider: player.target_provider,
      provider_username: account.username,
      ...(account.externalAccountId
        ? { provider_external_account_id: account.externalAccountId }
        : {}),
      source: "landing_builder",
    },
  );

  if (
    result.player_provider_account_id !== player.player_provider_account_id ||
    result.target_provider !== player.target_provider ||
    result.provider_username !== account.username ||
    result.provider_external_account_id !== (account.externalAccountId ?? null)
  ) {
    throw new TargetIntegrationError("upstream_unavailable");
  }

  return result as LinkedProviderAccount;
}

export async function createProviderHandoff(
  provider: TargetProvider,
  advisor: AssignedAdvisor,
  deviceId: string,
  player: ResolvedPlayer,
  account: TargetAccount,
  skinCode: MultiSkinCode | null = null,
  testing = false,
): Promise<HandoffResult> {
  const origin = configuredOrigin(provider === "multi_skin" ? process.env.MULTI_SKIN_GATEWAY_ORIGIN : process.env.REY_GATEWAY_ORIGIN);
  if (player.target_provider !== provider || !isDeviceId(player.player_provider_account_id) ||
      account.platform !== provider || (provider === "multi_skin" && !skinCode) ||
      (!testing && (!account.username || !account.password)) || (testing && provider !== "multi_skin")) {
    throw new TargetIntegrationError("upstream_unavailable");
  }
  const result = await postJson(
    origin,
    provider === "multi_skin" && testing ? "/api/testing/handoffs" : "/api/handoffs",
    provider === "multi_skin"
      ? testing ? process.env.MULTI_SKIN_GATEWAY_TESTING_API_KEY : process.env.MULTI_SKIN_GATEWAY_HANDOFF_API_KEY
      : process.env.REY_GATEWAY_HANDOFF_API_KEY,
    {
    advisor_id: advisor.advisorId,
    advisor_slug: advisor.advisorSlug,
    device_id: deviceId,
    external_user_id: player.player_id,
    player_provider_account_id: player.player_provider_account_id,
    target_provider: player.target_provider,
    ...(provider === "rey_de_ases" ? {
      platform: "rey_de_ases",
      username: account.username,
      password: account.password,
      target_path: "/casino/list/home",
    } : {
      skin_code: skinCode,
      ...(!testing ? { username: account.username, password: account.password } : {}),
    }),
  });
  try {
    const url = new URL(String(result.handoff_url ?? ""));
    if (url.origin !== origin.origin || url.pathname !== "/start" || url.username || url.password || url.hash ||
        url.searchParams.size !== 1 || url.searchParams.getAll("t").length !== 1 || !url.searchParams.get("t")) {
      throw new Error("unexpected handoff");
    }
    if (provider === "rey_de_ases") {
      if (typeof result.expires_at !== "string" || typeof result.binding_created !== "boolean") throw new Error("invalid handoff");
    } else {
      if (!Number.isInteger(result.expires_in) || Number(result.expires_in) < 60 || Number(result.expires_in) > 300) throw new Error("invalid handoff");
      if (testing && (typeof result.provider_username !== "string" || !result.provider_username.trim())) throw new Error("invalid handoff");
    }
    return {
      handoff_url: String(result.handoff_url),
      expires_at: typeof result.expires_at === "string" ? result.expires_at : "",
      binding_created: result.binding_created === true,
      ...(typeof result.provider_username === "string" ? { provider_username: result.provider_username } : {}),
    };
  } catch {
    throw new TargetIntegrationError("upstream_unavailable");
  }
}
