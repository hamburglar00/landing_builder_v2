// Real generated HTML/assets; every request is fulfilled locally. No production writes.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import * as localPlaywright from 'playwright';
import {renderPublicLandingHtml,renderClassicPublicLandingHtml} from '../components/public-landing/renderPublicLandingHtml';
import type {PublicLandingConfig} from '../components/public-landing/types';

Object.assign(process.env,{NEXT_PUBLIC_SUPABASE_URL:'https://events.invalid',NEXT_PUBLIC_SUPABASE_ANON_KEY:'public-fixture',INTERNAL_CHAT_ORIGIN:'https://chat.invalid',REY_GATEWAY_ORIGIN:'https://rey.invalid',GANAMOS_NET_GATEWAY_ORIGIN:'https://net.invalid',MULTI_SKIN_GATEWAY_ORIGIN:'https://skins.invalid',GANAMOS_PLUS_GATEWAY_ORIGIN:'https://skins.invalid',ENTRY_FUNNEL_RELEASE:'a'.repeat(40),VERCEL_ENV:'preview'});
delete process.env.VERCEL_GIT_COMMIT_SHA;
const id=(n:number)=>'a0000000-0000-4000-8000-'+String(n).padStart(12,'0');
const advisor={atrioClientId:id(2),atrioId:id(3),atrioSlug:'advisor',preparationReady:true};
const publicDirectory=path.resolve('public');
const fixture=(template:number):PublicLandingConfig=>({id:id(1),schemaVersion:1,updatedAt:'',name:'Fixture',comment:'',layout:{template,ctaPosition:'bottom'},tracking:{pixelId:'123456789',postUrl:'https://events.invalid/conversions',landingTag:'TEST',target_provider:'ganamos_net',sendContactPixel:true,ctaMetaEvent:'Lead'},content:{logoUrl:'',title:['Crear cuenta'],subtitle:['Comenzar'],ctaText:'CONTINUAR',template6:{grid:'2x1',headerText:'Elegí',footerText:'',cards:[{imageUrl:'',text:'Uno',ctaText:'Elegir uno'},{imageUrl:'',text:'Dos',ctaText:'Elegir dos'}]},template8:{cardCount:2,backgroundImageUrl:'',headerText:'Elegí',footerText:'',cards:[{imageUrl:'',text:'Uno',ctaText:'Elegir uno',targetProvider:'ganamos_net'},{imageUrl:'',text:'Dos',ctaText:'Elegir dos',targetProvider:'ganamos_net'}]}}});
type Payload=Record<string,any>;
async function until(check:()=>boolean,label:string){for(let i=0;i<250&&!check();i++)await new Promise(resolve=>setTimeout(resolve,20));assert.ok(check(),label);}

async function main(){
  let runtime=localPlaywright;
  try{runtime=createRequire(import.meta.url)(path.join(process.env.APPDATA||'','npm/node_modules/playwright')) as typeof localPlaywright}catch{}
  const results=[];
  for(const [browserName,type,userAgent] of [['Chromium',runtime.chromium,'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/132 Mobile Safari/537.36'],['WebKit',runtime.webkit,'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile Safari/604.1']] as const){
    if(process.env.ENTRY_MATRIX_BROWSER&&process.env.ENTRY_MATRIX_BROWSER!==browserName)continue;
    const browser=await type.launch({headless:true});
    try{for(const engine of ['classic','constructor'] as const)for(let template=1;template<=9;template++){
      if(process.env.ENTRY_MATRIX_TEMPLATE&&Number(process.env.ENTRY_MATRIX_TEMPLATE)!==template)continue;
      if(process.env.ENTRY_MATRIX_MAX_TEMPLATE&&template>Number(process.env.ENTRY_MATRIX_MAX_TEMPLATE))continue;
      if(process.env.ENTRY_MATRIX_ENGINE&&engine!==process.env.ENTRY_MATRIX_ENGINE)continue;
      const selection=process.env.ENTRY_MATRIX_SELECTION||'path';
      const identityScenario=process.env.ENTRY_MATRIX_IDENTITY||'new';
      const blockedMeta=process.env.ENTRY_MATRIX_META_BLOCKED==='1';
      const missingPhone=process.env.ENTRY_MATRIX_NO_PHONE==='1';
      const label=browserName+'/'+engine+'/T'+template+'/'+selection;
      console.error(label);
      const context=await browser.newContext({viewport:{width:390,height:844},userAgent});
      try{
        const page=await context.newPage(),errors:string[]=[],pixels:any[][]=[],beacons:{url:string;body:Payload}[]=[],requests:{path:string;payload:Payload}[]=[];
        page.on('pageerror',error=>errors.push(error.message));
        await context.exposeBinding('__deliveryPixel',(_source,args:any[])=>{pixels.push(args)});
        await context.exposeBinding('__deliveryBeacon',(_source,url:string,body:string)=>{beacons.push({url,body:JSON.parse(body)})});
        await context.addInitScript(({blockedMeta})=>{
          if(!blockedMeta)(window as any).fbq=(...args:any[])=>(window as any).__deliveryPixel(args);
          const native=navigator.sendBeacon.bind(navigator);
          navigator.sendBeacon=(url,data)=>{
            if(['/api/track','/api/entry-funnel'].includes(String(url))&&data instanceof Blob)data.text().then(body=>(window as any).__deliveryBeacon(String(url),body));
            return native(url,data);
          };
        },{blockedMeta});
        if(identityScenario==='stored')await context.addInitScript(()=>localStorage.setItem('landing-builder:123456789:fixture:external_id','StoredFixtureIdentifier'));
        const config=fixture(template),origin=engine==='classic'?'https://landing.panelbotadmin.com':'https://mkt.panelbotadmin.com';
        const pathname=engine==='classic'?'/fixture':'/l/fixture';
        const url=origin+pathname+'?fbclid=CurrentFixtureClick&utm_source=facebook&utm_campaign=CommonMatrix'+(selection==='override'?'&landing=fixture':selection==='automatic'?'&__landing_auto=fixture':'')+(identityScenario!=='new'?'&external_id=UrlFixtureIdentifier':'');
        const html=engine==='classic'?renderClassicPublicLandingHtml({slug:'fixture',config},"function getOrCreateDeviceId(){return '"+id(9)+"';}"):renderPublicLandingHtml({slug:'fixture',config});
        await page.route('**/*',async route=>{
          const request=route.request(),u=new URL(request.url());let payload:Payload={};try{payload=request.postDataJSON()||{}}catch{}
          requests.push({path:u.pathname,payload});
          if(blockedMeta&&['connect.facebook.net','www.facebook.com'].includes(u.hostname))return route.abort('blockedbyclient');
          if(u.origin===origin&&u.pathname===pathname)return route.fulfill({contentType:'text/html',body:html});
          if(/^\/public-assets\/(template-entry|template9)\/[a-zA-Z0-9_.-]+$/.test(u.pathname)||/^\/vendor\/[a-zA-Z0-9_./-]+\.js$/.test(u.pathname)){
            const filename=path.resolve(publicDirectory,'.'+u.pathname);
            assert.ok(filename.startsWith(publicDirectory+path.sep));
            return route.fulfill({contentType:u.pathname.endsWith('.css')?'text/css':u.pathname.endsWith('.js')?'text/javascript':'image/webp',body:await readFile(filename)});
          }
          if(u.pathname==='/functions/v1/landing-phone')return route.fulfill({json:missingPhone?{phone:''}:{phone:'5491100000001',phoneId:71,phoneKind:'advertising',phoneMode:'fixed',landingId:id(1),landingName:'Fixture',gerencia:{id:8,externalId:80,weight:1}}});
          if(u.pathname==='/api/client-identity/bootstrap')return route.fulfill({json:{ok:true}});
          if(u.pathname==='/resume')return route.fulfill({contentType:'text/html',body:'<script>location.replace('+JSON.stringify(u.searchParams.get('return_to'))+')</script>'});
          if(u.pathname==='/api/template7/destination')return route.fulfill({json:advisor});
          if(['/api/template7/prepare','/api/template7/start'].includes(u.pathname))return route.fulfill({json:{handoff_url:'https://net.invalid/prepare?t=p1.fixture-valid&ef=e1.signed'}});
          if(u.hostname==='wa.me'||u.origin==='https://net.invalid'&&u.pathname==='/prepare')return route.fulfill({contentType:'text/html',body:'<main data-fixture-destination>Local destination fixture</main>'});
          if(u.pathname.endsWith('.js'))return route.fulfill({contentType:'text/javascript',body:''});
          if(u.pathname==='/api/entry-funnel')return route.fulfill({status:204});
          return route.fulfill({json:{ok:true,ready:true}});
        });
        const ctaEvent=template<=6?'Contact':'Lead';
        const contacts=()=>{
          const all=[...beacons.filter(b=>b.url==='/api/track').map(b=>b.body.payload),...requests.filter(r=>r.path==='/api/track').map(r=>r.payload.payload)].filter(p=>p?.event_name==='Contact');
          return [...new Map(all.map(p=>[p.event_id,p])).values()];
        };
        const telemetry=()=>[...new Map([...beacons.filter(b=>b.url==='/api/entry-funnel').map(b=>b.body),...requests.filter(r=>r.path==='/api/entry-funnel').map(r=>r.payload)].flatMap(p=>p.events||[]).map(e=>[e.id,e])).values()] as Payload[];
        async function visit(){
          await page.goto(url,{waitUntil:'domcontentloaded'});
          if(blockedMeta){
            const queue=await page.evaluate(()=>((window as any).fbq?.queue||[]).map((args:IArguments)=>Array.from(args)));
            assert.equal(queue.filter((args:any[])=>args[0]==='track'&&args[1]==='PageView').length,1,label+': PageView remains queued while the external SDK is blocked');
          }
          if(template>=7){
            await page.waitForFunction(()=>Boolean((window as any).__T7_RUNTIME_READY__));
            const diagnostic=await page.evaluate(()=>({ready:!!(window as any).__entryFunnel,early:(window as any).__ENTRY_FUNNEL_EARLY__?.context,metadata:(window as any).__ENTRY_FUNNEL_METADATA__,pending:Object.entries(sessionStorage).filter(([key])=>key.endsWith(':pending')).map(([,value])=>JSON.parse(value).events.map((event:any)=>event.name))}));
            assert.equal(diagnostic.ready,true,JSON.stringify({label,diagnostic}));
            if(process.env.ENTRY_MATRIX_DEBUG)console.error(JSON.stringify(diagnostic));
            if(template===8)await page.locator('[data-template8-card-index="1"]').click();
            await page.locator('[data-template7-name]').fill('PrivateFixtureName');
          }
          if(template===4||template===5){
            const appearance=await page.locator('[class="template'+template+'__'+(template===4?'intro':'curtain')+'"]').evaluate(el=>getComputedStyle(el).display);
            assert.equal(appearance,'none',label+': no decorative wait covers the CTA');
            assert.match(await page.locator('[data-template'+template+'-current-time]').innerText(),/\d{1,2}:\d{2}/);
          }
          if(template!==3){
            const cta=page.locator('[data-public-landing-cta]').first();
            assert.equal(await cta.isEnabled(),true,label+': actionable immediately after data/form readiness');
            // T5 pulses forever: hit-test the visible center without waiting for animation stability.
            const hit=await cta.evaluate(el=>{el.scrollIntoView({block:'nearest'});const box=el.getBoundingClientRect(),x=box.x+box.width/2,y=box.y+box.height/2;return{x,y,reachable:el.contains(document.elementFromPoint(x,y))}});
            assert.equal(hit.reachable,true,label+': CTA receives input without a covering overlay');
            await page.mouse.click(hit.x,hit.y);
          }
          if(missingPhone)await until(()=>telemetry().some(event=>event.name==='entry_error'),label+': missing destination diagnosis');
          else await page.locator('[data-fixture-destination]').waitFor({timeout:15000});
        }
        await visit();
        if(missingPhone){
          const events=telemetry(),error=events.find(event=>event.name==='entry_error')!;
          assert.equal(error.error_code,'destination_unavailable');assert.equal(error.error_stage,'destination');
          assert.equal(error.attempt_id,events.find(event=>event.name==='cta_clicked')?.attempt_id);
          assert.equal(error.engine,engine);assert.equal(error.release,'a'.repeat(40));
          assert.equal(new URL(page.url()).origin,origin);assert.equal(contacts().length,0);
          assert.equal(pixels.filter(args=>args[0]==='track'&&args[1]===ctaEvent).length,0);
          assert.equal(requests.filter(request=>request.path==='/5491100000001').length,0);
          assert.deepEqual(errors,[]);results.push({browser:browserName,engine,template,missing_phone:true});continue;
        }
        await until(()=>contacts().length===1&&telemetry().some(e=>e.name==='cta_clicked'),label+': diagnostics and Contact').catch(error=>{throw new Error(JSON.stringify({label,contacts:contacts().length,events:telemetry().map(e=>e.name),pixelEvents:pixels.map(p=>p[1]),paths:requests.map(r=>r.path),errors}),{cause:error})});
        const contact=contacts()[0];
        assert.match(contact.fbc,/\.CurrentFixtureClick$/,label);
        assert.equal(contact.utm_campaign,'CommonMatrix',label);
        assert.equal(contact.landing_resolution,selection==='override'?'url_parameter':selection==='automatic'&&engine==='classic'?'automatic':'path',label+': routing attribution');
        assert.equal(contact.meta_pixel_id,'123456789');
        if(blockedMeta){
          const fbp=(await context.cookies(origin)).find(cookie=>cookie.name==='_fbp')?.value;
          assert.match(fbp||'',/^fb\.1\.\d+\.\d+$/);assert.equal(contact.fbp,fbp,label+': blocked Meta keeps first-party FBP for CAPI');
          assert.ok(requests.some(request=>request.path.endsWith('/fbevents.js')),label+': actual Meta script was requested and blocked');
        }
        if(identityScenario==='stored')assert.equal(contact.external_id,'StoredFixtureIdentifier',label+': stored identity wins over URL');
        else if(identityScenario==='url'&&engine==='classic'&&template<=6)assert.equal(contact.external_id,'UrlFixtureIdentifier',label+': classic URL identity compatibility');
        if(!blockedMeta)assert.equal(pixels.filter(args=>args[0]==='track'&&args[1]==='PageView').length,1,label);
        const ctaPixels=pixels.filter(args=>args[0]==='track'&&args[1]===ctaEvent);
        if(!blockedMeta){assert.equal(ctaPixels.length,1,label+': one Pixel event');assert.equal(ctaPixels[0][3].eventID,contact.event_id,label+': Pixel and CAPI share dedup ID');}
        const observed=telemetry();
        assert.ok(observed.some(e=>e.name==='page_visible'),label);
        assert.ok(observed.every(e=>e.engine===engine&&e.release==='a'.repeat(40)&&e.environment==='preview'),label+': release cohort');
        assert.doesNotMatch(JSON.stringify(observed),/PrivateFixtureName|CurrentFixtureClick|5491100000001|FixtureIdentifier|password|https:\/\//,label+': no personal/advertising identifiers in telemetry');
        if(template<=6){
          assert.equal(new URL(page.url()).hostname,'wa.me');
          assert.equal(new URL(page.url()).pathname,'/5491100000001',label+': assigned advertising destination');
          assert.ok(observed.some(e=>e.name==='outbound_requested'),label);
        }else{
          const starts=requests.filter(r=>['/api/template7/start','/api/template7/prepare'].includes(r.path));
          assert.equal(starts.length,1,label);
          assert.equal(starts[0].payload.entry_funnel.template,template,label);
          assert.equal(starts[0].payload.entry_funnel.engine,engine,label);
          assert.equal(starts[0].payload.attribution.utm_source,'facebook',label);
          assert.match(starts[0].payload.attribution.fbc,/\.CurrentFixtureClick$/,label);
        }
        await visit();
        await new Promise(resolve=>setTimeout(resolve,100));
        assert.equal(contacts().length,1,label+': repeated visit retains Contact dedup');
        if(!blockedMeta)assert.equal(pixels.filter(args=>args[0]==='track'&&args[1]===ctaEvent).length,1,label+': repeated visit retains Pixel dedup');
        assert.deepEqual(errors,[],label);
        results.push({browser:browserName,engine,template,html_bytes:Buffer.byteLength(html),contact_events:contacts().length});
      }finally{await context.close()}
    }}finally{await browser.close()}
  }
  console.log(JSON.stringify({passed:results.length,checks:results},null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1});
