import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(new URL('../frontend/package.json', import.meta.url));
const { build } = require('esbuild');
let playwright;
try { playwright = require(path.join(process.env.APPDATA, 'npm/node_modules/playwright')); }
catch { playwright = require('playwright'); }
const compiled = await build({ stdin: { contents: "export * from './lib/landing/entryFunnel.bootstrap'; export {buildEntryFunnelFactoryScript} from './lib/landing/entryFunnel.client';", resolveDir: new URL('../frontend/',import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/,''), loader:'ts' },
  bundle: true, write: false, platform: 'node', format: 'esm', target: 'es2022', keepNames: true });
const helper = await import('data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const landingId = 'f0000000-0000-4000-8000-000000000001';
process.env.ENTRY_FUNNEL_RELEASE = 'a'.repeat(40);
delete process.env.VERCEL_GIT_COMMIT_SHA;
process.env.VERCEL_ENV = 'preview';
let checks = 0;
for (const [browserName, browserType] of [['Chromium',playwright.chromium],['WebKit',playwright.webkit]]) {
  const browser = await browserType.launch({headless:true});
  try {
    for (const engine of ['classic','constructor']) for (let template=1;template<=9;template++) {
      const context = await browser.newContext();
      try {
        const page = await context.newPage();
        const batches = [];
        await context.exposeBinding('__testFunnelBeacon',(_source,body)=>{batches.push(JSON.parse(body));});
        await context.addInitScript(()=>{
          const native=navigator.sendBeacon.bind(navigator);
          navigator.sendBeacon=(url,data)=>{
            if(String(url)==='/api/entry-funnel'&&data instanceof Blob)data.text().then(body=>window.__testFunnelBeacon(body));
            return native(url,data);
          };
        });
        const script = template<=6 ? helper.buildLandingEntryFunnelScript({landingId,template,engine}) : helper.buildEntryFunnelMetadataScript(engine);
        // The complete observer is installed by the deferred static runtime;
        // the inline T1–T6 bootstrap now only captures early events/failures.
        const install = `(${helper.buildEntryFunnelFactoryScript()})(${JSON.stringify({landingId,template})});`;
        await page.route('**/*', async route => {
          if (new URL(route.request().url()).pathname === '/api/entry-funnel') {
            const body=route.request().postData();
            if(body)batches.push(JSON.parse(body));
            return route.fulfill({status:204});
          }
          return route.fulfill({contentType:'text/html',body:`<!doctype html><html><head><script>${script}</script></head><body>
            <form data-entry-funnel-form><input data-entry-funnel-name required><button type="button" data-public-landing-cta>Continuar</button></form>
            <script>${install}document.querySelector('button').addEventListener('click',function(){
              ${template>6 ? "window.__entryFunnel.emit('cta_clicked');" : ''}
              window.__entryFunnel.emit(${JSON.stringify(template<=6?'outbound_requested':'chat_usable')});
              window.__entryFunnel.flush(true);
            });</script></body></html>`});
        });
        const origin = engine==='classic'?'https://landing.panelbotadmin.com':'https://mkt.panelbotadmin.com';
        await page.goto(origin+'/fixture');
        await page.locator('input').fill('private-name-never-collect');
        await page.waitForFunction(()=>!!window.__entryFunnel);
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        const milestone = template<=6?'outbound_requested':'chat_usable';
        await page.locator('button').click();
        // WebKit may omit sendBeacon postData/response events. Observe its native
        // body above without replacing transport; every request stays intercepted.
        for(let poll=0;poll<200&&!batches.some(b=>b.events.some(e=>e.name===milestone));poll++) await page.waitForTimeout(25);
        assert.ok(batches.some(b=>b.events.some(e=>e.name===milestone)),`${browserName}/${engine}/T${template}: missing ${milestone}`);
        const events = [...new Map(batches.flatMap(b=>b.events).map(event=>[event.id,event])).values()];
        assert.ok(events.some(e=>e.name==='page_visible'));
        assert.ok(events.some(e=>e.name==='cta_available'));
        assert.equal(events.filter(e=>e.name==='cta_clicked').length,1);
        const clicked=events.find(e=>e.name==='cta_clicked');
        const reached=events.find(e=>e.name===(template<=6?'outbound_requested':'chat_usable'));
        assert.equal(clicked.attempt_id,reached.attempt_id);
        assert.ok(events.every(e=>e.engine===engine&&e.release==='a'.repeat(40)&&e.environment==='preview'&&['synthetic','unknown'].includes(e.source)));
        assert.ok(events.some(e=>e.name==='stage_timing'&&e.phase==='landing_runtime'));
        assert.doesNotMatch(JSON.stringify(batches),/private-name|password|fbclid|https:\/\//);
        assert.ok(batches.every(b=>b.template===template));
        checks++;
      } finally { await context.close(); }
    }
    console.log(browserName+': all 18 engine/template combinations preserve metadata, CTA attempts, timings and privacy.');
  } finally { await browser.close(); }
}
console.log(`${checks} isolated browser scenarios passed; every network request was intercepted, no production events.`);
