import { adminDb } from "@/lib/pbadmin/provider.server";
import { validateSession } from "@/lib/pbadmin/accounts.server";
import { AccessError, errorResponse } from "@/lib/pbadmin/protocol.server";
export async function GET(request: Request) {
  try {
    const token = request.headers
      .get("authorization")
      ?.match(/^Bearer (.+)$/)?.[1];
    if (!token) throw new AccessError("Volvé a ingresar.", 401);
    const actor = await validateSession(adminDb(), "builder", token);
    return Response.json(
      { federated: !!actor, userId: actor?.user_id ?? null },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
