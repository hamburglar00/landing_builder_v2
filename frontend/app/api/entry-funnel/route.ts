import { handleEntryFunnel, productionEntryFunnelBackend } from "@/lib/landing/entryFunnel.server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return handleEntryFunnel(request, productionEntryFunnelBackend());
}
