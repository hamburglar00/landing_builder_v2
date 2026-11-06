import { trusted, errorResponse } from "@/lib/pbadmin/protocol.server";
import { adminDb } from "@/lib/pbadmin/provider.server";
import { exportMktUsage } from "@/lib/pbadmin/mkt-usage-export.server";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request) {
  try {
    trusted(request);
    return Response.json(await exportMktUsage(adminDb()), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
