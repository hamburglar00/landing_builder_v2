import { createTemplate7WarmHandler } from '@/lib/reyDeAses/warm.server';
import { productionDependencies } from '@/lib/reyDeAses/start.server';
import { allowTemplate7Warm } from '@/lib/reyDeAses/rateLimit.server';
import { handleTemplate7Prepare } from '@/lib/reyDeAses/preparation.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  return createTemplate7WarmHandler({
    db: productionDependencies().db, allow: allowTemplate7Warm,
    async recover(request, payload) {
      return handleTemplate7Prepare(new Request(new URL('/api/template7/prepare',request.url), {method:'POST',headers:request.headers,body:JSON.stringify(payload)}));
    },
    async prepare(input) {
      const origin = new URL(process.env.INTERNAL_CHAT_ORIGIN || '');
      const key = process.env.INTERNAL_CHAT_PLAYER_RESOLVE_KEY;
      if (!key || origin.protocol !== 'https:') throw new Error('Preparation unavailable');
      const response = await fetch(new URL('/api/gateway/players/existing', origin), {
        method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(input), signal: AbortSignal.timeout(7000), cache: 'no-store', redirect: 'error',
      });
      if (!response.ok) throw new Error('Preparation unavailable');
      const found = await response.json();
      if (typeof found.existing_name === 'string' && typeof found.promo_code === 'string') return found;
      const prepared = await fetch(new URL('/api/gateway/players/prepare', origin), {
        method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.timeout(7000),cache:'no-store',redirect:'error'
      });
      if (!prepared.ok) throw new Error('Preparation unavailable');
    },
  })(request);
}
