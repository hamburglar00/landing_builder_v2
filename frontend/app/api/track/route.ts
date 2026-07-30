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
