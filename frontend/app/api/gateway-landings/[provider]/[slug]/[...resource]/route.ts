import { handleGatewayLanding } from "@/lib/landing/gatewayLanding.server";
import { productionGatewayLandingDependencies } from "@/lib/landing/gatewayLanding.production";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ provider: string; slug: string; resource: string[] }> };
async function handle(request: Request, context: Context) {
  try { return await handleGatewayLanding(request, await context.params, productionGatewayLandingDependencies()); }
  catch { return Response.json({ error: "landing_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
export const GET = handle;
export const HEAD = handle;
export const POST = handle;
