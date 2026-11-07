import "server-only";
import { createPublicKey, verify } from "node:crypto";
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
/** Called only after readNexoRequest verifies the NexoBet server signature. */
export async function nexoIdentity(
  payload: Record<string, unknown>,
): Promise<NexoBuilderIdentity> {
  const identity = payload.scope as NexoBuilderIdentity;
  if (
    !identity ||
    identity.active !== true ||
    !Number.isSafeInteger(identity.ownerId) ||
    identity.ownerId <= 0 ||
    !Number.isSafeInteger(identity.userId) ||
    identity.userId <= 0 ||
    !uuid(identity.builderId) ||
    !uuid(identity.advisorId) ||
    !Array.isArray(identity.connections) ||
    identity.connections.length > 4 ||
    identity.connections.some(
      (c) =>
        ![1, 2, 5, 7].includes(c.platform) ||
        !Number.isSafeInteger(c.agencyId) ||
        c.agencyId <= 0 ||
        !Number.isSafeInteger(c.managerId) ||
        c.managerId <= 0,
    ) ||
    new Set(identity.connections.map((c) => c.platform)).size !==
      identity.connections.length
  )
    throw new NexoBridgeError("account_unavailable", 403);
  const { data, error } = await adminDb()
    .from("pbadmin_accounts")
    .select("account_id,legacy,ready")
    .eq("owner_id", identity.ownerId)
    .eq("account_id", identity.builderId)
    .maybeSingle();
  if (error || !data?.ready || data.legacy)
    throw new NexoBridgeError("account_unavailable", 403);
  return identity;
}
