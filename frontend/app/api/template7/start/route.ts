import type { NextRequest } from "next/server";
import { handleTemplate7Start, productionDependencies } from "@/lib/reyDeAses/start.server";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<Response> {
  try {
    return await handleTemplate7Start(request, productionDependencies());
  } catch {
    return new Response(JSON.stringify({ error: "service_unavailable" }), {
      status: 503,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
}
