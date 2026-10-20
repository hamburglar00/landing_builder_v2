import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { isDeviceId, CLIENT_ID_MAX_AGE_SECONDS } from "./clientIdentity.server";
const CONTEXT = "template7:identity-recovery:v1";
const key = (secret: string) => createHash("sha256").update(CONTEXT).update(secret).digest();
export function sealIdentityRecovery(deviceId: string, secret: string, origin: string, now = Date.now()): string {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  cipher.setAAD(Buffer.from(CONTEXT + origin));
  const body = Buffer.concat([cipher.update(JSON.stringify({ deviceId, expires: now + CLIENT_ID_MAX_AGE_SECONDS * 1000 })), cipher.final()]);
  return "ir1." + Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}
export function openIdentityRecovery(token: unknown, secret: string, origin: string, now = Date.now()): string | null {
  if (typeof token !== "string" || token.length > 600 || !token.startsWith("ir1.")) return null;
  try {
    const data = Buffer.from(token.slice(4), "base64url");
    if (data.length < 29) return null;
    const decipher = createDecipheriv("aes-256-gcm", key(secret), data.subarray(0, 12));
    decipher.setAAD(Buffer.from(CONTEXT + origin)); decipher.setAuthTag(data.subarray(12, 28));
    const body = JSON.parse(Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString("utf8"));
    return isDeviceId(body.deviceId) && Number.isFinite(body.expires) && body.expires > now && body.expires <= now + CLIENT_ID_MAX_AGE_SECONDS * 1000 ? body.deviceId : null;
  } catch { return null; }
}
