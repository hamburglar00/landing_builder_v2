import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { isIP } from "node:net";
import type { StartRequest } from "./contracts";
import {
  CLIENT_ID_COOKIE_NAME,
  getOrCreateClientIdentity,
  isDeviceId,
  withClientIdentityCookie,
  type ClientIdentity,
} from "./clientIdentity.server";
import { DEMO_COOKIE_NAME, readDemoCookie } from "./demo.server";
import {
  handleTemplate7StartWithIdentity,
  parseTemplate7StartPayload,
  productionDependencies,
  type StartDependencies,
} from "./start.server";

const TOKEN_VERSION = "p1";
const TOKEN_AAD = "landing-builder:template7-preparation:v1";
const TOKEN_TTL_SECONDS = 5 * 60;
const MAX_REQUEST_BYTES = 4096;
const MAX_TOKEN_LENGTH = 12_000;

type PreparationClaims = {
  version: 1;
  issued_at: number;
  expires_at: number;
  payload: StartRequest;
  identity: ClientIdentity;
  demo_requested: boolean;
  demo_cookie: string | null;
  client_ip: string | null;
};

type PreparationEnvironment = Record<string, string | undefined>;

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}

function validJsonRequest(request: Request): Response | null {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") || "")) {
    return json({ error: "invalid_request" }, 415);
  }
  if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) {
    return json({ error: "invalid_request" }, 403);
  }
  const contentLength = Number(request.headers.get("content-length") || 0);
  return contentLength > MAX_REQUEST_BYTES ? json({ error: "invalid_request" }, 413) : null;
}

async function readJson(request: Request, maxBytes = MAX_REQUEST_BYTES): Promise<unknown> {
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > maxBytes) throw new Error("request_too_large");
  return JSON.parse(raw);
}

function requireSecret(name: string, env: PreparationEnvironment): string {
  const value = env[name] || "";
  if (Buffer.byteLength(value) < 32) throw new Error(`${name} unavailable`);
  return value;
}

function encryptionKey(env: PreparationEnvironment): Buffer {
  return createHash("sha256")
    .update(requireSecret("TEMPLATE7_PREPARATION_TOKEN_KEY", env), "utf8")
    .digest();
}

function clientIp(request: Request): string | null {
  for (const header of ["x-vercel-forwarded-for", "cf-connecting-ip", "x-real-ip", "x-forwarded-for"]) {
    const first = (request.headers.get(header) || "").split(",")[0]?.trim() || "";
    if (isIP(first)) return first;
  }
  return null;
}

function encryptClaims(claims: PreparationClaims, env: PreparationEnvironment): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(env), iv);
  cipher.setAAD(Buffer.from(TOKEN_AAD));
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(claims), "utf8"),
    cipher.final(),
  ]);
  return [TOKEN_VERSION, iv.toString("base64url"), ciphertext.toString("base64url"), cipher.getAuthTag().toString("base64url")].join(".");
}

function decryptClaims(token: string, env: PreparationEnvironment, now: number): PreparationClaims {
  if (!token || token.length > MAX_TOKEN_LENGTH) throw new Error("invalid token");
  const [version, encodedIv, encodedCiphertext, encodedTag, extra] = token.split(".");
  if (version !== TOKEN_VERSION || !encodedIv || !encodedCiphertext || !encodedTag || extra !== undefined) {
    throw new Error("invalid token");
  }
  const iv = Buffer.from(encodedIv, "base64url");
  const ciphertext = Buffer.from(encodedCiphertext, "base64url");
  const tag = Buffer.from(encodedTag, "base64url");
  if (iv.length !== 12 || tag.length !== 16 || !ciphertext.length) throw new Error("invalid token");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(env), iv);
  decipher.setAAD(Buffer.from(TOKEN_AAD));
  decipher.setAuthTag(tag);
  const claims = JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8")) as PreparationClaims;
  const nowSeconds = Math.floor(now / 1000);
  if (claims.version !== 1 || !Number.isInteger(claims.issued_at) || !Number.isInteger(claims.expires_at) ||
      claims.issued_at > nowSeconds + 60 || claims.expires_at <= nowSeconds ||
      claims.expires_at - claims.issued_at !== TOKEN_TTL_SECONDS ||
      !parseTemplate7StartPayload(claims.payload) ||
      !claims.identity || !isDeviceId(claims.identity.deviceId) || typeof claims.identity.needsCookie !== "boolean" ||
      typeof claims.demo_requested !== "boolean" ||
      (claims.demo_cookie !== null && typeof claims.demo_cookie !== "string") ||
      (claims.client_ip !== null && !isIP(claims.client_ip))) {
    throw new Error("invalid token");
  }
  return claims;
}

function sameSecret(supplied: string, expected: string): boolean {
  const left = Buffer.from(supplied);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function gatewayOrigin(payload: StartRequest, env: PreparationEnvironment): string {
  const multiSkin = payload.attribution?.target_provider === "multi_skin" && payload.attribution?.skin_code === "ganamos_plus";
  const raw = multiSkin ? env.MULTI_SKIN_GATEWAY_ORIGIN || "" : env.REY_GATEWAY_ORIGIN || "";
  const url = new URL(raw);
  const local = url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
  if ((!local && url.protocol !== "https:") || url.pathname !== "/" || url.search || url.hash || url.username || url.password) {
    throw new Error("gateway unavailable");
  }
  return url.origin;
}

export async function handleTemplate7Prepare(
  request: Request,
  env: PreparationEnvironment = process.env,
  now = Date.now(),
): Promise<Response> {
  const invalid = validJsonRequest(request);
  if (invalid) return invalid;
  const identity = getOrCreateClientIdentity(request);
  try {
    const payload = parseTemplate7StartPayload(await readJson(request));
    if (!payload) return withClientIdentityCookie(json({ error: "invalid_request" }, 400), identity);
    const demoRequested = request.headers.get("x-template7-demo-context") === "testing";
    const demoCookie = demoRequested ? readDemoCookie(request) : null;
    if (demoCookie !== null && demoCookie.length > 2048) {
      return withClientIdentityCookie(json({ error: "invalid_request" }, 400), identity);
    }
    const issuedAt = Math.floor(now / 1000);
    const token = encryptClaims({
      version: 1,
      issued_at: issuedAt,
      expires_at: issuedAt + TOKEN_TTL_SECONDS,
      payload,
      identity,
      demo_requested: demoRequested,
      demo_cookie: demoCookie,
      client_ip: clientIp(request),
    }, env);
    const destination = new URL("/prepare", gatewayOrigin(payload, env));
    destination.searchParams.set("t", token);
    return withClientIdentityCookie(json({ handoff_url: destination.toString() }, 200), identity);
  } catch {
    return withClientIdentityCookie(json({ error: "service_unavailable" }, 503), identity);
  }
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
    if (claims.demo_requested) {
      headers.set("X-Template7-Demo-Context", "testing");
      if (claims.demo_cookie !== null) cookies.push(`${DEMO_COOKIE_NAME}=${claims.demo_cookie}`);
    }
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
