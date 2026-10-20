import { handleTemplate7Destination, productionDestinationBackend } from "@/lib/atrio/template7Destination.server";
import { getOrCreateClientIdentity } from "@/lib/reyDeAses/clientIdentity.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const identity = getOrCreateClientIdentity(request);
  return handleTemplate7Destination(request, identity.needsCookie ? null : identity.deviceId,
    productionDestinationBackend());
}
