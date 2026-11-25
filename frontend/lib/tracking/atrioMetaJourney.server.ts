import { createHash } from "node:crypto";
import { getSupabaseServerClient } from "../supabase/server";
import { resolveEffectiveLandingConfig } from "../landing/effectiveLandingConfig";
import { normalizePublicClientIp } from "./clientIpProof";

export type AtrioJourneyEvent = "ViewContent" | "InitiateCheckout";
type Landing = { id: string; name: string; user_id: string; workspace_currency: string; pixel_id?: string | null; config: unknown; landing_config: unknown };
const allowedOrigins = new Set(["https://mkt.panelbotadmin.com", "https://landing.panelbotadmin.com"]);
const sessionIdPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

function sourceUrl(request: Request, slug: string) {
  const origin = new URL(request.url).origin;
  if (!allowedOrigins.has(origin)) {
    const scopedUrl = request.headers.get("x-builder-verified-landing-source");
    if (!scopedUrl) return null;
    try {
      const gateway = new URL(scopedUrl);
      if (gateway.origin === origin && gateway.protocol === "https:") return gateway.origin + gateway.pathname;
    } catch { /* No verified route supplied. */ }
    return null;
  }
  const candidate = request.headers.get("referer");
  try {
    const url = new URL(candidate || "", origin);
    if (url.origin === origin && ["/" + slug, "/l/" + slug].includes(url.pathname.replace(/\/$/, ""))) return url.origin + url.pathname;
  } catch { /* Canonical public URL remains available. */ }
  return new URL(origin.includes("mkt.") ? "/l/" + slug : "/" + slug, origin).toString();
}

function normalizeFbc(value: unknown) {
  if (typeof value !== "string" || !/^fb\.1\.\d{13}\.[A-Za-z0-9_-]{1,450}(?:\.[A-Za-z0-9_-]{1,40})?$/.test(value)) return "";
  const time = Number(value.split(".")[2]);
  return time >= Date.now() - 90 * 86400_000 && time <= Date.now() + 60_000 ? value : "";
}

export function currentVisitFbc(value: unknown, provenance: unknown, landingId: string, pixelId: string, currency: string) {
  if (!provenance || typeof provenance !== "object") return "";
  const p = provenance as Record<string, unknown>;
  const fbc = normalizeFbc(value);
  const captured = Number(p.captured_at);
  if (!fbc || p.version !== 2 || p.landing_id !== landingId || p.pixel_id !== pixelId ||
      p.workspace_currency !== currency || p.entry_source !== p.fbc_source ||
      !["url", "referrer", "sdk_fresh"].includes(String(p.entry_source)) ||
      captured !== Number(fbc.split(".")[2]) || captured < Date.now() - 30 * 60_000) return "";
  return fbc;
}

export async function reserveAtrioMetaJourney(input: {
  request: Request;
  landing: Landing;
  name: AtrioJourneyEvent;
  key: string;
  fbc?: unknown;
  fbp?: unknown;
  provenance?: unknown;
}) {
  const { landing, name } = input;
  const raw = resolveEffectiveLandingConfig(landing.config, landing.landing_config);
  if (raw.ctaDestination !== "atrio" || name === "ViewContent" && !sessionIdPattern.test(input.key)) return null;
  const source = sourceUrl(input.request, landing.name);
  if (!source) return null;
  const sources = landing.landing_config as { tracking?: { pixelId?: string } } | null;
  const pixel = String(landing.pixel_id || sources?.tracking?.pixelId || "").trim();
  if (!/^\d{5,25}$/.test(pixel)) return null;
  const db = getSupabaseServerClient();
  const [pixelResult, workspaceResult] = await Promise.all([
    db.from("conversions_pixel_configs").select("meta_access_token,meta_api_version,meta_ads_only_capi,send_atrio_view_content,send_atrio_initiate_checkout")
      .eq("user_id", landing.user_id).eq("pixel_id", pixel).maybeSingle(),
    db.from("conversions_config").select("capi_workspace_settings").eq("user_id", landing.user_id).maybeSingle(),
  ]);
  if (pixelResult.error || workspaceResult.error) throw Error("Meta journey configuration unavailable");
  const settings = pixelResult.data;
  if (!settings?.meta_access_token || workspaceResult.data?.capi_workspace_settings?.[landing.workspace_currency] === false) return null;
  const fbc = name === "ViewContent"
    ? currentVisitFbc(input.fbc, input.provenance, landing.id, pixel, landing.workspace_currency)
    : normalizeFbc(input.fbc);
  if (name === "ViewContent" ? !settings.send_atrio_view_content || !fbc
      : !settings.send_atrio_initiate_checkout || settings.meta_ads_only_capi && !fbc) return null;
  const fbp = typeof input.fbp === "string" && /^fb\.\d\.\d{13}\.\d{1,24}$/.test(input.fbp) ? input.fbp : "";
  const eventId = createHash("sha256").update([landing.user_id, name, name === "ViewContent" ? landing.id : "", input.key].join(":")).digest("hex");
  const stamp = Math.floor(Date.now() / 1_000);
  const { data: claim, error } = await db.from("atrio_meta_journey_events").upsert({
    event_id: eventId, user_id: landing.user_id, landing_id: landing.id, pixel_id: pixel, event_name: name, event_time: stamp,
  }, { onConflict: "event_id", ignoreDuplicates: true }).select("event_id").maybeSingle();
  if (error) throw Error("Meta journey event could not be reserved");
  const version = /^v\d{1,3}\.\d{1,2}$/.test(settings.meta_api_version || "") ? settings.meta_api_version : "v25.0";
  return {
    eventId,
    pixel,
    async deliver() {
      if (!claim) return;
      let status = "failed";
      let httpStatus: number | null = null;
      let accepted: number | null = null;
      const agent = (input.request.headers.get("user-agent") || "").slice(0, 1000);
      const ip = normalizePublicClientIp(input.request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "");
      try {
        const response = await fetch("https://graph.facebook.com/" + version + "/" + pixel + "/events", {
          method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000),
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + settings.meta_access_token },
          body: JSON.stringify({ data: [{
            event_name: name, event_time: stamp, event_id: eventId, action_source: "website", event_source_url: source,
            user_data: {
              ...(fbc ? { fbc } : {}), ...(fbp ? { fbp } : {}),
              external_id: [createHash("sha256").update(input.key).digest("hex")],
              ...(agent ? { client_user_agent: agent } : {}), ...(ip ? { client_ip_address: ip } : {}),
            },
          }] }),
        });
        httpStatus = response.status;
        const reply = await response.json().catch(() => null);
        accepted = typeof reply?.events_received === "number" ? reply.events_received : null;
        if (response.ok && !reply?.error && accepted === 1) status = "sent";
      } catch { /* The transport status is recorded without leaking a token. */ }
      const saved = await db.from("atrio_meta_journey_events").update({
        delivery_status: status, http_status: httpStatus, events_received: accepted,
      }).eq("event_id", eventId);
      if (saved.error) throw Error("Meta journey result could not be saved");
    },
  };
}
