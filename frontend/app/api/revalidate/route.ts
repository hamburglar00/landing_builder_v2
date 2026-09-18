import { revalidatePath, revalidateTag } from "next/cache";
import { environmentFromServer } from "@/lib/revalidation/catalog.server";
import { handleConstructorRevalidation, safeJson } from "@/lib/revalidation/service.server";
import { revalidationBackend } from "@/lib/revalidation/supabase.server";
import { warmConstructor } from "@/lib/revalidation/transport.server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const environment = environmentFromServer(process.env);
    const backend = revalidationBackend(environment, process.env);
    return await handleConstructorRevalidation(request, {
      environment, secret: backend.secret,
      invalidate(name) {
        revalidatePath(`/l/${name}`);
        revalidatePath(`/${name}`);
        revalidateTag(`landing-config:${name}`, "max");
      },
      warm: name => warmConstructor(environment, name),
    });
  } catch {
    return safeJson({ ok: false, revalidated: false, error: "revalidation_unavailable" }, 503);
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: "POST, OPTIONS", "Cache-Control": "no-store" } });
}
