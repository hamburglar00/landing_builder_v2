import type { NextRequest } from "next/server";
import { handleTemplate7PreparationAccount } from "@/lib/reyDeAses/preparation.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 45;
// vercel.json places only this orchestration in GRU, near Atrio and the gateways.
// Builder's context RPC still runs against its PDX database. Compare the existing
// Server-Timing stages after release; the rest of Builder retains its PDX region.

export async function POST(request: NextRequest): Promise<Response> {
  try {
    return await handleTemplate7PreparationAccount(request);
  } catch {
    return new Response(JSON.stringify({ error: "service_unavailable" }), {
      status: 503,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
}
