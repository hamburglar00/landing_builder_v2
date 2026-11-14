// Real Meta journey handlers; database and transport are mocked.
// SQL milestone triggers/concurrency are tested separately. No credentials,
// real Meta requests, provider operations or production data are used here.
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const fixtureSource = readFileSync(path.join(root, 'scripts/check-purchase-source-url.mjs'), 'utf8');
const boundary = fixtureSource.indexOf('const results = [];');
assert.ok(boundary > 0, 'Shared handler fixture boundary exists');
let setup = fixtureSource.slice(0, boundary);
setup = setup.replace("const root = fileURLToPath(new URL('../', import.meta.url));", `const root = ${JSON.stringify(root)};`);
assert.ok(setup.includes('exports.fixtureApi={'), 'Shared fixture exposes real handler functions');
setup = setup.replace('exports.fixtureApi={', 'exports.fixtureApi={handleContact,handleLead,');
const secret = 'fixture-exclusive-internal-journey-signing-key';
assert.ok(setup.includes("CRON_SECRET: 'synthetic-cron'"), 'Fixture environment remains isolated');
setup = setup.replace("CRON_SECRET: 'synthetic-cron'", `CRON_SECRET: 'synthetic-cron', ATRIO_INTERNAL_EVENTS_SECRET: ${JSON.stringify(secret)}`);
setup += '\nexport const harness={api,handlers,fixture,payload,owner,pixel,landingId,sourceUrl,config,now,activate(state){current=state},externalRequests(){return externalRequests}};';
const { harness: h } = await import('data:text/javascript;base64,' + Buffer.from(setup).toString('base64'));
const results = [];
const advisor = '19000000-0000-4000-8000-000000000004';
const player = '19000000-0000-4000-8000-000000000005';
const conversation = '19000000-0000-4000-8000-000000000006';
const messageId = '19000000-0000-4000-8000-000000000007';
const internalId = 'atrio-conversation:19000000-0000-4000-8000-000000000008';

function fixture(template = 7, selected = 'Lead', overrides = {}) {
  const state = h.fixture('rey_de_ases', { contact: false });
  state.tables.atrio_clients = [{ atrio_id: advisor, user_id: h.owner }];
  state.config = { ...h.config, send_contact_capi: false, send_lead_capi: selected === 'Lead',
    send_complete_registration_capi: selected === 'CompleteRegistration', ...overrides };
  state.tables.conversions_config[0] = state.config;
  state.landing.landing_config = { layout: { template }, tracking: { ctaMetaEvent: selected, pixelId: h.pixel } };
  state.input = { action: 'CONTACT', event_name: 'Contact', source_platform: 'landing', cta_destination: 'atrio',
    lead_capture_form: true, form_fn: 'Synthetic', cta_meta_event: selected,
    meta_pixel_id: h.pixel, landing_id: h.landingId, phone: '00000001',
    atrio_id: advisor, players_id: player, external_id: 'synthetic-player', promo_code: 'SYNTHETIC-fixture',
    fbc: state.base.fbc, fbp: state.base.fbp, event_source_url: h.sourceUrl, currency: 'ARS',
    contact_event_id: `fixture-cta-${template}-${selected}`, contact_event_time: h.now - 600,
    event_time: h.now - 600, agent_user: 'Synthetic human test browser', sendContactPixel: true };
  h.activate(state);
  return state;
}
async function contact(state) {
  h.activate(state);
  const ctx = {};
  const response = await h.api.handleContact(state.db, state.input, state.landing, state.config, state.tables.conversions_pixel_configs, ctx);
  assert.equal(response.status, 200, await response.clone().text());
  const row = state.tables.conversions.find(item => item.id === ctx.conversionId);
  assert.ok(row, 'CTA capture persisted');
  return row;
}
function internalPayload(patch = {}) {
  return { action: 'INTERNAL_CONVERSATION_STARTED', internal_event_name: 'conversation_started', source_platform: 'atrio',
    emitter_platform: 'atrio', action_event_id: internalId, atrio_id: advisor, players_id: player,
    conversation_id: conversation, message_id: messageId, promo_code: 'SYNTHETIC-fixture', phone: '00000001',
    event_time: h.now - 300, timestamp: (h.now - 300) * 1000,
    dateTime: new Date((h.now - 300) * 1000).toISOString(), ...patch };
}
async function internal(state, payload = internalPayload(), { signed = true } = {}) {
  h.activate(state);
  const body = JSON.stringify(payload), timestamp = String(h.now);
  const headers = { 'content-type': 'application/json' };
  if (signed) Object.assign(headers, { 'x-atrio-internal-timestamp': timestamp,
    'x-atrio-internal-signature': createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex') });
  return h.handlers.conversions(new Request('https://database.example.invalid/functions/v1/conversions?name=synthetic-client',
    { method: 'POST', headers, body }));
}
async function purchase(state, operation, extra = {}) {
  h.activate(state);
  const ctx = {};
  const input = { ...h.payload('rey_de_ases', operation), players_id: player, ...extra };
  const response = await h.api.handlePurchase(state.db, input, { ...state.landing, id: '', name: '' },
    state.config, state.tables.conversions_pixel_configs, ctx);
  assert.equal(response.status, 200, await response.clone().text());
  await h.api.completePurchaseEventClaim(state.db, ctx, 'processed');
  const row = state.tables.conversions.find(item => item.id === ctx.conversionId);
  assert.ok(row, 'Purchase recorded independently of delivery');
  return row;
}
function emitted(state) { return state.sent.map(send => send.payload.data[0]); }
function captureSnapshot(row) {
  return Object.fromEntries(['contact_event_id', 'contact_event_time', 'contact_payload_raw',
    'lead_event_id', 'lead_event_time', 'lead_payload_raw', 'lead_status_capi',
    'registration_event_id', 'registration_event_time', 'registration_payload_raw', 'registration_status_capi',
    'conversation_started_event_id', 'conversation_started_event_time', 'conversation_started_payload_raw'].map(key => [key, row[key]]));
}
async function check(name, run) { await run(); results.push(name); }
for (const template of [7, 8, 9]) for (const selected of ['Lead', 'CompleteRegistration']) {
  await check(`T${template} CTA ${selected}: Contact CAPI off, chosen event on, one delivery with original ID`, async () => {
    const state = fixture(template, selected), row = await contact(state);
    assert.equal(state.sent.length, 1);
    const event = emitted(state)[0];
    assert.equal(event.event_name, selected); assert.equal(event.event_id, state.input.contact_event_id);
    assert.equal(event.event_time, state.input.contact_event_time);
    assert.equal(event.user_data.fbc, state.input.fbc);
    assert.equal(state.sent[0].url, `https://graph.facebook.com/v25.0/${h.pixel}/events`);
    const stage = selected === 'Lead' ? 'lead' : 'registration';
    assert.equal(row[`${stage}_event_id`], row.contact_event_id);
    assert.equal(row[`${stage}_status_capi`], 'enviado');
    assert.equal(row.contact_status_capi, '', 'CTA capture is not a second public Contact delivery');
    assert.ok(!row.conversation_started_event_id, 'Advertising CTA does not manufacture a human message');
    const before = structuredClone(row);
    await contact(state);
    assert.equal(state.sent.length, 1, 'CTA retry does not resend the public event');
    assert.deepEqual(row, before);
  });
  await check(`T${template} selected ${selected} off remains off even with Contact CAPI on`, async () => {
    const state = fixture(template, selected, { send_contact_capi: true, send_lead_capi: false, send_complete_registration_capi: false });
    const row = await contact(state);
    assert.equal(state.sent.length, 0);
    assert.equal(row.contact_event_id, state.input.contact_event_id, 'Internal capture still exists');
  });
}

for (const selected of ['Lead', 'CompleteRegistration']) {
  await check(`${selected} CTA -> signed first human message -> first/repeat Purchase retains independent public/internal milestones`, async () => {
    const state = fixture(9, selected), capture = await contact(state);
    const ctaSnapshot = captureSnapshot(capture), sends = state.sent.length;
    const response = await internal(state);
    assert.equal(response.status, 200, await response.clone().text());
    const ack = await response.json();
    assert.equal(ack.ok, true); assert.equal(ack.action_event_id, internalId); assert.equal(ack.duplicate, false);
    assert.equal(ack.conversion_id, capture.id);
    assert.equal(capture.conversation_started_event_id, internalId);
    assert.equal(capture.conversation_started_event_time, h.now - 300);
    assert.equal(state.sent.length, sends, 'Human message has no Meta request');
    for (const key of Object.keys(ctaSnapshot).filter(key => !key.startsWith('conversation_started_')))
      assert.deepEqual(capture[key], ctaSnapshot[key], `Human message preserves public CTA ${key}`);
    const received = structuredClone(capture);
    const repeatedMessage = await internal(state);
    assert.equal(repeatedMessage.status, 200);
    assert.equal((await repeatedMessage.json()).duplicate, true);
    assert.deepEqual(capture, received); assert.equal(state.sent.length, sends);
    for (const conflict of [{ players_id: '19000000-0000-4000-8000-000000000099' },
      { message_id: '19000000-0000-4000-8000-000000000098' }, { event_time: h.now - 299 }]) {
      assert.equal((await internal(state, internalPayload(conflict))).status, 422);
      assert.deepEqual(capture, received); assert.equal(state.sent.length, sends);
    }
    const milestones = captureSnapshot(capture);
    const first = await purchase(state, `journey-first-${selected}`);
    assert.equal(first.purchase_type, 'first');
    assert.deepEqual(captureSnapshot(capture), milestones, 'First purchase preserves message and CTA');
    assert.equal(state.sent.length, sends + 1);
    const repeat = await purchase(state, `journey-repeat-${selected}`);
    assert.equal(repeat.purchase_type, 'repeat');
    assert.notEqual(first.purchase_event_id, repeat.purchase_event_id);
    assert.deepEqual(captureSnapshot(capture), milestones, 'Repeat purchase cannot overwrite acquisition milestones');
    assert.deepEqual(emitted(state).map(event => event.event_name), [selected, 'Purchase', 'Purchase']);
    for (const event of emitted(state).slice(1)) assert.equal(event.user_data.fbc, state.input.fbc);
  });
}

await check('unsigned internal requests cannot record milestones or send Meta', async () => {
  const state = fixture(); await contact(state);
  const before = structuredClone(state.tables.conversions), sends = state.sent.length;
  assert.equal((await internal(state, internalPayload(), { signed: false })).status, 401);
  assert.deepEqual(state.tables.conversions, before); assert.equal(state.sent.length, sends);
});

for (const action of ['Lead', 'Purchase']) {
  await check(`${action} with another configured pixel cannot overwrite or send outside the captured journey`, async () => {
    const state = action === 'Lead' ? fixture(1, 'Lead', { send_contact_capi: true }) : fixture(7, 'Lead');
    const otherPixel = '19000002';
    if (action === 'Lead') Object.assign(state.input, { cta_destination: 'whatsapp', lead_capture_form: false,
      form_fn: '', cta_meta_event: undefined });
    state.tables.conversions_pixel_configs.push({ ...state.config, id: 'second-pixel', pixel_id: otherPixel,
      is_default: false, send_lead_capi: true, send_purchase_capi: true, meta_ads_only_capi: false });
    const row = await contact(state), beforeCapture = row.contact_payload_raw, sends = state.sent.length;
    if (action === 'Purchase') await purchase(state, 'pixel-conflict-purchase', { meta_pixel_id: otherPixel });
    else {
      // Traditional WhatsApp uses a real Contact then a public human LEAD;
      // Atrio uses its separately signed internal-message action above.
      const response = await h.api.handleLead(state.db, { action: 'LEAD', source_platform: 'landing',
        phone: '00000001', promo_code: state.input.promo_code,
        action_event_id: 'human-pixel-conflict', meta_pixel_id: otherPixel, event_time: h.now - 300 },
        state.landing, state.config, state.tables.conversions_pixel_configs, {});
      assert.equal(response.status, 200, await response.clone().text());
    }
    assert.equal(row.pixel_id, h.pixel); assert.equal(row.meta_pixel_id, h.pixel);
    assert.equal(row.contact_payload_raw, beforeCapture); assert.equal(row.fbc, state.input.fbc);
    assert.equal(state.sent.length, sends, 'Conflicting configured pixel cannot receive this conversion');
  });
}

await check('traditional WhatsApp Contact -> human Lead retains the captured pixel and advertising context', async () => {
  const state = fixture(1, 'Lead', { send_contact_capi: true });
  Object.assign(state.input, { cta_destination: 'whatsapp', lead_capture_form: false, form_fn: '', cta_meta_event: undefined });
  const capture = await contact(state), original = capture.contact_payload_raw;
  const response = await h.api.handleLead(state.db, { action: 'LEAD', source_platform: 'landing',
    phone: '00000001', promo_code: state.input.promo_code, action_event_id: 'real-whatsapp-human', event_time: h.now - 300 },
    state.landing, state.config, [], {});
  assert.equal(response.status, 200, await response.clone().text());
  assert.deepEqual(emitted(state).map(event => event.event_name), ['Contact', 'Lead']);
  assert.equal(capture.pixel_id, h.pixel); assert.equal(capture.contact_payload_raw, original);
  assert.equal(emitted(state)[1].user_data.fbc, state.input.fbc);
  assert.equal(capture.meta_origin_evidence.method, 'fbc');
});

await check('an internal message waits for its exact CTA, and still records when the public event is disabled', async () => {
  const state = fixture(9, 'Lead', { send_lead_capi: false });
  assert.equal((await internal(state)).status, 503);
  assert.equal(state.tables.conversions.length, 0); assert.equal(state.sent.length, 0);
  const row = await contact(state);
  assert.equal(state.sent.length, 0);
  assert.equal((await internal(state)).status, 200);
  assert.equal(row.conversation_started_event_id, internalId); assert.equal(state.sent.length, 0);
});

await check('an unidentified internal message creates no Contact, pixel attribution or advertising event', async () => {
  const state = fixture();
  const payload = internalPayload({ promo_code: '', journey_context_ambiguous: true, journey_attribution_source: 'ambiguous' });
  const response = await internal(state, payload);
  assert.equal(response.status, 200, await response.clone().text());
  assert.equal(state.tables.conversions.length, 1);
  const row = state.tables.conversions[0];
  assert.equal(row.conversation_started_event_id, internalId);
  assert.ok(!row.contact_event_id); assert.ok(!row.pixel_id); assert.ok(!row.meta_pixel_id);
  assert.equal(row.from_meta_ads, false); assert.equal(state.sent.length, 0);
  assert.equal(JSON.parse(row.conversation_started_payload_raw).journey_context_ambiguous, true);
  assert.equal((await internal(state, payload)).status, 200);
  assert.equal(state.tables.conversions.length, 1);
});

assert.equal(h.externalRequests(), 0);
console.log(JSON.stringify({ scope: 'Real CTA, signed receiver, human Lead and Purchase handlers; DB/transport mocked. SQL triggers and concurrency verified separately.',
  passed: results.length, externalRequests: h.externalRequests(), productionWrites: 0, results }, null, 2));
