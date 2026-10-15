import assert from 'node:assert/strict';
import { chromium } from './browser-runtime.mjs';

// Requires a local production build on port 3093. Initial HTML/assets are read
// locally; every POST and all external requests are intercepted, never forwarded.
const origin = 'http://127.0.0.1:3093';
const browser = await chromium();
const errors = [], requests = [], pending = new Set();
browser.on('Runtime.exceptionThrown', event => errors.push(event.exceptionDetails.exception?.description || event.exceptionDetails.text));
browser.on('Fetch.requestPaused', event => {
  const task = (async () => {
    const url = new URL(event.request.url);
    requests.push({ path: url.pathname, method: event.request.method });
    if (url.origin === origin && event.request.method === 'GET' && !url.pathname.startsWith('/api/')) {
      if (event.resourceType === 'Script' && url.pathname.startsWith('/_next/')) await new Promise(resolve => setTimeout(resolve, 2500));
      await browser.send('Fetch.continueRequest', { requestId: event.requestId });
      return;
    }
    const isAdvisor = url.pathname.includes('landing-atrio');
    const content = isAdvisor ? JSON.stringify({ atrioClientId: 'a0000000-0000-4000-8000-000000000002', atrioId: 'a0000000-0000-4000-8000-000000000003', atrioSlug: 'synthetic' })
      : event.resourceType === 'Script' ? '/* external script intercepted */' : '{}';
    await browser.send('Fetch.fulfillRequest', {
      requestId: event.requestId, responseCode: 200,
      responseHeaders: [{ name: 'Content-Type', value: event.resourceType === 'Script' ? 'text/javascript' : 'application/json' }, { name: 'Access-Control-Allow-Origin', value: '*' }, { name: 'Access-Control-Allow-Headers', value: 'authorization,apikey,content-type' }],
      body: Buffer.from(content).toString('base64'),
    });
  })().catch(error => errors.push(error.message));
  pending.add(task); void task.finally(() => pending.delete(task));
});
try {
  await browser.send('Page.enable'); await browser.send('Runtime.enable');
  await browser.send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
  await browser.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await browser.send('Page.navigate', { url: origin + '/rey-de-ases-demo' });
  const first = await browser.evaluate(`new Promise((resolve,reject)=>{
    const until=Date.now()+15000;
    function check(){
      const field=document.querySelector('[data-template7-name]'),button=document.querySelector('.template7__cta');
      if(field){field.value='Prueba sin enviar';field.dispatchEvent(new Event('input',{bubbles:true}));}
      if(button&&!button.disabled) return resolve({state:document.readyState,value:field.value});
      if(Date.now()>until)return reject(new Error('No fast form'));
      setTimeout(check,25);
    }check();
  })`);
  assert.notEqual(first.state, 'complete', 'Form unexpectedly waited for full page load');
  await new Promise(resolve => setTimeout(resolve, 7000));
  const after = await browser.evaluate(`({state:document.readyState,value:document.querySelector('[data-template7-name]')?.value,disabled:document.querySelector('.template7__cta')?.disabled,pixels:(window.fbq?.queue||[]).filter(args=>args[0]==='track'&&args[1]==='PageView').length})`);
  assert.equal(after.state, 'complete');
  assert.equal(after.value, 'Prueba sin enviar', 'Hydration erased the input');
  assert.equal(after.disabled, false, 'Hydration disabled the form');
  assert.ok(after.pixels <= 1, 'Hydration duplicated PageView');
  assert.deepEqual(errors, []);
  assert.equal(requests.some(request => request.path === '/api/template7/start'), false);
  console.log(JSON.stringify({ first, after, errors, outgoingRequestsIntercepted: true }));
} finally { await Promise.all([...pending]); await browser.close(); }
