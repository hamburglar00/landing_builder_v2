import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { urlAttribution } from './url_attribution.ts';

Deno.test('captures all parameters while leaving legacy UTM independent', () => {
  const payload = { landing: 'served', event_source_url: 'https://landing.test/old?landing=query&facebook=Facebook+Norte&portofolio=Equipo%26A&cp=001234567890123456789&campana=Campaña+1&conjunto=A%26B&anuncio=123&utm_campaign=legacy' };
  assertEquals(urlAttribution(payload), { landing: 'served', facebook: 'Facebook Norte', portofolio: 'Equipo&A', cp: '001234567890123456789', campana: 'Campaña 1', conjunto: 'A&B', anuncio: '123' });
  assertEquals(Object.hasOwn(urlAttribution(payload), 'utm_campaign'), false);
});

Deno.test('preserves the original contact attribution on lead and repeat purchase', () => {
  const contact = urlAttribution({ landing: 'bianca2', facebook: 'Facebook original', portofolio: 'Equipo original', cp: '00123', campana: 'original', conjunto: 'set', anuncio: 'ad' });
  const lead = urlAttribution({ facebook: 'otro', portofolio: 'otro', cp: 'otro', campana: 'later', conjunto: 'other' }, contact);
  assertEquals(lead, contact);
  assertEquals(urlAttribution({}, lead), contact);
});

Deno.test('organic and legacy visitors do not invent campaign data', () => {
  assertEquals(urlAttribution({ landing_name: 'organic' }), { landing: 'organic', facebook: null, portofolio: null, cp: null, campana: null, conjunto: null, anuncio: null });
  assertEquals(urlAttribution({ event_source_url: 'invalid' }), { landing: null, facebook: null, portofolio: null, cp: null, campana: null, conjunto: null, anuncio: null });
});

Deno.test('bounds and normalizes client-supplied values', () => {
  assertEquals(urlAttribution({ campana: ' \n test\u0000 ', conjunto: {}, anuncio: 'x'.repeat(500) }), {
    landing: null, facebook: null, portofolio: null, cp: null, campana: 'test', conjunto: null, anuncio: 'x'.repeat(300),
  });
});

Deno.test('explicit advertising origin wins over URL and only missing original fields can be enriched', () => {
  const payload = { facebook: ' current ', portofolio: 'current', cp: '000567', event_source_url: 'https://landing.test/?facebook=url&portofolio=url&cp=url' };
  const result = urlAttribution(payload, { facebook: 'original', portofolio: null });
  assertEquals(result.facebook, 'original');
  assertEquals(result.portofolio, 'current');
  assertEquals(result.cp, '000567');
});

Deno.test('advertising origin rejects objects and bounds control characters and length', () => {
  const result = urlAttribution({ facebook: { name: 'wrong' }, portofolio: '\n Team\u0000 ', cp: 'x'.repeat(800) });
  assertEquals(result.facebook, null);
  assertEquals(result.portofolio, 'Team');
  assertEquals(result.cp, 'x'.repeat(300));
});
