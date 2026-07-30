const PROOF_VERSION = "v1";

function normalizePublicIpv4(ip) {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return "";
  }

  const [a, b, c] = parts;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return "";
  if (a === 100 && b >= 64 && b <= 127) return "";
  if (a === 169 && b === 254) return "";
  if (a === 172 && b >= 16 && b <= 31) return "";
  if (a === 192 && ((b === 0 && c === 0) || b === 168 || (b === 0 && c === 2))) return "";
  if (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) return "";
  if (a === 203 && b === 0 && c === 113) return "";
  return parts.join(".");
}

function normalizePublicIpv6(ip) {
  const normalized = ip.toLowerCase().replace(/%.+$/, "");
  if (!normalized.includes(":") || !/^[0-9a-f:]+$/.test(normalized)) return "";
  const compressionIndex = normalized.indexOf("::");
  const hasCompression = compressionIndex >= 0;
  if (hasCompression && compressionIndex !== normalized.lastIndexOf("::")) return "";
  const groups = normalized.split(":").filter(Boolean);
  if (groups.some((group) => group.length > 4)) return "";
  if (hasCompression ? groups.length >= 8 : groups.length !== 8) return "";
  if (normalized === "::" || normalized === "::1") return "";
  if (
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    /^fe[89ab]/.test(normalized)
  ) return "";
  if (normalized.startsWith("ff") || normalized.startsWith("2001:db8:")) return "";
  return normalized;
}

export function normalizePublicIp(rawIp) {
  let ip = String(rawIp || "").trim().replace(/^"|"$/g, "");
  if (!ip) return "";
  if (ip.startsWith("[") && ip.includes("]")) {
    ip = ip.slice(1, ip.indexOf("]"));
  }

  const mappedIpv4 = ip.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (mappedIpv4) return normalizePublicIpv4(mappedIpv4[1]);
  if (ip.includes(".")) return normalizePublicIpv4(ip);
  return normalizePublicIpv6(ip);
}

function base64Url(bytes) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function signClientIp(secret, ip, issuedAt) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const message = `${PROOF_VERSION}\n${issuedAt}\n${ip}`;
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return base64Url(new Uint8Array(signature));
}

function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function responseHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Cache-Control": "no-store, max-age=0",
    "Content-Type": "application/json; charset=utf-8",
    "Vary": "Origin",
  };
}

function jsonResponse(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(origin),
  });
}

export async function handleRequest(request, env) {
  const origin = request.headers.get("Origin") || "";
  if (!origin || !allowedOrigins(env).includes(origin)) {
    return jsonResponse({ error: "origin_not_allowed" }, 403, "null");
  }

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: responseHeaders(origin) });
  }
  if (request.method !== "GET") {
    return jsonResponse({ error: "method_not_allowed" }, 405, origin);
  }

  const secret = String(env.META_IP_PROOF_SECRET || "").trim();
  if (!secret) {
    return jsonResponse({ error: "collector_not_configured" }, 503, origin);
  }

  const clientIp = normalizePublicIp(
    request.headers.get("CF-Connecting-IPv6") ||
      request.headers.get("CF-Connecting-IP") ||
      "",
  );
  if (!clientIp) {
    return jsonResponse({ error: "client_ip_unavailable" }, 422, origin);
  }

  const issuedAt = Math.floor(Date.now() / 1000);
  const proof = await signClientIp(secret, clientIp, issuedAt);
  return jsonResponse(
    {
      ip: clientIp,
      version: clientIp.includes(":") ? "ipv6" : "ipv4",
      issued_at: issuedAt,
      proof,
    },
    200,
    origin,
  );
}

export default {
  fetch: handleRequest,
};
