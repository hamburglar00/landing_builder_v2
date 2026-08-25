import { NextRequest, NextResponse } from "next/server";
import {
  enqueueTrackEvent,
  markTrackEventDelivered,
  persistTrackEvent,
} from "@/lib/tracking/queue";
import {
  normalizePublicClientIp,
  selectPreferredClientIp,
  verifyClientIpProof,
} from "@/lib/tracking/clientIpProof";
import { buildCanonicalTrackingPayload } from "@/lib/tracking/canonicalPayload";
import { deliverToUpstream } from "@/lib/tracking/upstream";
import { getSupabaseServerClient } from "@/lib/supabase/server";

function cleanText(value: unknown, maxLength = 500) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function cleanDigits(value: unknown) {
  return cleanText(value).replace(/\D/g, "");
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(value);
}

function hostFromUrl(value?: string) {
  if (!value) return "";
  try {
    return new URL(value).hostname.trim().toLowerCase();
  } catch {
    return "";
  }
}

function parseAllowedHosts() {
  const configured = (process.env.TRACK_ALLOWED_HOSTS || "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  const supabaseHost = hostFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  return Array.from(new Set([...configured, supabaseHost].filter(Boolean)));
}

function cleanIpCandidate(value: string) {
  let text = value.trim();
  if (!text || text.toLowerCase() === "unknown" || text.startsWith("_")) return "";

  const forwardedMatch = text.match(/^for=(.+)$/i);
  if (forwardedMatch) {
    text = forwardedMatch[1].trim();
  }

  text = text.replace(/^"|"$/g, "");

  if (text.startsWith("[")) {
    const bracketEnd = text.indexOf("]");
    if (bracketEnd > 0) {
      text = text.slice(1, bracketEnd);
    }
  } else {
    const ipv4WithPort = text.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
    if (ipv4WithPort) {
      text = ipv4WithPort[1];
    }
  }

  const ipv4Mapped = text.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (ipv4Mapped) {
    text = ipv4Mapped[1];
  }

  return text.trim();
}

function getIpVersion(ip: string) {
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(ip)) return "ipv4";
  if (ip.includes(":")) return "ipv6";
  return "";
}

function collectHeaderIpCandidates(request: NextRequest) {
  const candidates: Array<{ ip: string; source: string }> = [];
  const append = (source: string, raw: string | null) => {
    if (!raw) return;
    for (const part of raw.split(",")) {
      const ip = cleanIpCandidate(part);
      if (ip && getIpVersion(ip)) {
        candidates.push({ ip, source });
      }
    }
  };

  append("x-forwarded-for", request.headers.get("x-forwarded-for"));
  append("x-real-ip", request.headers.get("x-real-ip"));
  append("true-client-ip", request.headers.get("true-client-ip"));
  append("cf-connecting-ip", request.headers.get("cf-connecting-ip"));

  const forwarded = request.headers.get("forwarded");
  if (forwarded) {
    for (const entry of forwarded.split(",")) {
      const forPart = entry
        .split(";")
        .map((part) => part.trim())
        .find((part) => part.toLowerCase().startsWith("for="));
      append("forwarded", forPart || null);
    }
  }

  return candidates;
}

function getRealClientIp(request: NextRequest) {
  const candidates = collectHeaderIpCandidates(request);
  return candidates[0]?.ip || "";
}

function normalizePayload(
  request: NextRequest,
  payloadFromClient: Record<string, unknown>,
) {
  const userAgent = request.headers.get("user-agent") || "";
  const realClientIp = normalizePublicClientIp(getRealClientIp(request));
  const fallbackClientIp =
    typeof payloadFromClient.client_ip_address === "string"
      ? normalizePublicClientIp(payloadFromClient.client_ip_address)
      : "";
  const verifiedClientIp = verifyClientIpProof({
    ip: fallbackClientIp,
    issuedAt: payloadFromClient.client_ip_issued_at,
    proof: payloadFromClient.client_ip_proof,
    secret: process.env.META_IP_PROOF_SECRET,
  });
  const preferredClientIp = selectPreferredClientIp({
    verifiedClientIp,
    observedClientIp: realClientIp,
    fallbackClientIp,
  });
  const clientIpAddress = preferredClientIp.ip;
  const clientIpSource = preferredClientIp.source;
  return buildCanonicalTrackingPayload({
    payloadFromClient,
    clientIpAddress,
    clientIpSource,
    clientIpVersion: getIpVersion(clientIpAddress),
    observedUserAgent: userAgent,
  });
}

async function ensureLandingJourneyStartFromContact(payload: Record<string, unknown>) {
  const eventName = cleanText(payload.event_name, 80);
  const sourcePlatform = cleanText(payload.source_platform, 80).toLowerCase();
  if (eventName !== "Contact" || sourcePlatform !== "landing") return;

  const externalId = cleanText(payload.external_id, 180);
  const landingId = cleanText(payload.landing_id, 80);
  const landingName = cleanText(payload.landing_name || payload.brand, 180);
  if (!externalId || (!landingId && !landingName)) return;

  try {
    const supabase = getSupabaseServerClient();
    let query = supabase
      .from("landings")
      .select("id,user_id,name,workspace_currency,pixel_id")
      .limit(1);

    if (landingId && isUuid(landingId)) {
      query = query.eq("id", landingId);
    } else {
      query = query.eq("name", landingName);
    }

    const { data: landing, error: landingError } = await query.maybeSingle();
    if (landingError || !landing?.id || !landing?.user_id) {
      if (landingError) console.warn("[track] landing journey lookup failed", landingError);
      return;
    }

    const firstSeenAt = cleanText(payload.timestamp, 80) || null;
    const fbc = cleanText(payload.fbc, 500);
    const { error } = await supabase.rpc("record_conversion_journey_start", {
      p_user_id: landing.user_id,
      p_source_platform: "landing",
      p_start_identity_key: `landing:${landing.id}:${externalId}`,
      p_landing_id: landing.id,
      p_landing_name: landingName || landing.name || "",
      p_workspace_currency:
        cleanText(payload.workspace_currency, 3) ||
        cleanText(payload.currency, 3) ||
        landing.workspace_currency ||
        "ARS",
      p_external_id: externalId,
      p_phone: cleanDigits(payload.phone),
      p_email: cleanText(payload.email, 320).toLowerCase(),
      p_utm_campaign: cleanText(payload.utm_campaign, 300),
      p_fbp: cleanText(payload.fbp, 500),
      p_fbc: fbc,
      p_from_meta_ads: Boolean(payload.from_meta_ads) || fbc !== "",
      p_meta_pixel_id: cleanDigits(payload.meta_pixel_id) || cleanDigits(payload.pixel_id) || cleanDigits(landing.pixel_id),
      p_telefono_asignado: cleanDigits(payload.telefono_asignado),
      p_assigned_gerencia_id: null,
      p_assigned_gerencia_external_id: Number(payload.assigned_gerencia_external_id) || null,
      p_assigned_gerencia_name: cleanText(payload.assigned_gerencia_name, 180) || null,
      p_assigned_gerencia_label: cleanText(payload.assigned_gerencia_label, 220) || null,
      p_device_type: cleanText(payload.device_type, 80),
      p_event_source_url: cleanText(payload.event_source_url, 2048),
      p_client_ip: cleanText(payload.client_ip_address, 120),
      p_agent_user: cleanText(payload.client_user_agent, 1024),
      p_first_seen_at: firstSeenAt,
      p_last_seen_at: firstSeenAt,
    });
    if (error) console.warn("[track] landing journey start fallback failed", error);
  } catch (error) {
    console.warn("[track] landing journey start fallback failed", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const postUrl = typeof body?.postUrl === "string" ? body.postUrl.trim() : "";
    const payloadFromClient =
      body?.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
        ? (body.payload as Record<string, unknown>)
        : null;

    if (!postUrl || !/^https?:\/\//i.test(postUrl)) {
      return NextResponse.json({ error: "postUrl invalida" }, { status: 400 });
    }
    if (!payloadFromClient) {
      return NextResponse.json({ error: "payload invalido" }, { status: 400 });
    }

    const postHost = hostFromUrl(postUrl);
    if (!postHost) {
      return NextResponse.json({ error: "postUrl invalida" }, { status: 400 });
    }

    const allowedHosts = parseAllowedHosts();
    if (allowedHosts.length === 0) {
      return NextResponse.json(
        { error: "TRACK_ALLOWED_HOSTS o NEXT_PUBLIC_SUPABASE_URL no esta configurado" },
        { status: 500 },
      );
    }

    if (!allowedHosts.includes(postHost)) {
      return NextResponse.json(
        { error: `Host no permitido para tracking: ${postHost}` },
        { status: 403 },
      );
    }

    const payload = normalizePayload(request, payloadFromClient);
    await ensureLandingJourneyStartFromContact(payload);
    const persisted = await persistTrackEvent({ postUrl, payload });

    if (persisted.alreadyDelivered) {
      return NextResponse.json({
        ok: true,
        duplicate: true,
        persisted: true,
        status: persisted.status,
      });
    }

    if (persisted.ok && !persisted.isNew) {
      return NextResponse.json(
        {
          queued: true,
          duplicate: true,
          persisted: true,
          status: persisted.status,
        },
        { status: 202 },
      );
    }

    const result = await deliverToUpstream(postUrl, payload);

    if (result.ok) {
      if (persisted.id) {
        await markTrackEventDelivered(persisted.id);
      }

      return NextResponse.json({
        ...result,
        persisted: persisted.ok,
      });
    }

    const queued =
      persisted.ok ||
      (await enqueueTrackEvent({
        postUrl,
        payload,
        reason: result.details,
        upstreamStatus: result.upstreamStatus,
      }));

    if (queued) {
      return NextResponse.json(
        {
          queued: true,
          retry: "scheduled",
          ...result,
        },
        { status: 202 },
      );
    }

    return NextResponse.json(
      {
        error: "tracking_upstream_error",
        queued: false,
        ...result,
      },
      { status: 502 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "tracking_internal_error",
        details: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 },
    );
  }
}
