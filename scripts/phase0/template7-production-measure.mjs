import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from './browser-runtime.mjs';

// Public production pages, real assets, no CTA submission or conversion writes.
// Browser cold-cache, fixed simulated mobile connection; not field/RUM data.
const stage = process.argv[2];
assert.ok(['before', 'after'].includes(stage), 'Pass before or after');
const output = resolve(process.argv[3] || join(tmpdir(), 'template7-release-20261015'));
await mkdir(output, { recursive: true });
const browser = await chromium();
const results = [], pending = new Set();
try { results.push(...JSON.parse(await readFile(join(output, stage + '.json'), 'utf8')).results); } catch (error) { if (error.code !== 'ENOENT') throw error; }
let current;
browser.on('Runtime.exceptionThrown', event => current?.errors.push(event.exceptionDetails.text));
browser.on('Fetch.requestPaused', event => {
  const task = (async () => {
    const url = new URL(event.request.url);
    const identity = url.pathname === '/api/client-identity/bootstrap';
    const telemetry = /facebook\.(com|net)$/.test(url.hostname) || /google-analytics|googletagmanager|vercel-insights|vitals\.vercel/.test(url.hostname)
      || /\/api\/(track|journey-start)|\/_vercel\/(insights|speed-insights)/.test(url.pathname);
    if (telemetry || (event.request.method !== 'GET' && event.request.method !== 'OPTIONS' && !identity)) {
      if (url.pathname === '/api/template7/start' || url.pathname === '/api/template7/prepare') throw new Error('Unexpected account creation request');
      current?.blocked.push(url.hostname + url.pathname);
      await browser.send('Fetch.fulfillRequest', { requestId: event.requestId, responseCode: 200,
        responseHeaders: [{ name: 'Content-Type', value: event.resourceType === 'Script' ? 'text/javascript' : 'application/json' }, { name: 'Access-Control-Allow-Origin', value: '*' }],
        body: Buffer.from(event.resourceType === 'Script' ? '/* measurement: analytics disabled */' : '{}').toString('base64') });
    } else await browser.send('Fetch.continueRequest', { requestId: event.requestId });
  })().catch(error => current?.errors.push(error.message));
  pending.add(task); void task.finally(() => pending.delete(task));
});
try {
  await browser.send('Page.enable'); await browser.send('Runtime.enable'); await browser.send('Network.enable');
  await browser.send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
  await browser.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await browser.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await browser.send('Network.emulateNetworkConditions', { offline: false, latency: 100, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8, connectionType: 'cellular4g' });
  await browser.send('Network.setCacheDisabled', { cacheDisabled: true });
  await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__measurement = { formReady: null, logoReady: null, lcp: null };
    try { new PerformanceObserver(list => { for (const entry of list.getEntries()) window.__measurement.lcp = entry.startTime; }).observe({type:'largest-contentful-paint',buffered:true}); } catch {}
    const monitor = setInterval(() => {
      const input=document.querySelector('[data-template7-name],#template7-name');
      const button=document.querySelector('.template7__cta');
      if(input && button && window.__measurement.formReady === null){
        if(input.value !== 'Medicion sin enviar' || button.disabled){
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'');
          input.dispatchEvent(new Event('input',{bubbles:true}));
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Medicion sin enviar');
          input.dispatchEvent(new Event('input',{bubbles:true}));
          input.dispatchEvent(new Event('change',{bubbles:true}));
        }
        if(!button.disabled && input.getBoundingClientRect().width > 0)window.__measurement.formReady=performance.now();
      }
      const logo=document.querySelector('.template7__logo');
      if(logo?.complete && logo.naturalWidth && window.__measurement.logoReady === null)window.__measurement.logoReady=performance.now();
      if(window.__measurement.formReady !== null && window.__measurement.logoReady !== null)clearInterval(monitor);
    },25);
  ` });
  for (const engine of ['constructor', 'classic']) for (const slug of ['rey-de-ases-demo', 'ases-del-norte-demo', 'ganamos-net-demo', 'multi-skin-demo']) {
    const origin = engine === 'constructor' ? 'https://mkt.panelbotadmin.com' : 'https://landing.panelbotadmin.com';
    const url = origin + (engine === 'constructor' ? '/l/' : '/') + slug;
    for (let sample = 1; sample <= 3; sample++) {
      if (results.some(row => row.engine === engine && row.slug === slug && row.sample === sample && row.formReady !== null)) continue;
      await Promise.all([...pending]); await browser.send('Network.clearBrowserCookies');
      await browser.send('Storage.clearDataForOrigin', { origin, storageTypes: 'all' });
      current = { engine, slug, sample, errors: [], blocked: [] };
      await browser.send('Page.navigate', { url });
      await browser.evaluate(`new Promise(resolve=>{const stop=Date.now()+25000;const poll=setInterval(()=>{if(window.__measurement?.formReady !== null && window.__measurement?.formReady !== undefined || Date.now()>stop){clearInterval(poll);resolve(true)}},50)})`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      const metrics = await browser.evaluate(`(() => {
        const navigation=performance.getEntriesByType('navigation')[0], images=[...document.images];
        return { ...window.__measurement, ttfb:navigation?.responseStart, domContentLoaded:navigation?.domContentLoadedEventEnd,
          fcp:performance.getEntriesByName('first-contentful-paint')[0]?.startTime,
          htmlBytes:navigation?.encodedBodySize, totalTransfer:performance.getEntriesByType('resource').reduce((sum,r)=>sum+r.transferSize,0)+(navigation?.transferSize||0),
          optimized:!!document.querySelector('[data-template7-critical]'), imageCount:images.length,
          brokenImages:images.filter(img=>img.complete && !img.naturalWidth && !img.src.includes('facebook.com')).map(img=>img.className),
          logoSource:(()=>{try{const u=new URL(document.querySelector('.template7__logo')?.currentSrc);return u.pathname.includes('/render/image/')?'optimized':'original'}catch{return 'missing'}})(),
          overflow:document.documentElement.scrollWidth>innerWidth+1
        };
      })()`);
      const result = { ...current, ...metrics }; results.push(result); console.log(JSON.stringify(result));
      await writeFile(join(output, stage + '.json'), JSON.stringify({ stage, profile: '390x844 DPR2, CPU4x, 100ms RTT, 1.6Mbps, browser cache disabled, 3 samples/page, tracking intercepted', results }, null, 2));
      if (sample === 1) { const shot = await browser.send('Page.captureScreenshot', { format: 'png' }); await writeFile(join(output, `${stage}-${engine}-${slug}.png`), Buffer.from(shot.data, 'base64')); }
    }
  }
  assert.ok(results.every(row => row.formReady !== null), 'Some forms did not become interactive');
  console.log('Measurements saved in ' + output);
} finally { await Promise.all([...pending]); await browser.close(); }
