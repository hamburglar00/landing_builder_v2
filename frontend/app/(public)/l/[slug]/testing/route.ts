import type { NextRequest } from "next/server";
import { handleDemoPage } from "@/lib/reyDeAses/demoRoute.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ slug: string }> };

export async function GET(request: NextRequest, context: Context): Promise<Response> {
  return handleDemoPage(request, (await context.params).slug);
}

export async function POST(request: NextRequest, context: Context): Promise<Response> {
  return handleDemoPage(request, (await context.params).slug);
}
