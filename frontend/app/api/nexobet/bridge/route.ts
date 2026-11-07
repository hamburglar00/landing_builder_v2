import {
  readNexoRequest,
  nexoIdentity,
  NexoBridgeError,
} from "@/lib/nexobet/protocol.server";
import { marketingOperation } from "@/lib/nexobet/marketing.server";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function POST(request: Request) {
  try {
    const { operation, payload } = await readNexoRequest(request);
    if (
      !["overview", "initialize", "save_pixel", "save_landing"].includes(
        operation,
      )
    )
      throw new NexoBridgeError("invalid_operation", 422);
    const identity = await nexoIdentity(payload.accountId);
    return Response.json(
      await marketingOperation(operation, payload, identity),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      {
        code:
          error instanceof NexoBridgeError ? error.code : "service_unavailable",
      },
      {
        status: error instanceof NexoBridgeError ? error.status : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
