import type { AssignedAdvisor, Api2ResolveAccountRequest, HandoffResult, LinkedProviderAccount, TargetAccount, ResolvedPlayer, PlayerResolveRequest } from "./contracts";
import type { MultiSkinCode, TargetProvider } from "../landing/types";
import { isDeviceId } from "./clientIdentity.server";
import { gatewayOriginFor } from "./gatewayOrigins";

export class TargetIntegrationError extends Error {
  constructor(public readonly code: "integration_pending" | "upstream_unavailable", public readonly retryable = code === "upstream_unavailable") {
    super(code);
  }
}

const API2_PLATFORM_BY_PROVIDER: Record<TargetProvider, number> = {
  ases_del_norte: 1,
  ganamos_net: 2,
  rey_de_ases: 5,
  multi_skin: 7,
};

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

export function api2Readiness(): "integration_pending" | null {
  try {
    configuredOrigin(process.env.API2_ORIGIN);
  } catch {
    return "integration_pending";
  }
  return process.env.API2_API_KEY && process.env.API2_API_SECRET ? null : "integration_pending";
}

export function gatewayReadiness(provider: TargetProvider): "integration_pending" | null {
  if (provider === "multi_skin" && !process.env.MULTI_SKIN_GATEWAY_ORIGIN) return "integration_pending";
  if (provider === "ases_del_norte" && !process.env.ASES_DEL_NORTE_GATEWAY_ORIGIN) return "integration_pending";
  if (provider === "ganamos_net" && !process.env.GANAMOS_NET_GATEWAY_ORIGIN) return "integration_pending";
  return null;
}

function gatewayApiKey(provider: TargetProvider): string | undefined {
  if (provider === "multi_skin") {
    return process.env.MULTI_SKIN_GATEWAY_HANDOFF_API_KEY;
  }
  if (provider === "ases_del_norte") {
    return process.env.ASES_DEL_NORTE_GATEWAY_HANDOFF_API_KEY;
  }
  if (provider === "ganamos_net") {
    return process.env.GANAMOS_NET_GATEWAY_HANDOFF_API_KEY;
  }
  return process.env.REY_GATEWAY_HANDOFF_API_KEY;
}

export function validateResolvedPlayer(result: unknown, input: Pick<PlayerResolveRequest, "advisor" | "deviceId" | "targetProvider">): ResolvedPlayer {
  if (!result || typeof result !== "object" || Array.isArray(result)) throw new TargetIntegrationError("upstream_unavailable", false);
  const player = result as Record<string, unknown>;
  if (player.advisor_id !== input.advisor.advisorId || player.advisor_slug !== input.advisor.advisorSlug ||
      !isDeviceId(player.player_id) || !isDeviceId(player.device_id) || player.device_id !== input.deviceId ||
      !isDeviceId(player.player_provider_account_id) || player.target_provider !== input.targetProvider ||
      typeof player.created !== "boolean" || typeof player.provider_account_created !== "boolean") {
    throw new TargetIntegrationError("upstream_unavailable", false);
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
    ...(input.phone ? { phone: input.phone } : {}),
    landing_id: input.landingId,
    landing_slug: input.landingSlug,
    atrio_client_id: input.advisor.atrioClientId,
    promo_code: input.promoCode,
    target_provider: input.targetProvider,
    source: "landing_builder",

  });
  return validateResolvedPlayer(result, input);
}

export async function resolveTargetAccount(request: Api2ResolveAccountRequest): Promise<TargetAccount> {
  if (!Number.isSafeInteger(request.agency_id) || Number(request.agency_id)<=0 || !Number.isSafeInteger(request.manager_id) || Number(request.manager_id)<=0) throw new TargetIntegrationError("integration_pending");
  if (api2Readiness()) throw new TargetIntegrationError("integration_pending");
  const origin = configuredOrigin(process.env.API2_ORIGIN);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 35_000);
  try {
    const response = await fetch(
      new URL(`/api/v1/bot/managers/${request.manager_id}/players`, origin),
      {
        method: "POST",
        headers: {
          apikey: process.env.API2_API_KEY!,
          apisecret: process.env.API2_API_SECRET!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ external_user_id: request.external_user_id, name: request.name, advisor_id: request.advisor_id, agency_id:request.agency_id,
          ...(["ganamos_net", "multi_skin"].includes(request.target_provider) ? {creation_mode: "create_only"} : {}),
        }),
        signal: controller.signal,
        cache: "no-store",
        redirect: "error",
      },
    );
    if (!response.ok) {
      const failure = await response.json().catch(() => null);
      const retryable = failure?.error?.retryable === true ||
        (failure?.error?.retryable !== false && [408, 429, 500, 502, 503, 504].includes(response.status));
      throw new TargetIntegrationError("upstream_unavailable", retryable);
    }
    const result: unknown = await response.json();
    if (!result || typeof result !== "object" || Array.isArray(result)) {
      throw new TargetIntegrationError("upstream_unavailable");
    }
    const data = result as Record<string, unknown>;
    const username = typeof data.username === "string" ? data.username.trim() : "";
    const password = typeof data.password === "string" ? data.password : "";
    const created = typeof data.is_new === "boolean" ? data.is_new
      : typeof data.isNew === "boolean" ? data.isNew : null;
    if (data.success !== true || !username || username.length > 256 || /[\x00-\x1f\x7f]/.test(username) ||
        !password || password.length > 256 || /[\x00-\x1f\x7f]/.test(password) || created === null ||
        data.platform !== API2_PLATFORM_BY_PROVIDER[request.target_provider]) {
      throw new TargetIntegrationError("upstream_unavailable");
    }
    return { username, password, platform: request.target_provider, created, externalAccountId: request.external_user_id };
  } catch (error) {
    if (error instanceof TargetIntegrationError) throw error;
    throw new TargetIntegrationError("upstream_unavailable");
  } finally {
    clearTimeout(timer);
  }
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
  promoCode?: string,
): Promise<HandoffResult> {
  const origin = configuredOrigin(gatewayOriginFor(provider, skinCode));
  if (player.target_provider !== provider || !isDeviceId(player.player_provider_account_id) ||
      account.platform !== provider || (provider === "multi_skin" && !skinCode) ||
      (!account.username || !account.password)) {
    throw new TargetIntegrationError("upstream_unavailable");
  }
  const result = await postJson(
    origin,
    "/api/handoffs",
    gatewayApiKey(provider),
    {
    advisor_id: advisor.advisorId,
    advisor_slug: advisor.advisorSlug,
    device_id: deviceId,
    external_user_id: player.player_id,
    player_provider_account_id: player.player_provider_account_id,
    target_provider: player.target_provider,
    ...(promoCode ? { promo_code: promoCode } : {}),
    ...(provider === "rey_de_ases" ? {
      platform: "rey_de_ases",
      username: account.username,
      password: account.password,
      target_path: "/casino/list/home",
    } : provider === "multi_skin" ? {
      skin_code: skinCode,
      username: account.username, password: account.password,
    } : {
      username: account.username, password: account.password,
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
