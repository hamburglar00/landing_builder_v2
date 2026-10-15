import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { chromium } from './browser-runtime.mjs';

// Existing allowlisted demos only. Probe intercepts the access POST itself.
// Access stops before loading provider content. No real accounts, conversions,
// games, wallet operations or personal contact data are submitted.
const [mode, directory, count = '3'] = process.argv.slice(2);
assert.ok(['probe', 'access'].includes(mode));
assert.ok(directory);
const samples = Number(count);
assert.ok(Number.isInteger(samples) && samples > 0 && samples <= 6);
const output = resolve(directory);
await mkdir(output, { recursive: true });
const browser = await chromium();
const pending = new Set(), requests = new Map(), results = [];
let current;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const providers = ['rey-de-ases-demo', 'ases-del-norte-demo', 'ganamos-net-demo', 'multi-skin-demo'];
const customOrigins = {
  'rey-de-ases-demo': 'https://www.reydeases.fun',
  'ases-del-norte-demo': 'https://www.asesdelnorte.online',
  'ganamos-net-demo': 'https://www.ganamosnet.icu',
  'multi-skin-demo': 'https://ganamosnet.global',
};
const probeProviders = (process.env.T7_PROBE_PROVIDERS || 'rey-de-ases-demo').split(',');
assert.ok(probeProviders.every(slug=>providers.includes(slug)));
const relevant = path => path.startsWith('/api/') || path === '/functions/v1/landing-atrio' || path === '/start';
const accessPost = path => /^\/api\/template7\/(prepare|start)$/.test(path);
const task = promise => {
  pending.add(promise);
  promise.catch(error => current?.errors.push(error.message)).finally(() => pending.delete(promise));
};
browser.on('Runtime.exceptionThrown', event => current?.errors.push(event.exceptionDetails.text));
browser.on('Runtime.consoleAPICalled', event => {
  const value = event.args?.[0]?.value;
  if (!current || typeof value !== 'string' || !value.startsWith('T7_STAGE3:')) return;
  const marker = JSON.parse(value.slice(10));
  if (marker.kind === 'account' && current.clickedAt && current.accountMs === null) current.accountMs = marker.at - current.clickedAt;
  if (marker.kind === 'error') current.uiError = marker.text;
});
browser.on('Fetch.requestPaused', event => task((async () => {
  const snapshot = current;
  const url = new URL(event.request.url);
  const entry = accessPost(url.pathname);
  const access = entry || /^\/api\/preparations\/(complete|finalize)$/.test(url.pathname) || url.pathname === '/api/client-identity/bootstrap';
  const telemetry = /facebook\.(com|net)$/.test(url.hostname) || /google-analytics|googletagmanager|vercel-insights/.test(url.hostname)
    || /\/api\/(track|journey-start)|\/_vercel\/(insights|speed-insights)/.test(url.pathname);
  const destination = event.resourceType === 'Document' && snapshot?.clickedAt
    && !['mkt.panelbotadmin.com', 'landing.panelbotadmin.com'].includes(url.hostname)
    && !['/prepare', '/start'].includes(url.pathname);
  if (entry && snapshot) snapshot.accessSentMs = Date.now() - snapshot.clickedAt;
  if (destination) {
    snapshot.destinationMs = Date.now() - snapshot.clickedAt;
    snapshot.destinationPath = url.pathname;
    snapshot.destinationOrigin = url.origin;
  }
  const intercept = telemetry || destination || event.resourceType === 'Subdocument'
    || (event.request.method === 'POST' && !access) || (mode === 'probe' && entry);
  if (!intercept) return browser.send('Fetch.continueRequest', { requestId: event.requestId });
  const script = event.resourceType === 'Script';
  await browser.send('Fetch.fulfillRequest', { requestId: event.requestId,
    responseCode: mode === 'probe' && entry ? 503 : 200,
    responseHeaders: [
      { name: 'Content-Type', value: script ? 'text/javascript' : destination ? 'text/html' : 'application/json' },
      { name: 'Access-Control-Allow-Origin', value: '*' },
    ],
    body: Buffer.from(script ? '/* telemetry disabled */' : destination ? '<!doctype html><p>Access measured</p>' : '{}').toString('base64'),
  });
})()));
function recordResponse(request, response, timestamp) {
  const row = { origin: request.origin, path: request.path, method: request.method, status: response.status,
    durationMs: Math.round((timestamp - request.at) * 1000),
    sinceClickMs: request.snapshot.clickedAt ? Date.now() - request.snapshot.clickedAt : null };
  request.snapshot.network.push(row);
  if (request.path === '/start' && (response.status === 200 || response.status >= 300 && response.status < 400)) {
    request.snapshot.sessionReadyMs = row.sinceClickMs;
  }
}
browser.on('Network.requestWillBeSent', event => {
  const previous = requests.get(event.requestId);
  if (event.redirectResponse && previous) {
    recordResponse(previous, event.redirectResponse, event.timestamp);
    requests.delete(event.requestId);
  }
  const path = new URL(event.request.url).pathname;
  if (current && relevant(path)) requests.set(event.requestId, {
    origin: new URL(event.request.url).origin, path, method: event.request.method, at: event.timestamp, snapshot: current,
  });
});
browser.on('Network.responseReceived', event => {
  const request = requests.get(event.requestId);
  if (!request) return;
  recordResponse(request, event.response, event.timestamp);
  request.response = event.response;
});
browser.on('Network.loadingFinished', event => {
  const request = requests.get(event.requestId);
  if (!request) return;
  requests.delete(event.requestId);
  if (request.path === '/functions/v1/landing-atrio' && request.method === 'GET') task((async () => {
    const response = await browser.send('Network.getResponseBody', { requestId: event.requestId });
    let data;
    try { data = JSON.parse(response.base64Encoded ? Buffer.from(response.body, 'base64').toString('utf8') : response.body); } catch {}
    request.snapshot.advisorResponses.push({
      status: request.response?.status,
      valid: Boolean((data?.atrioClientId || data?.atrio_client_id) && (data?.atrioId || data?.atrio_id) && (data?.atrioSlug || data?.atrio_slug)),
    });
  })());
});
browser.on('Network.loadingFailed', event => {
  const request = requests.get(event.requestId);
  if (!request) return;
  request.snapshot.network.push({ path: request.path, method: request.method, error: event.errorText, canceled: event.canceled });
  requests.delete(event.requestId);
});

async function inspectForm() {
  const response = await browser.send('Runtime.evaluate', { returnByValue: true, includeCommandLineAPI: true, expression: `
    (()=>{const button=document.querySelector('.template7__cta'),input=document.querySelector('[data-template7-name]');
    return {path:location.pathname,readyState:document.readyState,buttonDisabled:button?.disabled,
      buttonText:button?.textContent,clickListeners:button?(getEventListeners(button).click||[]).length:0,
      namePresent:Boolean(input?.value),errorText:document.querySelector('[data-template7-error]')?.textContent,
      identityPending:Boolean(window.__LB_IDENTITY_READY__),inlineScripts:document.querySelectorAll('[data-template7-fast] script').length};
    })()` });
  return response.result.value;
}
try {
  await browser.send('Page.enable'); await browser.send('Runtime.enable'); await browser.send('Network.enable');
  await browser.send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
  await browser.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await browser.send('Network.setCacheDisabled', { cacheDisabled: true });
  await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: `
    var accountReported=false,errorReported='';setInterval(function(){
      var view=document.getElementById('state')?.dataset.view;
      if(view==='account'&&!accountReported){accountReported=true;console.log('T7_STAGE3:'+JSON.stringify({kind:'account',at:Date.now()}));}
      var text=document.querySelector('[data-template7-error]')?.textContent||'';
      if(view==='error')text='Gateway preparation failed';
      if(text&&text!==errorReported){errorReported=text;console.log('T7_STAGE3:'+JSON.stringify({kind:'error',text:text}));}
    },20);
  ` });
  for (let sample = 1; sample <= samples; sample++) {
    // Alternate engine order to avoid always measuring the same provider cold.
    const engines = mode === 'probe' ? ['classic'] : sample % 2 ? ['constructor', 'classic'] : ['classic', 'constructor'];
    for (const engine of engines) for (const slug of mode === 'probe' ? probeProviders : providers) {
      await browser.send('Page.navigate', { url: 'about:blank' });
      await pause(150); await Promise.all([...pending]); requests.clear();
      await browser.send('Network.clearBrowserCookies');
      const origin = engine === 'constructor' ? 'https://mkt.panelbotadmin.com' : 'https://landing.panelbotadmin.com';
      await browser.send('Storage.clearDataForOrigin', { origin, storageTypes: 'all' });
      current = { mode, sample, engine, slug, navigationAt: Date.now(), clickedAt: null,
        formReadyMs: null, accessSentMs: null, accountMs: null, sessionReadyMs: null, destinationMs: null,
        network: [], advisorResponses: [], errors: [] };
      const url = origin + (engine === 'constructor' ? '/l/' : '/') + slug + (engine === 'constructor' ? '/testing' : '');
      await browser.send('Page.navigate', { url });
      for (let i = 0; i < 150; i++) {
        let ready;
        try { ready = await browser.evaluate(`(()=>{
          if(location.href!==${JSON.stringify(url)})return false;
          const input=document.querySelector('[data-template7-name]'),button=document.querySelector('.template7__cta');
          if(!input||!button)return false;input.value='Prueba';input.dispatchEvent(new Event('input',{bubbles:true}));
          return !button.disabled;
        })()`); } catch {}
        if (ready) { current.formReadyMs = Date.now() - current.navigationAt; break; }
        await pause(100);
      }
      if (current.formReadyMs !== null) {
        // Probe half the samples after hydration to detect detached listeners.
        if (mode === 'probe' && sample % 2 === 0) await pause(2500);
        current.beforeClick = await inspectForm();
        current.clickedAt = Date.now();
        current.click = await browser.evaluate(`(()=>{
          const button=document.querySelector('.template7__cta');
          const result={disabledAtClick:button.disabled,namePresent:Boolean(document.querySelector('[data-template7-name]')?.value),eventDispatched:false,hidden:document.hidden};
          result.trace=[];
          const windowObserve=event=>result.trace.push({at:'window',cancelBubble:event.cancelBubble});
          const documentObserve=event=>result.trace.push({at:'document',cancelBubble:event.cancelBubble});
          window.addEventListener('click',windowObserve,{capture:true});
          document.addEventListener('click',documentObserve,{capture:true});
          const observe=()=>{result.eventDispatched=true};
          button.addEventListener('click',observe,{once:true,capture:true});
          button.click();button.removeEventListener('click',observe,{capture:true});
          window.removeEventListener('click',windowObserve,{capture:true});
          document.removeEventListener('click',documentObserve,{capture:true});
          result.disabledAfterClick=button.disabled;result.textAfterClick=button.textContent;
          return result;
        })()`);
        for (let i=0;i<(mode === 'probe' ? 80 : 300);i++) {
          if (mode === 'probe' ? current.accessSentMs !== null : current.destinationMs !== null) break;
          if (current.uiError) break;
          await pause(100);
        }
      }
      await pause(100); await Promise.all([...pending]);
      const expected = slug === 'rey-de-ases-demo' ? '/casino/list/home' : slug === 'ases-del-norte-demo' ? '/jugadores/home.php' : '/home';
      current.ok = mode === 'probe' ? current.accessSentMs !== null
        : current.destinationPath === expected && current.sessionReadyMs !== null;
      if (mode === 'access' && process.env.T7_GATEWAY_DOMAIN_CHECK === 'true') {
        const expectedOrigin = customOrigins[slug];
        const starts = current.network.filter(row => row.path === '/start');
        current.customDomainOk = current.destinationOrigin === expectedOrigin && starts.length > 0
          && starts.every(row => row.origin === expectedOrigin);
        const { cookies } = await browser.send('Network.getCookies', { urls: [expectedOrigin] });
        current.sessionCookies = cookies.filter(cookie => /gateway_session|^gw_session$/.test(cookie.name))
          .map(cookie => ({ name: cookie.name, domain: cookie.domain, secure: cookie.secure, httpOnly: cookie.httpOnly }));
        current.customDomainOk &&= current.sessionCookies.some(cookie => cookie.secure && cookie.httpOnly);
        current.ok &&= current.customDomainOk;
      }
      current.afterClick = await inspectForm();
      if (mode === 'probe' && current.ok) delete current.uiError; // expected injected 503
      current.observedAt = new Date().toISOString();
      delete current.navigationAt; delete current.clickedAt;
      results.push(current);
      console.log(JSON.stringify({mode,sample,engine,slug,ok:current.ok,accountMs:current.accountMs,sessionReadyMs:current.sessionReadyMs,destinationMs:current.destinationMs,click:current.click,uiError:current.uiError,errors:current.errors}));
      await writeFile(join(output, mode + '.json'), JSON.stringify({
        profile:'390x844 DPR2, normal connection, browser cache disabled, cold cookies, analytics intercepted; existing demo accounts only; provider document intercepted before rendering',
        samples, results,
      }, null, 2));
    }
  }
} finally { await Promise.all([...pending]); await browser.close(); }
if (results.some(row => !row.ok)) process.exitCode = 1;
