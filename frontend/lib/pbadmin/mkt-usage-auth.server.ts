import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { AccessError } from "./protocol.server";

/** Deployment export works before SSO is enabled; this key authorizes no other endpoint. */
export function authorizeMktUsageExport(request: Request) {
  const expected = process.env.PBADMIN_MKT_USAGE_EXPORT_SECRET ?? "";
  if (expected.length < 32) throw new AccessError("La exportación todavía no está configurada.", 503);
  const actual = request.headers.get("x-extension-secret") ?? "";
  const hash = (value: string) => createHash("sha256").update(value).digest();
  if (!timingSafeEqual(hash(expected), hash(actual))) throw new AccessError("Acceso no autorizado.", 401);
}
