import "server-only";
import {
  createPrivateKey,
  createPublicKey,
  sign,
  verify,
  randomUUID,
} from "node:crypto";
import { adminDb } from "../pbadmin/provider.server";
export const uuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const publicKey =
  "MCowBQYDK2VwAyEASZAAAAmUfY6tzFJf3y2MHiFM6VGVQc5IcoVtEOdpis0=";
export class NexoBridgeError extends Error {
  constructor(
    public code: string,
    public status = 409,
  ) {
    super(code);
  }
}
export async function readNexoRequest(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json")
    throw new NexoBridgeError("unauthorized", 401);
  const raw = await request.text(),
    timestamp = request.headers.get("x-nexobet-timestamp") || "",
    nonce = request.headers.get("x-nexobet-nonce") || "",
    signature = request.headers.get("x-nexobet-signature") || "";
  if (
    raw.length > 16000 ||
    request.headers.get("x-nexobet-key-id") !== "nexobet-v1" ||
    !/^\d{13}$/.test(timestamp) ||
    Math.abs(Date.now() - Number(timestamp)) > 120000 ||
    !uuid(nonce) ||
    !/^[\w-]{86}$/.test(signature) ||
    !verify(
      null,
      Buffer.from(`${timestamp}.${nonce}.${raw}`),
      createPublicKey({
        key: Buffer.from(publicKey, "base64"),
        format: "der",
        type: "spki",
      }),
      Buffer.from(signature, "base64url"),
    )
  )
    throw new NexoBridgeError("unauthorized", 401);
  const db = adminDb();
  const claim = await db
    .from("nexobet_builder_nonces")
    .insert({ nonce, expires_at: new Date(Date.now() + 300000).toISOString() });
  if (claim.error) throw new NexoBridgeError("request_replayed", 409);
  await db
    .from("nexobet_builder_nonces")
    .delete()
    .lt("expires_at", new Date().toISOString());
  const body = JSON.parse(raw);
  if (!uuid(body.payload?.accountId))
    throw new NexoBridgeError("invalid_account", 422);
  return body;
}
export type NexoBuilderIdentity = {
  active: boolean;
  ownerId: number;
  userId: number;
  builderId: string | null;
  advisorId: string | null;
  connections: { platform: number; agencyId: number; managerId: number }[];
};
export async function nexoIdentity(
  accountId: string,
): Promise<NexoBuilderIdentity> {
  const key = process.env.NEXOBET_API2_PRIVATE_KEY,
    origin = process.env.PBADMIN_EXTENSIONS_API_ORIGIN;
  if (!key || !origin) throw new NexoBridgeError("integration_pending", 503);
  const url = new URL("/api/v1/nexobet/bridge", origin);
  if (url.protocol !== "https:")
    throw new NexoBridgeError("integration_pending", 503);
  const body = JSON.stringify({
      operation: "builder_context",
      payload: { accountId },
    }),
    timestamp = String(Date.now()),
    nonce = randomUUID();
  const signature = sign(
    null,
    Buffer.from(`${timestamp}.${nonce}.${body}`),
    createPrivateKey({
      key: Buffer.from(key, "base64"),
      format: "der",
      type: "pkcs8",
    }),
  ).toString("base64url");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-nexobet-key-id": "builder-v1",
      "x-nexobet-timestamp": timestamp,
      "x-nexobet-nonce": nonce,
      "x-nexobet-signature": signature,
    },
    body,
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new NexoBridgeError("account_unavailable", 403);
  const identity = await response.json();
  if (
    identity.active !== true ||
    !uuid(identity.builderId) ||
    !uuid(identity.advisorId)
  )
    throw new NexoBridgeError("builder_not_connected", 409);
  return identity;
}
