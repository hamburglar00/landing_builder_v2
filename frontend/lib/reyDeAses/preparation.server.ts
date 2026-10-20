import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto";
import { CLIENT_ID_COOKIE_NAME, isDeviceId } from "./clientIdentity.server";
import { finalizeTemplate7PreparedStart, handleTemplate7AccountWithIdentity, handleTemplate7StartWithIdentity, productionDependencies, type StartDependencies, type Template7PreparedStart } from "./start.server";
import { decryptClaims, encryptionKey, gatewayOrigin, json, readJson, requireSecret, TOKEN_TTL_SECONDS, MAX_TOKEN_LENGTH, type PreparationEnvironment } from "./preparation-issue.server";
export { handleTemplate7Prepare } from "./preparation-issue.server";

const CONTINUATION_VERSION = "c1";
const CONTINUATION_AAD = "landing-builder:template7-account-continuation:v1";

type ContinuationClaims = {
  version: 1;
  issued_at: number;
  expires_at: number;
  prepared: Template7PreparedStart;
};

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isPreparedStart(value: unknown, env: PreparationEnvironment): value is Template7PreparedStart {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prepared = value as Template7PreparedStart;
  if (!["rey_de_ases", "multi_skin", "ases_del_norte", "ganamos_net"].includes(prepared.provider) ||
      !prepared.advisor || !isUuid(prepared.advisor.atrioClientId) || !isUuid(prepared.advisor.advisorId) ||
      typeof prepared.advisor.advisorSlug !== "string" || !/^[a-z0-9][a-z0-9_-]{0,80}$/i.test(prepared.advisor.advisorSlug) ||
      !isUuid(prepared.deviceId) || !prepared.player || !isUuid(prepared.player.player_id) ||
      !isUuid(prepared.player.device_id) || prepared.player.device_id !== prepared.deviceId ||
      !isUuid(prepared.player.player_provider_account_id) || prepared.player.target_provider !== prepared.provider ||
      typeof prepared.player.created !== "boolean" || typeof prepared.player.provider_account_created !== "boolean" ||
      !prepared.account || prepared.account.platform !== prepared.provider ||
      typeof prepared.account.username !== "string" || !prepared.account.username || prepared.account.username.length > 256 ||
      typeof prepared.account.password !== "string" || prepared.account.password.length > 1024 ||
      typeof prepared.account.created !== "boolean" || Reflect.get(prepared, "testing") === true ||
      typeof prepared.promoCode !== "string" || !prepared.promoCode || prepared.promoCode.length > 128 ||
      (prepared.provider === "multi_skin" ? prepared.skinCode !== "ganamos_plus" : prepared.skinCode !== null) ||
      !prepared.account.password || Reflect.get(prepared.account, "testingBypass") === true) {
    return false;
  }
  if (!prepared.completedHandoff) return true;
  try {
    const url = new URL(prepared.completedHandoff.handoff_url);
    const expected = gatewayOrigin({
      landing_id: "00000000-0000-4000-8000-000000000000",
      landing_slug: "continuation",
      name: "continuation",
      atrio_client_id: prepared.advisor.atrioClientId,
      advisor_id: prepared.advisor.advisorId,
      advisor_slug: prepared.advisor.advisorSlug,
      promo_code: prepared.promoCode,
      attribution: {
        target_provider: prepared.provider,
        ...(prepared.skinCode ? { skin_code: prepared.skinCode } : {}),
      },
    }, env);
    return url.origin === expected && url.pathname === "/start" &&
      url.searchParams.size === 1 && url.searchParams.getAll("t").length === 1 &&
      Boolean(url.searchParams.get("t")) && typeof prepared.completedHandoff.binding_created === "boolean" &&
      typeof prepared.completedHandoff.expires_at === "string";
  } catch {
    return false;
  }
}

function encryptContinuation(
  prepared: Template7PreparedStart,
  env: PreparationEnvironment,
  now: number,
): string {
  const issuedAt = Math.floor(now / 1000);
  const claims: ContinuationClaims = {
    version: 1,
    issued_at: issuedAt,
    expires_at: issuedAt + TOKEN_TTL_SECONDS,
    prepared,
  };
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(env), iv);
  cipher.setAAD(Buffer.from(CONTINUATION_AAD));
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(claims), "utf8"),
    cipher.final(),
  ]);
  return [CONTINUATION_VERSION, iv.toString("base64url"), ciphertext.toString("base64url"), cipher.getAuthTag().toString("base64url")].join(".");
}

function decryptContinuation(
  token: string,
  env: PreparationEnvironment,
  now: number,
): ContinuationClaims {
  if (!token || token.length > MAX_TOKEN_LENGTH) throw new Error("invalid token");
  const [version, encodedIv, encodedCiphertext, encodedTag, extra] = token.split(".");
  if (version !== CONTINUATION_VERSION || !encodedIv || !encodedCiphertext || !encodedTag || extra !== undefined) {
    throw new Error("invalid token");
  }
  const iv = Buffer.from(encodedIv, "base64url");
  const ciphertext = Buffer.from(encodedCiphertext, "base64url");
  const tag = Buffer.from(encodedTag, "base64url");
  if (iv.length !== 12 || tag.length !== 16 || !ciphertext.length) throw new Error("invalid token");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(env), iv);
  decipher.setAAD(Buffer.from(CONTINUATION_AAD));
  decipher.setAuthTag(tag);
  const claims = JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8")) as ContinuationClaims;
  const nowSeconds = Math.floor(now / 1000);
  if (claims.version !== 1 || !Number.isInteger(claims.issued_at) || !Number.isInteger(claims.expires_at) ||
      claims.issued_at > nowSeconds + 60 || claims.expires_at <= nowSeconds ||
      claims.expires_at - claims.issued_at !== TOKEN_TTL_SECONDS || !isPreparedStart(claims.prepared, env)) {
    throw new Error("invalid token");
  }
  return claims;
}

function sameSecret(supplied: string, expected: string): boolean {
  const left = Buffer.from(supplied);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function handleTemplate7PreparationComplete(
  request: Request,
  env: PreparationEnvironment = process.env,
  deps: StartDependencies = productionDependencies(),
  now = Date.now(),
): Promise<Response> {
  if (request.method !== "POST" || !/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") || "")) {
    return json({ error: "invalid_request" }, 400);
  }
  try {
    const expected = requireSecret("TEMPLATE7_PREPARATION_API_KEY", env);
    const authorization = request.headers.get("authorization") || "";
    if (!authorization.startsWith("Bearer ") || !sameSecret(authorization.slice(7), expected)) {
      return json({ error: "unauthorized" }, 401);
    }
    const data = await readJson(request, MAX_TOKEN_LENGTH + 128) as { token?: unknown };
    if (!data || typeof data !== "object" || typeof data.token !== "string") return json({ error: "invalid_request" }, 400);
    const claims = decryptClaims(data.token, env, now);
    const headers = new Headers({ "Content-Type": "application/json", Origin: "https://template7.internal" });
    const cookies = [`${CLIENT_ID_COOKIE_NAME}=${claims.identity.deviceId}`];
    headers.set("Cookie", cookies.join("; "));
    if (claims.client_ip) headers.set("X-Vercel-Forwarded-For", claims.client_ip);
    const internalRequest = new Request("https://template7.internal/api/template7/start", {
      method: "POST",
      headers,
      body: JSON.stringify(claims.payload),
    });
    return await handleTemplate7StartWithIdentity(internalRequest, deps, claims.identity);
  } catch {
    return json({ error: "invalid_or_expired_preparation" }, 410);
  }
}

export async function handleTemplate7PreparationAccount(
  request: Request,
  env: PreparationEnvironment = process.env,
  deps: StartDependencies = productionDependencies(),
  now = Date.now(),
): Promise<Response> {
  if (request.method !== "POST" || !/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") || "")) {
    return json({ error: "invalid_request" }, 400);
  }
  try {
    const expected = requireSecret("TEMPLATE7_PREPARATION_API_KEY", env);
    const authorization = request.headers.get("authorization") || "";
    if (!authorization.startsWith("Bearer ") || !sameSecret(authorization.slice(7), expected)) {
      return json({ error: "unauthorized" }, 401);
    }
    const data = await readJson(request, MAX_TOKEN_LENGTH + 128) as { token?: unknown };
    if (!data || typeof data !== "object" || typeof data.token !== "string") {
      return json({ error: "invalid_request" }, 400);
    }
    const claims = decryptClaims(data.token, env, now);
    const headers = new Headers({ "Content-Type": "application/json", Origin: "https://template7.internal" });
    const cookies = [`${CLIENT_ID_COOKIE_NAME}=${claims.identity.deviceId}`];
    headers.set("Cookie", cookies.join("; "));
    if (claims.client_ip) headers.set("X-Vercel-Forwarded-For", claims.client_ip);
    const internalRequest = new Request("https://template7.internal/api/template7/start", {
      method: "POST",
      headers,
      body: JSON.stringify(claims.payload),
    });
    return await handleTemplate7AccountWithIdentity(
      internalRequest,
      deps,
      claims.identity,
      async (prepared) => {
        // Complete the independent link + handoff work on the same server trip.
        // All gateways already accept a ready handoff and skip /finalize.
        const handoff = await finalizeTemplate7PreparedStart(prepared, deps);
        const continuationToken = encryptContinuation({ ...prepared, completedHandoff: handoff }, env, now);
        const response = json({
          username: prepared.account.username,
          continuation_token: continuationToken,
          handoff_url: handoff.handoff_url,
        }, 200);
        if (Number.isSafeInteger(prepared.accountResolutionMs) && Number(prepared.accountResolutionMs) >= 0) {
          response.headers.set('Server-Timing', `t7-account;dur=${prepared.accountResolutionMs};desc="${prepared.account.created ? 'created' : 'recovered'}"`);
        }
        return response;
      },
    );
  } catch {
    return json({ error: "invalid_or_expired_preparation" }, 410);
  }
}

export async function handleTemplate7PreparationFinalize(
  request: Request,
  env: PreparationEnvironment = process.env,
  deps: StartDependencies = productionDependencies(),
  now = Date.now(),
): Promise<Response> {
  if (request.method !== "POST" || !/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") || "")) {
    return json({ error: "invalid_request" }, 400);
  }
  const expected = (() => {
    try {
      return requireSecret("TEMPLATE7_PREPARATION_API_KEY", env);
    } catch {
      return "";
    }
  })();
  const authorization = request.headers.get("authorization") || "";
  if (!expected || !authorization.startsWith("Bearer ") || !sameSecret(authorization.slice(7), expected)) {
    return json({ error: "unauthorized" }, 401);
  }
  let claims: ContinuationClaims;
  try {
    const data = await readJson(request, MAX_TOKEN_LENGTH + 128) as { continuation_token?: unknown };
    if (!data || typeof data !== "object" || typeof data.continuation_token !== "string") {
      return json({ error: "invalid_request" }, 400);
    }
    claims = decryptContinuation(data.continuation_token, env, now);
  } catch {
    return json({ error: "invalid_or_expired_continuation" }, 410);
  }
  try {
    const handoff = await finalizeTemplate7PreparedStart(claims.prepared, deps);
    return json({ handoff_url: handoff.handoff_url }, 200);
  } catch {
    return json({ error: "service_unavailable" }, 503);
  }
}
