import { trusted, errorResponse } from "@/lib/pbadmin/protocol.server";
import { syncBuilder } from "@/lib/pbadmin/sync.server";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    trusted(request);
    const body = await request.json();
    return Response.json(await syncBuilder(body.ownerId, body.accountId), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
