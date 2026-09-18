import { environmentFromServer } from "@/lib/revalidation/catalog.server";
import { handlePanelRevalidation, safeJson } from "@/lib/revalidation/service.server";
import { revalidationBackend } from "@/lib/revalidation/supabase.server";
import { postRevalidation } from "@/lib/revalidation/transport.server";

export const runtime = "nodejs";

async function handle(request: Request) {
  try {
    const environment = environmentFromServer(process.env);
    return await handlePanelRevalidation(request, {
      environment, backend: revalidationBackend(environment, process.env), send: postRevalidation,
    });
  } catch {
    return safeJson({ ok: false, revalidated: false, error: "revalidation_unavailable" }, 503);
  }
}

export const POST = handle;
export const GET = handle;
