import { getOrCreateClientIdentity, withClientIdentityCookie } from "./clientIdentity.server";
import { allowBootstrap } from "./rateLimit.server";

export type BootstrapDependencies = { allow(request: Request): Promise<boolean> };

export async function handleClientIdentityBootstrap(
  request: Request,
  deps: BootstrapDependencies = { allow: allowBootstrap },
): Promise<Response> {
  if (request.method !== "POST") return Response.json({ error: "method_not_allowed" }, { status: 405, headers: { "Cache-Control": "no-store" } });
  if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) {
    return Response.json({ error: "invalid_request" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  const identity = getOrCreateClientIdentity(request);
  try {
    if (!await deps.allow(request)) {
      return withClientIdentityCookie(Response.json({ error: "rate_limited" }, { status: 429 }), identity);
    }
    return withClientIdentityCookie(Response.json({ ok: true }), identity);
  } catch {
    return withClientIdentityCookie(Response.json({ error: "service_unavailable" }, { status: 503 }), identity);
  }
}
