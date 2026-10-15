import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { urlAttribution } from './url_attribution.ts';

Deno.test('captures all parameters while leaving legacy UTM independent', () => {
  const payload = { landing: 'served', event_source_url: 'https://landing.test/old?landing=query&campana=Campaña+1&conjunto=A%26B&anuncio=123&utm_campaign=legacy' };
  assertEquals(urlAttribution(payload), { landing: 'served', campana: 'Campaña 1', conjunto: 'A&B', anuncio: '123' });
  assertEquals(Object.hasOwn(urlAttribution(payload), 'utm_campaign'), false);
});

Deno.test('preserves the original contact attribution on lead and repeat purchase', () => {
  const contact = urlAttribution({ landing: 'bianca2', campana: 'original', conjunto: 'set', anuncio: 'ad' });
  const lead = urlAttribution({ campana: 'later', conjunto: 'other' }, contact);
  assertEquals(lead, contact);
  assertEquals(urlAttribution({}, lead), contact);
});

Deno.test('organic and legacy visitors do not invent campaign data', () => {
  assertEquals(urlAttribution({ landing_name: 'organic' }), { landing: 'organic', campana: null, conjunto: null, anuncio: null });
  assertEquals(urlAttribution({ event_source_url: 'invalid' }), { landing: null, campana: null, conjunto: null, anuncio: null });
});

Deno.test('bounds and normalizes client-supplied values', () => {
  assertEquals(urlAttribution({ campana: ' \n test\u0000 ', conjunto: {}, anuncio: 'x'.repeat(500) }), {
    landing: null, campana: 'test', conjunto: null, anuncio: 'x'.repeat(300),
  });
});
