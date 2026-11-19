import { trusted, errorResponse } from "@/lib/pbadmin/protocol.server";
import { reviewBuilder } from "@/lib/pbadmin/sync.server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    trusted(request);
    const body = await request.json();
    return Response.json(await reviewBuilder(body?.ownerId, body?.accountId), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
