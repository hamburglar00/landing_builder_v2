import {
  trusted,
  errorResponse,
  AccessError,
} from "@/lib/pbadmin/protocol.server";
import { adminDb } from "@/lib/pbadmin/provider.server";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    trusted(request);
    const raw = await request.text();
    if (raw.length > 4096)
      throw new AccessError("Solicitud demasiado grande.", 413);
    const { ownerId, accountId, userId, scope } = JSON.parse(raw);
    if (
      !Number.isSafeInteger(ownerId) ||
      ownerId < 1 ||
      !Number.isSafeInteger(userId) ||
      userId < 1 ||
      typeof accountId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(accountId) ||
      scope !== "workspace"
    )
      throw new AccessError("Vinculación no válida.", 400);
    const result = await adminDb().rpc("disconnect_pbadmin", {
      p_owner: ownerId,
      p_account: accountId,
      p_user: userId,
      p_scope: scope,
      p_advisor: null,
    });
    if (result.error || result.data?.disconnected !== true)
      throw new AccessError("No se pudo confirmar la desvinculación.", 503);
    return Response.json(result.data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
