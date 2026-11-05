import {
  redeem,
  sameOrigin,
  errorResponse,
} from "@/lib/pbadmin/protocol.server";
import { provision } from "@/lib/pbadmin/provider.server";
import { syncBuilder } from "@/lib/pbadmin/sync.server";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { code, state } = await request.json();
    const identity = await redeem("builder", code, state);
    const result = await provision(identity, code);
    // First import is attempted now; the durable API2 reconciliation retries failures.
    let syncPending = false;
    try {
      syncPending = !(await syncBuilder(identity.ownerId, result.uid)).complete;
    } catch {
      syncPending = true;
    }
    return Response.json(
      {
        access_token: result.session.access_token,
        refresh_token: result.session.refresh_token,
        syncPending,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
