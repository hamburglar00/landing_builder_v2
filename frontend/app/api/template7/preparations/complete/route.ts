import type { NextRequest } from "next/server";
import { handleTemplate7PreparationComplete } from "@/lib/reyDeAses/preparation.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<Response> {
  try {
    return await handleTemplate7PreparationComplete(request);
  } catch {
    return new Response(JSON.stringify({ error: "service_unavailable" }), {
      status: 503,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
}
