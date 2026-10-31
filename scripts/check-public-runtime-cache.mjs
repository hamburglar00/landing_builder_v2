// Focused regression: a real browser HTTP cache contains old immutable v6.
// All services stay on loopback; CSP, stub Pixel/SDK and redirect timer prevent
// external events/navigation. The landing HTML and new runtime are unmodified.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url)), frontend=path.join(root,'frontend');
const require=createRequire(path.join(frontend,'package.json'));
const {build}=require('esbuild');
const {chromium,webkit}=require(path.join(process.env.APPDATA,'npm/node_modules/playwright'));
// Never embed developer environment configuration in the fixture.
for(const key of ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','NEXT_PUBLIC_META_IP_COLLECTOR_URL'])delete process.env[key];
const bundle=await build({absWorkingDir:frontend,stdin:{resolveDir:frontend,loader:'ts',contents:`export {renderPublicLandingHtml} from './components/public-landing/renderPublicLandingHtml';`},bundle:true,write:false,platform:'node',format:'cjs',external:['react','react/jsx-runtime']});
const loaded={exports:{}};
new Function('require','module','exports',bundle.outputFiles[0].text)(require,loaded,loaded.exports);
const asset=JSON.parse(await readFile(path.join(frontend,'components/public-landing/publicLandingRuntimeAsset.generated.json'),'utf8'));
const assetUrl='/public-assets/template-entry/'+asset.name;
const source=await readFile(path.join(frontend,'public',assetUrl),'utf8');
const rows=[];
for(const [browserName,launcher,template,currentClick] of [['Chromium',chromium,1,''],['WebKit',webkit,6,'CurrentUrlSyntheticClick']]){
  const slug='cached-runtime-fixture',id='f0000000-0000-4000-8000-000000000001',pixel='123456';
  const legacy='fb.1.'+(Date.now()-86400000)+'.ForeignCachedClick';
  const html=loaded.exports.renderPublicLandingHtml({slug,config:{schemaVersion:1,updatedAt:'',id,name:slug,comment:'',workspaceCurrency:'ARS',layout:{template,ctaPosition:'bottom'},tracking:{pixelId:pixel,postUrl:'/fixture-conversions',landingTag:'TEST'},content:{logoUrl:'',title:['Fixture'],subtitle:[],ctaText:'Continuar'}}});
  let oldHits=0,newHits=0;const contacts=[],journeys=[];
  const server=createServer(async(req,res)=>{
    const url=new URL(req.url,'http://fixture.test');
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; form-action 'none'");
    if(url.pathname==='/public-assets/landing-runtime-v6.js'){
      oldHits++;res.setHeader('Cache-Control','public, max-age=31536000, immutable');res.setHeader('Content-Type','text/javascript');return res.end('window.__STALE_V6_EXECUTED__=true;');
    }
    if(url.pathname===assetUrl){newHits++;res.setHeader('Cache-Control','public, max-age=31536000, immutable');res.setHeader('Content-Type','text/javascript');return res.end(source);}
    if(url.pathname.startsWith('/prime')){res.setHeader('Content-Type','text/html');return res.end('<script src="/public-assets/landing-runtime-v6.js"></script>');}
    if(url.pathname==='/'+slug){res.setHeader('Content-Type','text/html');return res.end(html);}
    if(req.method==='POST'){
      let raw='';for await(const chunk of req)raw+=chunk;
      const body=JSON.parse(raw||'{}');
      if(url.pathname==='/api/track'&&body.payload?.event_name==='Contact')contacts.push(body.payload);
      if(url.pathname==='/api/journey-start')journeys.push(body);
      res.setHeader('Content-Type','application/json');return res.end('{"ok":true}');
    }
    res.setHeader('Content-Type',url.pathname.endsWith('.js')?'text/javascript':'text/css');res.end('');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  const browser=await launcher.launch({headless:true});
  try{
    const context=await browser.newContext();
    await context.addCookies([{name:'_fbc',value:legacy,url:origin}]);
    await context.addInitScript(({slug,legacy})=>{
      window.fbq=()=>{};
      window.clientParamBuilder={processAndCollectAllParams:()=>Promise.resolve({}),getFbc:()=>legacy,getFbp:()=>''};
      window.__ATRIO_META_COLLECT_CLICK_ID__=()=>Promise.resolve(null);
      window.__PUBLIC_LANDING_PHONE_PROMISES={[slug]:Promise.resolve({phone:'5491112345678'})};
      Object.defineProperty(navigator,'sendBeacon',{value:()=>false});
      const timer=window.setTimeout;
      window.setTimeout=function(callback,delay,...args){if(String(callback).includes('window.location.assign'))return 0;return timer(callback,delay,...args);};
    },{slug,legacy});
    const page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(origin+'/prime-1');assert.equal(await page.evaluate(()=>window.__STALE_V6_EXECUTED__),true);
    await page.goto(origin+'/prime-2');assert.equal(await page.evaluate(()=>window.__STALE_V6_EXECUTED__),true);
    assert.equal(oldHits,1,'second document really reused the cached immutable v6');
    await page.goto(origin+'/'+slug+(currentClick?'?fbclid='+currentClick:''));
    await page.waitForFunction(()=>typeof window.__PUBLIC_META_COLLECT_PARAMS==='function');
    if(!contacts.length)await page.locator('[data-public-landing-cta]').first().dispatchEvent('click');
    for(let attempt=0;attempt<60&&!contacts.length;attempt++)await new Promise(resolve=>setTimeout(resolve,50));
    assert.equal(contacts.length,1,'one Contact reached the local capture endpoint');
    assert.equal(newHits,1);assert.equal(oldHits,1);assert.equal(await page.evaluate(()=>window.__STALE_V6_EXECUTED__===true),false);
    const contact=contacts[0];
    assert.notEqual(contact.fbc,legacy);assert.equal(contact.landing_attribution.version,2);
    assert.equal(contact.landing_attribution.landing_id,id);assert.equal(contact.landing_attribution.pixel_id,pixel);
    assert.equal(contact.landing_attribution.fbc_source,currentClick?'url':'none');
    if(currentClick)assert.ok(contact.fbc.endsWith('.'+currentClick));else assert.equal(contact.fbc,'');
    assert.ok(journeys.length);for(const journey of journeys){assert.notEqual(journey.fbc,legacy);assert.equal(journey.landing_attribution.version,2);}
    assert.deepEqual(errors,[]);
    rows.push({browser:browserName,template,oldV6Cached:true,oldV6ReusedByNewHtml:false,asset:asset.name,contactFbcSource:contact.landing_attribution.fbc_source,contactScoped:true,journeyScoped:true,externalEvents:0});
    await context.close();
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
await writeFile(path.join(root,'docs/validation/public-runtime-cache-20261031.json'),JSON.stringify({scope:'Real HTTP cache on loopback, actual rendered T1/T6 HTML and generated runtime; isolated dependencies, no external events',results:rows},null,2)+'\n');
console.log(JSON.stringify(rows,null,2));
