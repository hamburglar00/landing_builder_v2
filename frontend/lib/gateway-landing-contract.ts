import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { gatewayLandingBasePath, isGatewayLandingSlug, type GatewayLandingBackend } from "./gateway-landing-paths";
export { gatewayLandingBasePath, gatewayLandingCookiePath, gatewayLandingTelemetryPath, parseGatewayLandingTelemetryPath,
  isGatewayLandingSlug, type GatewayLandingBackend } from "./gateway-landing-paths";

export const GATEWAY_LANDING_PROOF_HEADER = "x-gateway-landing-proof";
export const GATEWAY_LANDING_BODY_LIMIT = 65_536;
export const GATEWAY_LANDING_API_OPERATIONS = [
  "client-identity/bootstrap", "template7/destination", "template7/warm", "template7/prepare",
  "track", "journey-start", "entry-funnel",
] as const;
export type GatewayLandingProvider = "rey_de_ases" | "ases_del_norte" | "ganamos_net" | "multi_skin";
export type GatewayLandingResource = "document" | "api" | "asset" | "legal";
export type GatewayLandingRequest = {
  backend: GatewayLandingBackend;
  origin: string;
  slug: string;
  provider: GatewayLandingProvider;
  skin: string | null;
  resource: GatewayLandingResource;
  operation: string;
  method: "GET" | "HEAD" | "POST";
  contentType: string;
  clientIp: string;
  userAgent: string;
  body: string | Uint8Array;
  cookie: string;
};
export type GatewayLandingClaims = Omit<GatewayLandingRequest, "body" | "cookie"> & {
  version: 1;
  issuedAt: number;
  bodyDigest: string;
  cookieDigest: string;
};
export type GatewayLandingExpected = Pick<GatewayLandingRequest,
  "backend" | "slug" | "provider" | "resource" | "operation" | "method" | "contentType" | "body" | "cookie">;
const PROVIDERS = ["rey_de_ases", "ases_del_norte", "ganamos_net", "multi_skin"];
const SKINS = ["jugamos", "ganamos_plus", "casino_zeus", "bet30", "gana_en_casa", "celu_apuestas",
  "casino_zeta", "oro_puro", "fortu_bet", "gran_poseidon", "kona_bet", "mega_faraon", "camel_bet", "rhino_play"];
const DOMAIN = "gateway-landing-request/v1\0";
const CLAIM_KEYS = ["backend", "origin", "slug", "provider", "skin", "resource", "operation", "method",
  "contentType", "clientIp", "userAgent", "version", "issuedAt", "bodyDigest", "cookieDigest"];
const digest = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const bytes = (value: string | Uint8Array) => typeof value === "string" ? Buffer.byteLength(value) : value.byteLength;

/** Structural boundary only. The renderer must additionally check its exact asset registry. */
export function isGatewayLandingOperation(resource: unknown, operation: unknown, method: unknown, backend: GatewayLandingBackend = "builder"): boolean {
  if (typeof operation !== "string" || operation.length > 240 || /[\\%?#\u0000-\u0020]/.test(operation)) return false;
  if (resource === "api") return method === "POST" && (backend === "nexobet" ? ["entry", "entry-funnel"].includes(operation)
    : (GATEWAY_LANDING_API_OPERATIONS as readonly string[]).includes(operation));
  if (method !== "GET" && method !== "HEAD") return false;
  if (resource === "document") return operation === "index";
  if (resource === "legal") return ["terminos", "privacidad", "juego-responsable", "cookies"].includes(operation);
  if (resource !== "asset" || operation.split("/").some(part => !part || part === "." || part === "..")) return false;
  return /^public-assets\/template-entry\/[A-Za-z0-9_.-]+\.(?:js|css|svg)$/.test(operation)
    || (backend === "nexobet" && /^public-assets\/entry-funnel\/entry-funnel-[a-f0-9]{24}\.js$/.test(operation))
    || /^public-assets\/template9\/[a-z0-9_]+_logo\.webp$/.test(operation)
    || operation === "vendor/meta-capi-param-builder/1.3.1/clientParamBuilder.bundle.js"
    || operation === "vendor/atrio-meta-click/v1/collect-click-id.313adead513e2b9aab4f3efb.js"
    || /^brands\/[a-z0-9_-]+\/[A-Za-z0-9_.-]+\.(?:avif|webp|png|svg|ico)$/.test(operation)
    || operation === "favicon.svg" || operation === "favicon.ico";
}

function validClaims(value: unknown): value is GatewayLandingClaims {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const claims = value as GatewayLandingClaims;
  if (Object.keys(claims).length !== CLAIM_KEYS.length || Object.keys(claims).some(key => !CLAIM_KEYS.includes(key))
    || claims.version !== 1 || !Number.isSafeInteger(claims.issuedAt)
    || !["builder", "nexobet"].includes(claims.backend) || !PROVIDERS.includes(claims.provider)
    || !isGatewayLandingSlug(claims.slug) || !isGatewayLandingOperation(claims.resource, claims.operation, claims.method, claims.backend)
    || !/^[a-f0-9]{64}$/.test(claims.bodyDigest) || !/^[a-f0-9]{64}$/.test(claims.cookieDigest)
    || typeof claims.userAgent !== "string" || claims.userAgent.length > 512 || /[\u0000-\u001f\u007f]/.test(claims.userAgent)
    || typeof claims.clientIp !== "string" || (claims.clientIp !== "" && !isIP(claims.clientIp))
    || typeof claims.origin !== "string" || claims.origin.length > 255) return false;
  if (claims.provider === "multi_skin" ? !SKINS.includes(claims.skin ?? "") : claims.skin !== null) return false;
  if (claims.resource === "api" ? !["application/json", "text/plain"].includes(claims.contentType) : claims.contentType !== "") return false;
  try {
    gatewayLandingBasePath(claims.backend, claims.slug);
    const origin = new URL(claims.origin);
    return origin.protocol === "https:" && origin.origin === claims.origin && !origin.username && !origin.password;
  } catch { return false; }
}

function validPayload(input: Pick<GatewayLandingRequest, "body" | "cookie">): boolean {
  return (typeof input.body === "string" || input.body instanceof Uint8Array) && bytes(input.body) <= GATEWAY_LANDING_BODY_LIMIT
    && typeof input.cookie === "string" && input.cookie.length <= 4096 && !/[\r\n\u0000]/.test(input.cookie);
}

/** Server-to-server proof only; never an account credential or browser authorization. */
export function signGatewayLandingRequest(input: GatewayLandingRequest, key: string, now = Date.now()): string {
  if (key.length < 32 || !validPayload(input)) throw new Error("Invalid gateway landing request");
  const { body, cookie, ...context } = input;
  const claims: GatewayLandingClaims = { ...context, version: 1, issuedAt: now, bodyDigest: digest(body), cookieDigest: digest(cookie) };
  if (!validClaims(claims)) throw new Error("Invalid gateway landing context");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signature = createHmac("sha256", key).update(DOMAIN + payload).digest("base64url");
  return `g1.${payload}.${signature}`;
}

export function verifyGatewayLandingRequest(
  proof: unknown, expected: GatewayLandingExpected, key: string, now = Date.now(),
): GatewayLandingClaims | null {
  try {
    if (key.length < 32 || !validPayload(expected) || typeof proof !== "string"
      || !/^g1\.[A-Za-z0-9_-]{1,4000}\.[A-Za-z0-9_-]{43}$/.test(proof)) return null;
    const [, payload, signature] = proof.split(".");
    const wanted = createHmac("sha256", key).update(DOMAIN + payload).digest();
    const received = Buffer.from(signature, "base64url");
    if (wanted.length !== received.length || !timingSafeEqual(wanted, received)) return null;
    const claims: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!validClaims(claims) || claims.issuedAt < now - 60_000 || claims.issuedAt > now + 5000
      || claims.bodyDigest !== digest(expected.body) || claims.cookieDigest !== digest(expected.cookie)) return null;
    for (const field of ["backend", "slug", "provider", "resource", "operation", "method", "contentType"] as const)
      if (claims[field] !== expected[field]) return null;
    return claims;
  } catch { return null; }
}
