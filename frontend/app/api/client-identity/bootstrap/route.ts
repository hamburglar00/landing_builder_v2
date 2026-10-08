import type { NextRequest } from "next/server";
import { handleClientIdentityBootstrap } from "@/lib/reyDeAses/bootstrap.server";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<Response> {
  return handleClientIdentityBootstrap(request);
}
