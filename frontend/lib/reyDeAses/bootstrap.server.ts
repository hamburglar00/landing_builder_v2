import { getOrCreateClientIdentity, withClientIdentityCookie } from "./clientIdentity.server";
import { allowBootstrap } from "./rateLimit.server";
import { openIdentityRecovery, sealIdentityRecovery } from "./clientIdentityRecovery.server";

export type BootstrapDependencies = { allow(request: Request): Promise<boolean>; recoverySecret?: string };

export async function handleClientIdentityBootstrap(
  request: Request,
  deps: BootstrapDependencies = { allow: allowBootstrap },
): Promise<Response> {
  if (request.method !== "POST") return Response.json({ error: "method_not_allowed" }, { status: 405, headers: { "Cache-Control": "no-store" } });
  if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) {
    return Response.json({ error: "invalid_request" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  let identity = getOrCreateClientIdentity(request);
  const secret = deps.recoverySecret || process.env.TEMPLATE7_PREPARATION_TOKEN_KEY;
  try {
    const raw = await request.text();
    if (raw.length > 1024) return Response.json({ error: "invalid_request" }, { status: 413 });
    const body = raw ? JSON.parse(raw) : {};
    if (!body || typeof body !== 'object' || Array.isArray(body)) return Response.json({error:'invalid_request'},{status:400});
    if (body.verify === true) return Response.json(identity.needsCookie ? {error:'cookie_required'} : {ok:true}, {status:identity.needsCookie?409:200,headers:{'Cache-Control':'no-store'}});
    if (identity.needsCookie && secret) {
      const saved = body.recovery_token;
      const recovered = openIdentityRecovery(saved, secret, new URL(request.url).origin);
      if (recovered) identity = { deviceId: recovered, needsCookie: true };
    }
  } catch { return Response.json({error:'invalid_request'},{status:400}); }
  try {
    if (!await deps.allow(request)) {
      return withClientIdentityCookie(Response.json({ error: "rate_limited" }, { status: 429 }), identity);
    }
    return withClientIdentityCookie(Response.json({ ok: true,
      ...(secret ? { recovery_token: sealIdentityRecovery(identity.deviceId, secret, new URL(request.url).origin) } : {})
    }), identity);
  } catch {
    return withClientIdentityCookie(Response.json({ error: "service_unavailable" }, { status: 503 }), identity);
  }
}
