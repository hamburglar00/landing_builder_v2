import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { isDeviceId } from "./clientIdentity.server";

export const DEMO_COOKIE_NAME = "t7_demo";
export const DEMO_MAX_AGE_SECONDS = 4 * 60 * 60;
const SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{0,159}$/i;

export type DemoConfig = {
  sessionSecret: string;
  landingIds: ReadonlySet<string>;
  advisorIds: ReadonlySet<string>;
  deviceId: string;
  username: string;
  password: string;
};

export type DemoLanding = {
  id: string;
  name: string;
  config: unknown;
  landing_config: unknown;
};

function parseUuidAllowlist(raw: string | undefined): Set<string> | null {
  if (!raw) return null;
  const ids = raw.split(",").map((value) => value.trim().toLowerCase());
  if (!ids.length || ids.some((id) => !isDeviceId(id))) return null;
  return new Set(ids);
}

/** Fail closed: nunca activar una demo por una configuración parcial. */
export function readDemoConfig(env: Record<string, string | undefined> = process.env): DemoConfig | null {
  if (env.TEMPLATE7_DEMO_ENABLED !== "true") return null;
  const sessionSecret = env.TEMPLATE7_DEMO_SESSION_SECRET || "";
  const landingIds = parseUuidAllowlist(env.TEMPLATE7_DEMO_LANDING_IDS);
  const advisorIds = parseUuidAllowlist(env.TEMPLATE7_DEMO_ADVISOR_IDS);
  const deviceId = env.TEMPLATE7_DEMO_DEVICE_ID || "";
  const username = env.TEMPLATE7_DEMO_REY_USERNAME || "";
  const password = env.TEMPLATE7_DEMO_REY_PASSWORD || "";
  if (Buffer.byteLength(sessionSecret) < 32 ||
      !landingIds?.size || !advisorIds?.size || !isDeviceId(deviceId) ||
      !username || !password) return null;
  return { sessionSecret, landingIds, advisorIds, deviceId, username, password };
}

export function isDemoLandingAllowed(landing: DemoLanding, config: DemoConfig): boolean {
  const raw = landing.config && typeof landing.config === "object" ? landing.config as Record<string, unknown> : {};
  const published = landing.landing_config && typeof landing.landing_config === "object"
    ? landing.landing_config as Record<string, unknown> : {};
  const layout = published.layout && typeof published.layout === "object" ? published.layout as Record<string, unknown> : {};
  return isDeviceId(landing.id) && config.landingIds.has(landing.id.toLowerCase()) &&
    raw.template === "template7" && layout.template === 7 && raw.ctaDestination === "atrio" &&
    raw.targetProvider === "rey_de_ases";
}

type DemoClaims = {
  version: 1;
  landing_id: string;
  landing_slug: string;
  issued_at: number;
  expires_at: number;
};

function signature(encoded: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(encoded).digest();
}

export function createDemoSession(landingId: string, landingSlug: string, config: DemoConfig, now = Date.now()): string {
  const issuedAt = Math.floor(now / 1000);
  const claims: DemoClaims = {
    version: 1, landing_id: landingId, landing_slug: landingSlug,
    issued_at: issuedAt, expires_at: issuedAt + DEMO_MAX_AGE_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${encoded}.${signature(encoded, config.sessionSecret).toString("base64url")}`;
}

export function demoSessionCookie(value: string, production = process.env.NODE_ENV === "production"): string {
  return `${DEMO_COOKIE_NAME}=${value}; Max-Age=${DEMO_MAX_AGE_SECONDS}; Path=/; HttpOnly; SameSite=Lax${production ? "; Secure" : ""}; Priority=High`;
}

export function readDemoCookie(request: Request): string | null {
  const matches = (request.headers.get("cookie") || "").split(";").map((part) => part.trim())
    .filter((part) => part.startsWith(`${DEMO_COOKIE_NAME}=`))
    .map((part) => part.slice(DEMO_COOKIE_NAME.length + 1));
  return matches.length === 1 ? matches[0] : matches.length > 1 ? "" : null;
}

export function verifyDemoSession(value: string, landingId: string, landingSlug: string, config: DemoConfig, now = Date.now()): boolean {
  try {
    if (!isDeviceId(landingId) || !SLUG_PATTERN.test(landingSlug) || value.length > 2048) return false;
    const [encoded, mac, extra] = value.split(".");
    if (!encoded || !mac || extra !== undefined || !/^[A-Za-z0-9_-]+$/.test(encoded) || !/^[A-Za-z0-9_-]+$/.test(mac)) return false;
    const supplied = Buffer.from(mac, "base64url");
    const expected = signature(encoded, config.sessionSecret);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return false;
    const claims = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as DemoClaims;
    const nowSeconds = Math.floor(now / 1000);
    return claims.version === 1 && claims.landing_id === landingId && claims.landing_slug === landingSlug &&
      Number.isInteger(claims.issued_at) && Number.isInteger(claims.expires_at) &&
      claims.issued_at <= nowSeconds + 60 && claims.expires_at > nowSeconds &&
      claims.expires_at > claims.issued_at && claims.expires_at - claims.issued_at <= DEMO_MAX_AGE_SECONDS &&
      config.landingIds.has(landingId.toLowerCase());
  } catch { return false; }
}

export async function loadDemoLanding(slug: string): Promise<DemoLanding | null> {
  if (!SLUG_PATTERN.test(slug)) return null;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("server database unavailable");
  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await db.from("landings").select("id,name,config,landing_config")
    .eq("name", slug).maybeSingle();
  if (error) throw error;
  return data as DemoLanding | null;
}
