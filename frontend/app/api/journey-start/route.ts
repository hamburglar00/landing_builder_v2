import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

function cleanText(value: unknown, maxLength = 500): string {
  return String(value ?? "").trim().slice(0, maxLength);
}

function cleanDigits(value: unknown): string {
  return cleanText(value).replace(/\D/g, "");
}

function cleanIpCandidate(value: string): string {
  let text = value.trim();
  if (!text || text.toLowerCase() === "unknown") return "";
  const forwardedMatch = text.match(/^for=(.+)$/i);
  if (forwardedMatch) text = forwardedMatch[1].trim();
  text = text.replace(/^"|"$/g, "");
  const ipv4WithPort = text.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
  if (ipv4WithPort) text = ipv4WithPort[1];
  const ipv4Mapped = text.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (ipv4Mapped) text = ipv4Mapped[1];
  return text;
}

function getRealClientIp(request: NextRequest): string {
  const headers = [
    request.headers.get("x-forwarded-for"),
    request.headers.get("x-real-ip"),
    request.headers.get("true-client-ip"),
    request.headers.get("cf-connecting-ip"),
  ];
  for (const header of headers) {
    if (!header) continue;
    for (const part of header.split(",")) {
      const ip = cleanIpCandidate(part);
      if (ip) return ip;
    }
  }
  return "";
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const payload =
      body && typeof body === "object" && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};
    const eventName = cleanText(payload.event_name, 80);
    if (eventName !== "LandingPageView" && eventName !== "PageView") {
      return NextResponse.json({ error: "evento invalido" }, { status: 400 });
    }

    const landingId = cleanText(payload.landing_id, 80);
    const slug = cleanText(payload.slug, 160);
    const externalId = cleanText(payload.external_id, 180);
    if (!externalId) {
      return NextResponse.json({ error: "external_id requerido" }, { status: 400 });
    }
    if (!landingId && !slug) {
      return NextResponse.json({ error: "landing requerida" }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    let query = supabase
      .from("landings")
      .select("id,user_id,name,workspace_currency,pixel_id")
      .limit(1);
    if (landingId && isUuid(landingId)) query = query.eq("id", landingId);
    else query = query.eq("name", slug);

    const { data: landing, error: landingError } = await query.maybeSingle();
    if (landingError) throw landingError;
    if (!landing?.id || !landing?.user_id) {
      return NextResponse.json({ error: "landing no encontrada" }, { status: 404 });
    }

    const fbc = cleanText(payload.fbc, 500);
    const fromMetaAds = Boolean(payload.from_meta_ads) || fbc !== "";
    const eventSuffix =
      globalThis.crypto?.randomUUID?.() ||
      `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    const startIdentityKey = `landing:${landing.id}:${externalId}:${eventSuffix}`;
    const { error } = await supabase.rpc("record_conversion_journey_start", {
      p_user_id: landing.user_id,
      p_source_platform: "landing",
      p_start_identity_key: startIdentityKey,
      p_landing_id: landing.id,
      p_landing_name: cleanText(payload.landing_name, 180) || landing.name || "",
      p_workspace_currency: cleanText(payload.workspace_currency, 3) || landing.workspace_currency || "ARS",
      p_external_id: externalId,
      p_phone: cleanDigits(payload.phone),
      p_email: cleanText(payload.email, 320).toLowerCase(),
      p_utm_campaign: cleanText(payload.utm_campaign, 300),
      p_fbp: cleanText(payload.fbp, 500),
      p_fbc: fbc,
      p_from_meta_ads: fromMetaAds,
      p_meta_pixel_id: cleanDigits(payload.meta_pixel_id) || cleanDigits(landing.pixel_id),
      p_telefono_asignado: cleanDigits(payload.telefono_asignado),
      p_assigned_gerencia_id: null,
      p_assigned_gerencia_external_id: Number(payload.assigned_gerencia_external_id) || null,
      p_assigned_gerencia_name: cleanText(payload.assigned_gerencia_name, 180) || null,
      p_assigned_gerencia_label: cleanText(payload.assigned_gerencia_label, 220) || null,
      p_device_type: cleanText(payload.device_type, 80),
      p_event_source_url: cleanText(payload.event_source_url, 2048),
      p_client_ip: cleanText(payload.client_ip_address, 120) || getRealClientIp(request),
      p_agent_user: cleanText(payload.client_user_agent, 1024) || request.headers.get("user-agent") || "",
    });
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[journey-start] failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "error interno" },
      { status: 500 },
    );
  }
}
