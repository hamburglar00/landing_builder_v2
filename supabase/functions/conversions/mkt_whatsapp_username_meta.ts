import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { MktUsernameDelivery } from "./mkt_whatsapp_username.ts";

export type WhatsappMilestoneMetaEvent = "off" | "Lead" | "CompleteRegistration" | "InitiateCheckout";
export type WhatsappMilestoneMetaEvents = Record<
  "first_message" | "username_requested" | "username_sent",
  WhatsappMilestoneMetaEvent
>;

async function hash(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function sendMktWhatsAppUsernameMeta(
  db: SupabaseClient,
  lead: MktUsernameDelivery,
  send = fetch,
) {
  if (lead.occurredAt < Math.floor(Date.now() / 1000) - 7 * 86400) return;
  const conversion = await db.from("conversions")
    .select("landing_id,promo_code,pixel_id,meta_pixel_id,fbc,fbp,from_meta_ads,workspace_currency,test_event_code")
    .eq("id", lead.conversionId).eq("user_id", lead.userId).maybeSingle();
  if (conversion.error) throw conversion.error;
  const source = conversion.data;
  if (!source?.landing_id || source.promo_code?.toLowerCase() !== lead.promo.toLowerCase()) return;
  const pixel = String(source.pixel_id || source.meta_pixel_id || "");
  if (!/^\d{5,25}$/.test(pixel)) return;
  const [pixelResult, workspaceResult] = await Promise.all([
    db.from("conversions_pixel_configs")
      .select("meta_access_token,meta_api_version,meta_ads_only_capi,whatsapp_username_meta_event,whatsapp_milestone_meta_events")
      .eq("user_id", lead.userId).eq("pixel_id", pixel).maybeSingle(),
    db.from("conversions_config").select("capi_workspace_settings")
      .eq("user_id", lead.userId).maybeSingle(),
  ]);
  if (pixelResult.error || workspaceResult.error) throw pixelResult.error ?? workspaceResult.error;
  const settings = pixelResult.data;
  const milestone = lead.milestone ?? "sent";
  const mapping = settings?.whatsapp_milestone_meta_events as WhatsappMilestoneMetaEvents | null | undefined;
  const mappingKey = milestone === "first_message" ? "first_message"
    : milestone === "requested" ? "username_requested" : "username_sent";
  const event = mapping
    ? mapping[mappingKey]
    : milestone === "sent" ? settings?.whatsapp_username_meta_event : null;
  if (!settings?.meta_access_token || (event !== "Lead" && event !== "CompleteRegistration" && event !== "InitiateCheckout") ||
      workspaceResult.data?.capi_workspace_settings?.[source.workspace_currency] === false) return;
  if (settings.meta_ads_only_capi && source.from_meta_ads !== true) return;
  const fbc = /^fb\.1\.\d{13}\.[A-Za-z0-9_.-]{1,490}$/.test(source.fbc || "") ? source.fbc : "";
  const fbp = /^fb\.\d\.\d{13}\.\d{1,24}$/.test(source.fbp || "") ? source.fbp : "";
  const eventId = await hash([
    milestone === "sent" ? "whatsapp-mkt-username" : `whatsapp-${milestone}`,
    lead.userId,
    lead.leadId,
  ].join(":"));
  const phone = await hash(lead.phone);
  const { data: claim, error } = await db.from("atrio_meta_journey_events").upsert({
    event_id: eventId, user_id: lead.userId, landing_id: source.landing_id,
    pixel_id: pixel, event_name: event, event_time: lead.occurredAt,
  }, { onConflict: "event_id", ignoreDuplicates: true }).select("event_id").maybeSingle();
  if (error) throw error;
  if (!claim) return;

  const version = /^v\d{1,3}\.\d{1,2}$/.test(settings.meta_api_version || "")
    ? settings.meta_api_version : "v25.0";
  let httpStatus: number | null = null;
  let accepted: number | null = null;
  let delivered = false;
  try {
    const response = await send("https://graph.facebook.com/" + version + "/" + pixel + "/events", {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(8_000),
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + settings.meta_access_token },
      body: JSON.stringify({
        ...(source.test_event_code ? { test_event_code: source.test_event_code } : {}),
        data: [{
        event_name: event, event_id: eventId, event_time: lead.occurredAt, action_source: "chat",
        user_data: { ph: [phone], ...(fbc ? { fbc } : {}), ...(fbp ? { fbp } : {}) },
        }],
      }),
    });
    httpStatus = response.status;
    const reply = await response.json().catch(() => null);
    accepted = typeof reply?.events_received === "number" ? reply.events_received : null;
    delivered = response.ok && !reply?.error && accepted === 1;
  } catch { /* Record transport failure without exposing the token or contact data. */ }
  const result = await db.from("atrio_meta_journey_events").update({
    delivery_status: delivered ? "sent" : "failed", http_status: httpStatus, events_received: accepted,
  }).eq("event_id", eventId);
  if (result.error) throw result.error;
}
