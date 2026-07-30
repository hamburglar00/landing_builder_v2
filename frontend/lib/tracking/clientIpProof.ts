import { createHmac, timingSafeEqual } from "node:crypto";

const PROOF_VERSION = "v1";
export const CLIENT_IP_PROOF_MAX_AGE_SECONDS = 10 * 60;
const CLIENT_IP_PROOF_FUTURE_TOLERANCE_SECONDS = 30;

function normalizePublicIpv4(ip: string) {
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

function normalizePublicIpv6(ip: string) {
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

export function normalizePublicClientIp(rawIp: unknown) {
  let ip = String(rawIp ?? "").trim().replace(/^"|"$/g, "");
  if (!ip) return "";
  if (ip.startsWith("[") && ip.includes("]")) {
    ip = ip.slice(1, ip.indexOf("]"));
  }

  const mappedIpv4 = ip.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (mappedIpv4) return normalizePublicIpv4(mappedIpv4[1]);
  if (ip.includes(".")) return normalizePublicIpv4(ip);
  return normalizePublicIpv6(ip);
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyClientIpProof(input: {
  ip: unknown;
  issuedAt: unknown;
  proof: unknown;
  secret: string | undefined;
  nowSeconds?: number;
}) {
  const secret = String(input.secret ?? "").trim();
  const ip = normalizePublicClientIp(input.ip);
  const issuedAt = Number(input.issuedAt);
  const proof = String(input.proof ?? "").trim();
  const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1000);

  if (!secret || !ip || !proof || !Number.isInteger(issuedAt)) return "";
  if (issuedAt > nowSeconds + CLIENT_IP_PROOF_FUTURE_TOLERANCE_SECONDS) return "";
  if (nowSeconds - issuedAt > CLIENT_IP_PROOF_MAX_AGE_SECONDS) return "";

  const expected = createHmac("sha256", secret)
    .update(`${PROOF_VERSION}\n${issuedAt}\n${ip}`)
    .digest("base64url");
  return safeEqual(proof, expected) ? ip : "";
}

export function selectPreferredClientIp(input: {
  verifiedClientIp: string;
  observedClientIp: string;
  fallbackClientIp: string;
}) {
  const verifiedClientIp = normalizePublicClientIp(input.verifiedClientIp);
  const observedClientIp = normalizePublicClientIp(input.observedClientIp);
  const fallbackClientIp = normalizePublicClientIp(input.fallbackClientIp);
  const ip =
    (verifiedClientIp.includes(":") ? verifiedClientIp : "") ||
    observedClientIp ||
    verifiedClientIp ||
    fallbackClientIp;

  return {
    ip,
    source: verifiedClientIp && ip === verifiedClientIp
      ? "signed_dual_stack"
      : observedClientIp
        ? "vercel_forwarded"
        : fallbackClientIp
          ? "client_fallback"
          : "",
  };
}
