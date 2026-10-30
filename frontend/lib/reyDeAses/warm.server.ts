import { getOrCreateClientIdentity } from './clientIdentity.server';
import { configuredTargetProvider, configuredSkinCode, isTemplate7Landing, parseTemplate7StartPayload, type StartDb } from './start.server';
import { gatewayOriginFor } from './gatewayOrigins';

type WarmInput = { advisor_id: string; advisor_slug: string; device_id: string; landing_id: string; target_provider: string };
export function createTemplate7WarmHandler(deps: {
  db: StartDb;
  allow(request: Request, deviceId: string): Promise<boolean>;
  prepare(input: WarmInput): Promise<void | { existing_name?: string; promo_code?: string }>;
  recover?(request: Request, payload: object): Promise<Response>;
  env?: Record<string, string | undefined>;
}) {
  const json = (body: object, status: number) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  return async (request: Request) => {
    if (request.method !== 'POST' || request.headers.get('origin') !== new URL(request.url).origin ||
      request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') return json({ error: 'invalid_request' }, 400);
    // Warming must never race bootstrap and install a competing device cookie.
    const identity = getOrCreateClientIdentity(request);
    if (identity.needsCookie) return json({ error: 'identity_pending' }, 409);
    try {
      if (Number(request.headers.get('content-length')) > 2048) return json({ error: 'invalid_request' }, 413);
      const text = await request.text();
      if (new TextEncoder().encode(text).length > 2048) return json({ error: 'invalid_request' }, 413);
      const value = JSON.parse(text);
      if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !['landing_id', 'landing_slug', 'atrio_client_id', 'advisor_id', 'advisor_slug'].includes(key))) return json({ error: 'invalid_request' }, 400);
      const payload = parseTemplate7StartPayload({ ...value, name: 'preparation', promo_code: 'preparation' });
      if (!payload) return json({ error: 'invalid_request' }, 400);
      if (!await deps.allow(request, identity.deviceId)) return json({ error: 'rate_limited' }, 429);
      const [landing, assignment, advisor] = await Promise.all([
        deps.db.landing(payload.landing_id), deps.db.assignment(payload.landing_id, payload.atrio_client_id), deps.db.advisor(payload.atrio_client_id),
      ]);
      if (!landing || landing.name !== payload.landing_slug || !isTemplate7Landing(landing) || !assignment || !advisor ||
        assignment.landing_id !== landing.id || assignment.atrio_client_id !== advisor.id || advisor.id !== payload.atrio_client_id ||
        assignment.user_id !== landing.user_id || advisor.user_id !== landing.user_id || advisor.workspace_currency !== landing.workspace_currency ||
        advisor.atrio_id !== payload.advisor_id || advisor.slug !== payload.advisor_slug || await deps.db.blocked(landing.user_id)) return json({ error: 'unavailable' }, 403);
      const provider = configuredTargetProvider(landing);
      if (!provider) return json({ error: 'unavailable' }, 503);
      const skinCode=configuredSkinCode(landing,provider);
      if (provider==='multi_skin' && !skinCode) return json({error:'unavailable'},503);
      const prepared = await deps.prepare({ advisor_id: advisor.atrio_id, advisor_slug: advisor.slug, device_id: identity.deviceId, landing_id: landing.id, target_provider: provider });
      if (prepared?.existing_name && prepared.promo_code && deps.recover) {
        const response = await deps.recover(request, {...value,name:prepared.existing_name,promo_code:prepared.promo_code,attribution:{target_provider:provider,...(skinCode?{skin_code:skinCode}:{})}});
        if (!response.ok) return response;
        return json({ready:true,...await response.json()},200);
      }
      const gateway = new URL(gatewayOriginFor(provider, skinCode, deps.env) || '');
      if (gateway.protocol !== 'https:' || gateway.username || gateway.password || gateway.pathname !== '/' || gateway.search || gateway.hash) return json({ ready: true }, 200);
      return json({ ready: true, gateway_origin: gateway.origin }, 200);
    } catch { return json({ error: 'preparation_unavailable' }, 503); }
  };
}
