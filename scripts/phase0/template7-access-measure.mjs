import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from './browser-runtime.mjs';

// Uses only existing, allowlisted demo accounts. Classic's real-account
// integration is disabled; constructor enters exclusively through /testing.
// Never submit a phone, send Meta events, open a game or interact with a wallet.
const stage = process.argv[2];
assert.ok(['before', 'after'].includes(stage));
const output = resolve(process.argv[3] || join(tmpdir(), 'template7-access-20261015'));
await mkdir(output, { recursive: true });
const browser = await chromium();
const pause = ms => new Promise(r => setTimeout(r, ms));
const results = [];
try { results.push(...JSON.parse(await readFile(join(output, `${stage}.json`), 'utf8')).results); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const pending = new Set();
let current;
browser.on('Runtime.exceptionThrown', event => current?.errors.push(event.exceptionDetails.text));
browser.on('Runtime.consoleAPICalled', event => {
  const value = event.args?.[0]?.value;
  if (typeof value !== 'string' || !value.startsWith('T7_MEASURE:') || !current?.clickedAt) return;
  const marker = JSON.parse(value.slice(11));
  if (marker.state === 'account' && current.accountMs === null) current.accountMs = marker.at - current.clickedAt;
  if (marker.state === 'error') current.failed = true;
});
browser.on('Fetch.requestPaused', event => {
  const snapshot = current;
  const task = (async () => {
    const url = new URL(event.request.url);
    const start = /^\/api\/template7\/(prepare|start)$/.test(url.pathname);
    const access = start || /^\/api\/preparations\/(complete|finalize)$/.test(url.pathname) || url.pathname === '/api/client-identity/bootstrap';
    const analytics = /facebook\.(com|net)$/.test(url.hostname) || /google-analytics|googletagmanager|vercel-insights/.test(url.hostname)
      || /\/api\/(track|journey-start)|\/_vercel\/(insights|speed-insights)/.test(url.pathname);
    const gatewayDocument = event.resourceType === 'Document' && snapshot?.clickedAt
      && !['mkt.panelbotadmin.com', 'landing.panelbotadmin.com'].includes(url.hostname)
      && !['/prepare','/start'].includes(url.pathname);
    if (gatewayDocument) {
      snapshot.destinationMs = Date.now() - snapshot.clickedAt;
      snapshot.destinationPath = url.pathname;
    }
    const block = analytics || gatewayDocument || event.resourceType === 'Subdocument'
      || (event.request.method === 'POST' && !access);
    if (block) {
      const script = event.resourceType === 'Script';
      await browser.send('Fetch.fulfillRequest', { requestId: event.requestId, responseCode: 200,
        responseHeaders: [{ name: 'Content-Type', value: script ? 'text/javascript' : gatewayDocument ? 'text/html' : 'application/json' }, { name: 'Access-Control-Allow-Origin', value: '*' }],
        body: Buffer.from(script ? '/* measurement: telemetry disabled */' : gatewayDocument ? '<!doctype html><p>Access measurement complete</p>' : '{}').toString('base64') });
    } else await browser.send('Fetch.continueRequest', { requestId: event.requestId });
  })().catch(error => snapshot?.errors.push(error.message));
  pending.add(task); void task.finally(() => pending.delete(task));
});
const requests = new Map();
function recordResponse(request, response, timestamp) {
  request.snapshot?.stages.push({ path: request.path, status: response.status, durationMs: Math.round((timestamp-request.at)*1000) });
  if (request.path === '/start' && (response.status === 200 || (response.status >= 300 && response.status < 400)) && request.snapshot?.clickedAt) {
    request.snapshot.sessionReadyMs = Date.now()-request.snapshot.clickedAt;
  }
}
browser.on('Network.requestWillBeSent', event => {
  // Navigations report a redirect here, not through responseReceived. Record
  // /start before the intercepted destination can finish the current sample.
  const redirected = requests.get(event.requestId);
  if (event.redirectResponse && redirected) {
    recordResponse(redirected, event.redirectResponse, event.timestamp);
    requests.delete(event.requestId);
  }
  const url = new URL(event.request.url);
  if (/^\/api\/(template7\/(prepare|start)|preparations\/(complete|finalize))$/.test(url.pathname) || url.pathname === '/start') {
    requests.set(event.requestId, { path: url.pathname, at: event.timestamp, snapshot: current });
  }
});
browser.on('Network.responseReceived', event => {
  const path = new URL(event.response.url).pathname;
  if (current && path.startsWith('/api/')) {
    (current.apiResponses ||= []).push({ path, status: event.response.status });
  }
  const request = requests.get(event.requestId);
  if (!request) return;
  recordResponse(request, event.response, event.timestamp);
  requests.delete(event.requestId);
});
try {
  await browser.send('Page.enable'); await browser.send('Runtime.enable'); await browser.send('Network.enable');
  await browser.send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
  await browser.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: `
    var reported='';setInterval(function(){var state=document.getElementById('state');var view=state&&state.dataset.view;if(view&&view!==reported){reported=view;console.log('T7_MEASURE:'+JSON.stringify({state:view,at:Date.now()}));}},20);
  ` });
  for (const engine of ['constructor','classic']) for (const slug of ['rey-de-ases-demo','ases-del-norte-demo','ganamos-net-demo','multi-skin-demo']) {
    if (results.some(r => r.engine === engine && r.slug === slug)) continue;
    await Promise.all([...pending]);
    await browser.send('Page.navigate', { url: 'about:blank' }); await pause(100);
    await browser.send('Network.clearBrowserCookies');
    const origin = engine === 'constructor' ? 'https://mkt.panelbotadmin.com' : 'https://landing.panelbotadmin.com';
    await browser.send('Storage.clearDataForOrigin', { origin, storageTypes: 'all' });
    current = { engine, slug, clickedAt: null, accountMs: null, sessionReadyMs: null, destinationMs: null, stages: [], errors: [] };
    const url = origin + (engine === 'constructor' ? '/l/' : '/') + slug + (engine === 'constructor' ? '/testing' : '');
    await browser.send('Page.navigate', { url });
    let formReady = false;
    for (let i=0;i<150;i++) {
      try { formReady = await browser.evaluate(`(()=>{if(location.href!==${JSON.stringify(url)})return false;var input=document.querySelector('[data-template7-name]');var button=document.querySelector('.template7__cta');if(!input||!button)return false;input.value='Prueba';input.dispatchEvent(new Event('input',{bubbles:true}));return !button.disabled;})()`); } catch {}
      if (formReady) break; await pause(100);
    }
    if (formReady) {
      current.clickedAt = Date.now();
      await browser.evaluate(`document.querySelector('.template7__cta').click()`);
      for(let i=0;i<450&&!current.destinationMs&&!current.failed;i++) await pause(100);
    } else current.failed = true;
    const expectedPath = slug === 'rey-de-ases-demo' ? '/casino/list/home'
      : slug === 'ases-del-norte-demo' ? '/jugadores/home.php' : '/home';
    current.ok = Boolean(current.destinationMs && current.sessionReadyMs && current.destinationPath === expectedPath && !current.errors.length);
    if (!current.ok) {
      try {
        current.diagnostic = await browser.evaluate(`(()=>{var button=document.querySelector('.template7__cta');return {path:location.pathname,view:document.getElementById('state')?.dataset.view,buttonDisabled:button?.disabled,buttonText:button?.textContent,errorText:document.querySelector('[data-template7-error]')?.textContent,namePresent:Boolean(document.querySelector('[data-template7-name]')?.value),readyState:document.readyState};})()`);
      } catch {}
    }
    delete current.clickedAt;
    results.push(current);
    console.log(JSON.stringify(current));
    await writeFile(join(output, `${stage}.json`), JSON.stringify({stage, profile:'390x844 DPR2; normal connection; cold cookies; one existing-demo login per engine/provider; tracking and final destination intercepted', results},null,2));
  }
} finally { await Promise.all([...pending]); await browser.close(); }
assert.equal(results.length, 8, 'all engine/provider combinations must be measured');
assert.ok(results.every(sample => sample.ok), 'every demo must establish a session and reach the expected destination');
