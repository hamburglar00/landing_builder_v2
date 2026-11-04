import assert from 'node:assert/strict';
import * as localPlaywright from 'playwright';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {renderPublicLandingHtml,renderClassicTemplate7Html} from '../components/public-landing/renderPublicLandingHtml';
import {template7RuntimeAssetResponse} from '../components/public-landing/template7RuntimeAsset';
import {DEFAULT_CONFIG} from '../lib/landing/mocks';
import {switchLandingTemplate} from '../lib/landing/templateVariants';
import {buildLandingConfig} from '../lib/landing/buildLandingConfig';
import type {TargetProvider} from '../lib/landing/types';

Object.assign(process.env,{NEXT_PUBLIC_SUPABASE_URL:'https://events.invalid',NEXT_PUBLIC_SUPABASE_ANON_KEY:'public-fixture',INTERNAL_CHAT_ORIGIN:'https://chat.invalid',REY_GATEWAY_ORIGIN:'https://rey.invalid',ASES_DEL_NORTE_GATEWAY_ORIGIN:'https://ases.invalid',GANAMOS_NET_GATEWAY_ORIGIN:'https://net.invalid',MULTI_SKIN_GATEWAY_ORIGIN:'https://skins.invalid',GANAMOS_PLUS_GATEWAY_ORIGIN:'https://skins.invalid',TEMPLATE7_LANDING_ORIGINS:'https://classic.entry.invalid,https://builder.entry.invalid'});
const id=(n:number)=>`a0000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const advisor={atrioClientId:id(2),atrioId:id(3),atrioSlug:'advisor',preparationReady:true};
const origins={rey_de_ases:'https://rey.invalid',ases_del_norte:'https://ases.invalid',ganamos_net:'https://net.invalid',multi_skin:'https://skins.invalid'};
const directory=process.env.TEMPLATE9_ARTIFACT_DIR || path.resolve('..','docs/validation/template9-20261103');

async function main(){
  await mkdir(directory,{recursive:true});
  let runtime=localPlaywright;
  try{runtime=createRequire(import.meta.url)(path.join(process.env.APPDATA||'','npm/node_modules/playwright')) as typeof localPlaywright}catch{}
  const checks=[];
  for(const [browserName,engine,ua] of [['Chromium',runtime.chromium,'Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit/537.36 Chrome/132 Mobile Safari/537.36 FBAN/FB4A'],['WebKit',runtime.webkit,'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile Instagram']] as const){
    const browser=await engine.launch({headless:true});
    try{
      for(const classic of [false,true])for(const provider of Object.keys(origins) as TargetProvider[]){
        for(const scenario of ['fresh-meta',...(provider==='ganamos_net'?['organic','early-click','retry','reentry','small-screen','desktop','keyboard']:[]),...(provider==='multi_skin'?['bet30']:[])]){
          console.log(`${browserName} ${classic?'classic':'builder'} ${provider} ${scenario}`);
          const context=await browser.newContext({userAgent:ua,viewport:scenario==='desktop'?{width:1440,height:900}:scenario==='small-screen'?{width:320,height:568}:{width:390,height:844}});
          const page=await context.newPage(),errors:string[]=[],requests:{path:string;payload:Record<string,any>}[]=[];
          const ctaMetaEvent = scenario === 'fresh-meta' || scenario === 'retry' ? 'CompleteRegistration' as const : 'Lead' as const;
          await context.addInitScript(() => {
            (window as any).__ctaPixelEvents=[];
            (window as any).fbq=(...args:any[])=>{
              if(args[0]==='track'&&['Lead','CompleteRegistration','Contact'].includes(args[1]))(window as any).__ctaPixelEvents.push(args);
            };
          });
          const beacons:Record<string,any>[]=[];
          let contactSeen!:()=>void;const contactReady=new Promise<void>(resolve=>{contactSeen=resolve});
          await context.exposeBinding('__auditContactBeacon',(_source,body:string)=>{beacons.push(JSON.parse(body).payload);contactSeen()});
          // WebKit's intercepted beacon requests can omit postData. Observe the
          // native call's body without replacing transport or delaying entry.
          await context.addInitScript(()=>{
            const native=navigator.sendBeacon.bind(navigator);
            navigator.sendBeacon=(url,data)=>{
              if(String(url)==='/api/track'&&data instanceof Blob)data.text().then(body=>(window as any).__auditContactBeacon(body));
              return native(url,data);
            };
          });
          page.on('pageerror',error=>errors.push(error.message));
          let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve});let attempts=0;
          const origin=classic?'https://classic.entry.invalid':'https://builder.entry.invalid';
          const url=origin+(classic?'/fixture':'/l/fixture')+(scenario==='organic'?'':'?fbclid=CurrentFixtureClick&utm_source=facebook');
          const theme={...switchLandingTemplate(DEFAULT_CONFIG,'template9'),ctaMetaEvent,targetProvider:provider,multiSkinCode:scenario==='bet30'?'bet30' as const:'ganamos_plus' as const};
          const payload=buildLandingConfig({id:id(1),name:'fixture',comment:'',pixelId:'123456789',postUrl:'https://events.invalid/conversions',landingTag:'TEST',config:theme});
          const config={...payload,layout:{...payload.layout,ctaPosition:'bottom'}};
          const html=classic?renderClassicTemplate7Html({slug:'fixture',config},`function getOrCreateDeviceId(){return '${id(9)}';}`):renderPublicLandingHtml({slug:'fixture',config});
          // An unrelated global FBC must not become this landing's attribution.
          await context.addCookies([{name:'_fbc',value:`fb.1.${Date.now()-10000}.UnrelatedFixtureClick`,domain:new URL(origin).hostname,path:'/'}]);
          if(scenario==='reentry')await context.addInitScript(()=>localStorage.setItem('template7:gateway-visited:https://net.invalid',String(Date.now())));
          await page.route('**/*',async route=>{
            const request=route.request(),u=new URL(request.url());let body={};try{body=request.postDataJSON()||{}}catch{}
            requests.push({path:u.pathname,payload:body});
            if((body as any).payload?.event_name==='Contact')contactSeen();
            if(u.pathname.startsWith('/public-assets/template-entry/')){
              if(scenario==='early-click')await gate;
              const result=template7RuntimeAssetResponse(u.pathname.split('/').at(-1)!);
              return route.fulfill({status:result.status,contentType:'text/javascript',body:await result.text()});
            }
            if(/^\/public-assets\/template9\/[a-z_0-9]+\.webp$/.test(u.pathname))return route.fulfill({contentType:'image/webp',body:await readFile(path.resolve('public','.'+u.pathname))});
            if(u.origin===origin&&u.pathname===(classic?'/fixture':'/l/fixture'))return route.fulfill({contentType:'text/html',body:html});
            if(u.pathname==='/resume')return route.fulfill({contentType:'text/html',body:'<script>location.replace('+JSON.stringify(u.searchParams.get('return_to'))+')</script>'});
            if(u.pathname==='/api/client-identity/bootstrap')return route.fulfill({json:{ok:true}});
            if(u.pathname==='/api/template7/destination')return route.fulfill({json:advisor});
            if(u.pathname==='/api/template7/prepare'||u.pathname==='/api/template7/start'){
              const events=await page.evaluate(()=>(window as any).__ctaPixelEvents);
              assert.equal(events.length,1,'one selected event precedes creation, including a failed attempt');
              assert.equal(events[0][1],ctaMetaEvent);
              if(ctaMetaEvent==='CompleteRegistration')assert.equal(events[0][2].status,'registered');
              attempts++;if(scenario==='retry'&&attempts===1)return route.fulfill({status:503,json:{error:'integration_pending',retryable:false}});
              return route.fulfill({json:{handoff_url:origins[provider]+(classic?'/start?t=fixture-valid':'/prepare?t=p1.fixture-valid')+'&ef=e1.signed-fixture'+(scenario==='bet30'?'&skin=bet30':'')}});
            }
            if(u.origin===origins[provider]&&['/prepare','/start'].includes(u.pathname))return route.fulfill({contentType:'text/html',body:'<main data-gateway-ready>Gateway</main>'});
            if(u.pathname.endsWith('.js'))return route.fulfill({contentType:'text/javascript',body:''});
            if(u.pathname==='/api/entry-funnel')return route.fulfill({status:204});
            return route.fulfill({json:{ok:true}});
          });
          await page.goto(url,{waitUntil:scenario==='early-click'?'commit':'domcontentloaded'});
          if(scenario!=='early-click')await page.waitForFunction(()=>Boolean((window as any).__T7_RUNTIME_READY__));
          if(scenario==='reentry')assert.equal(requests.filter(r=>r.path==='/resume').length,1);
          else assert.equal(requests.filter(r=>r.path==='/resume').length,0);
          if(['fresh-meta','small-screen','desktop','keyboard'].includes(scenario)){
            await page.locator('.template9__logo').evaluate((img:HTMLImageElement)=>img.decode());
            await page.locator('.template9__card').evaluate(el=>el.getAnimations().forEach(animation=>animation.finish()));
            const box=await page.locator('[data-template7-name]').boundingBox();assert.ok(box&&box.width>200);
            assert.equal(await page.locator('.template9__wrap').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
            if(scenario==='fresh-meta'&&!classic&&browserName==='Chromium')await page.screenshot({path:path.join(directory,`${provider}-390.png`)});
            if(scenario==='desktop'&&!classic&&browserName==='Chromium')await page.screenshot({path:path.join(directory,'ganamos_net-1440.png')});
            await page.locator('[data-template9-cookie-dismiss]').click();
            assert.equal(await page.locator('[data-template9-cookie-notice]').isVisible(),false);
            for(const legal of ['privacidad','terminos','cookies','juego-responsable']){
              assert.equal(await page.locator('nav a[href$="/'+legal+'"]').getAttribute('href'),(classic?'/fixture':'/l/fixture')+'/'+legal);
            }
            if(scenario==='keyboard')await page.setViewportSize({width:390,height:360});
          }
          await page.locator('[data-template7-name]').fill('Martín');
          if(scenario==='early-click'){
            await page.locator('[data-public-landing-cta]').click();assert.equal(attempts,0);release();
          }else{
            await page.locator('[data-public-landing-cta]').click();
            if(scenario==='retry'){
              await page.locator('[data-template7-error]:visible').waitFor();
              assert.equal(await page.locator('[data-template7-name]').inputValue(),'Martín');
              await page.locator('[data-public-landing-cta]').click();
            }
          }
          await page.locator('[data-gateway-ready]').waitFor({timeout:15000}).catch(error=>{throw new Error(JSON.stringify({browserName,classic,provider,scenario,errors,url:page.url(),requests}),{cause:error})});
          const starts=requests.filter(r=>['/api/template7/start','/api/template7/prepare'].includes(r.path));
          assert.equal(starts.length,scenario==='retry'?2:1);
          const sent=starts.at(-1)!.payload;
          assert.equal(sent.name,'Martín');assert.equal(sent.advisor_id,advisor.atrioId);
          assert.equal(sent.entry_funnel.template,9);
          assert.equal(sent.attribution.target_provider,provider);
          let contactTimer:ReturnType<typeof setTimeout>|undefined;
          try{await Promise.race([contactReady,new Promise((_resolve,reject)=>{contactTimer=setTimeout(()=>reject(Error('Missing Contact')),5000)})])}finally{clearTimeout(contactTimer)}
          const contacts=beacons.length?beacons:requests.map(r=>r.payload.payload||r.payload).filter(p=>p.event_name==='Contact');
          assert.equal(contacts.length,1,'Contact stays deduplicated across entry retries');
          assert.equal(contacts[0].form_fn,'Martín');
          assert.equal(contacts[0].landing_id,id(1));
          assert.equal(contacts[0].meta_pixel_id,'123456789');
          assert.equal(contacts[0].target_provider,provider);
          if(scenario==='organic')assert.ok(!contacts[0].fbc);
          else assert.match(contacts[0].fbc,/\.CurrentFixtureClick$/);
          if(scenario==='organic')assert.ok(!sent.attribution.fbc,'global cookie without this scope must stay quarantined');
          else assert.match(sent.attribution.fbc,/\.CurrentFixtureClick$/);
          if(scenario==='bet30')assert.equal(new URL(page.url()).searchParams.get('skin'),'bet30');
          assert.deepEqual(errors,[]);
          checks.push({browser:browserName,engine:classic?'classic':'builder',provider,scenario,html_bytes:Buffer.byteLength(html),account_requests:starts.length});
          await context.close();
        }
      }
    }finally{await browser.close()}
  }
  await writeFile(path.join(directory,'browser-results.json'),JSON.stringify({passed:checks.length,checks},null,2));
  console.log(JSON.stringify({passed:checks.length,artifacts:directory}));
}
main().catch(error=>{console.error(error);process.exitCode=1});
