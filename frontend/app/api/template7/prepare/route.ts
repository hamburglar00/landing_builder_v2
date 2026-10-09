import type { NextRequest } from "next/server";
import { handleTemplate7Prepare } from "@/lib/reyDeAses/preparation.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<Response> {
  return handleTemplate7Prepare(request);
}
