import assert from 'node:assert/strict';
import * as localPlaywright from 'playwright';
import {createRequire} from 'node:module';
import path from 'node:path';
import { renderPublicLandingHtml, renderClassicTemplate7InlineHtml } from '../components/public-landing/renderPublicLandingHtml';
import { template7RuntimeAssetResponse } from '../components/public-landing/template7RuntimeAsset';
import type { PublicLandingConfig } from '../components/public-landing/types';

Object.assign(process.env,{NEXT_PUBLIC_SUPABASE_URL:'https://events.invalid',NEXT_PUBLIC_SUPABASE_ANON_KEY:'public-fixture',INTERNAL_CHAT_ORIGIN:'https://chat.invalid',REY_GATEWAY_ORIGIN:'https://rey.invalid',GANAMOS_NET_GATEWAY_ORIGIN:'https://net.invalid',MULTI_SKIN_GATEWAY_ORIGIN:'https://skins.invalid',GANAMOS_PLUS_GATEWAY_ORIGIN:'https://skins.invalid',TEMPLATE7_LANDING_ORIGINS:'https://classic.entry.invalid,https://builder.entry.invalid'});
const id=(n:number)=>`a0000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const advisor={atrioClientId:id(2),atrioId:id(3),atrioSlug:'advisor',preparationReady:true};
const fixture=(template:7|8):PublicLandingConfig=>({id:id(1),schemaVersion:1,updatedAt:'',name:'Fixture',comment:'',layout:{template,ctaPosition:'bottom'},tracking:{pixelId:'123456789',postUrl:'https://events.invalid/conversions',landingTag:'TEST',target_provider:'ganamos_net'},content:{logoUrl:'',title:['Crear cuenta'],subtitle:['Nombre'],ctaText:'CREAR USUARIO',template8:{cardCount:2,backgroundImageUrl:'',headerText:'Elegí',footerText:'',cards:[{imageUrl:'',text:'Plus',ctaText:'Elegir Plus',targetProvider:'multi_skin',multiSkinCode:'ganamos_plus'},{imageUrl:'',text:'Bet30',ctaText:'Elegir Bet30',targetProvider:'multi_skin',multiSkinCode:'bet30'}]}}});
async function main(){
let runtime=localPlaywright;
try{runtime=createRequire(import.meta.url)(path.join(process.env.APPDATA||'', 'npm/node_modules/playwright')) as typeof localPlaywright}catch{}
const {chromium,webkit}=runtime;
const checks=[];
for(const [browserName,type,ua] of [['Chromium',chromium,'Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit/537.36 Chrome/132 Mobile Safari/537.36 FBAN/FB4A'],['WebKit',webkit,'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile Instagram']] as const){
  const browser=await type.launch({headless:true});
  try{
    for(const classic of [false,true])for(const scenario of ['fresh-meta','early-click','early-abandon','asset-fails-once','asset-fails-persistently','typing-recovery','selected-skin','selected-skin-recovery','same-account-bet30','query-override','query-override-return'] as const){
      if(process.env.ENTRY_BROWSER_SCENARIO&&process.env.ENTRY_BROWSER_SCENARIO!==scenario)continue;
      console.error(`${browserName} ${classic?'classic':'builder'} ${scenario}`);
      const template=scenario.startsWith('selected-skin')?8:7;
      const autoRecovery=scenario==='selected-skin-recovery'||scenario==='same-account-bet30'||scenario==='query-override-return';
      const context=await browser.newContext({userAgent:ua,viewport:{width:390,height:844}});
      const page=await context.newPage();
      const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
      const requests:{path:string;payload:Record<string,unknown>}[]=[];
      let assetRequests=0,allowAssets=false;
      let releaseAsset!:()=>void,releaseDestination!:()=>void;
      const assetGate=new Promise<void>(resolve=>{releaseAsset=resolve});
      const destinationGate=new Promise<void>(resolve=>{releaseDestination=resolve});
      const origin=classic?'https://classic.entry.invalid':'https://builder.entry.invalid';
      const queryOverride=scenario.startsWith('query-override');
      const slug=queryOverride?'diana':'fixture';
      const pathname=(classic?'':'/l')+(queryOverride?'/gast':'/fixture');
      const selectedPath=(classic?'':'/l')+'/'+slug;
      const entryQuery='?fbclid=original-click&utm_source=facebook&new_meta_field=x&new_meta_field=y&provider=evil&advisor_id=foreign&return_to=https://evil.test'+(queryOverride?'&landing=diana':'');
      const config=fixture(template);
      if(scenario==='same-account-bet30'){
        config.tracking.target_provider='multi_skin';config.tracking.skin_code='bet30';
        await context.addInitScript(()=>{localStorage.setItem('template7:gateway-visited:https://skins.invalid',String(Date.now()))});
      }
      if(scenario==='query-override-return')await context.addInitScript(()=>{localStorage.setItem('template7:gateway-visited:https://net.invalid',String(Date.now()))});
      const html=classic?renderClassicTemplate7InlineHtml({slug,config},`function getOrCreateDeviceId(){return '${id(9)}';}`):renderPublicLandingHtml({slug,config});
      await page.route('**/*',async route=>{
        const request=route.request(),url=new URL(request.url());
        let payload:Record<string,unknown>={};try{payload=request.postDataJSON()||{}}catch{}
        requests.push({path:url.pathname,payload});
        if(url.pathname.startsWith('/public-assets/template-entry/')){
          assetRequests++;
          if((scenario==='asset-fails-once'&&assetRequests===1)||(scenario==='asset-fails-persistently'&&!allowAssets))return route.fulfill({status:503,contentType:'text/javascript',body:''});
          if(scenario==='early-click'||scenario==='early-abandon')await assetGate;
          const result=template7RuntimeAssetResponse(url.pathname.split('/').at(-1)!);
          return route.fulfill({status:result.status,contentType:'text/javascript',body:await result.text()});
        }
        if(url.origin===origin&&(url.pathname===pathname||url.pathname===selectedPath))return route.fulfill({contentType:'text/html',body:html});
        if(url.pathname==='/resume')return route.fulfill({contentType:'text/html',body:'<script>location.replace('+JSON.stringify(url.searchParams.get('return_to')!+'&new_meta_return_field=extra')+')</script>'});
        if(url.pathname==='/api/client-identity/bootstrap')return route.fulfill({json:{ok:true}});
        if(url.pathname==='/api/template7/destination'){
          if(scenario==='typing-recovery')await destinationGate;
          return route.fulfill({json:{...advisor,...(scenario==='typing-recovery'||autoRecovery?{existingName:'Original',promoCode:'ORIGINAL'}:{})}});
        }
        if(url.pathname==='/api/template7/prepare'||url.pathname==='/api/template7/start'){
          const gateway=scenario.startsWith('selected-skin')||scenario==='same-account-bet30'?'https://skins.invalid':'https://net.invalid';
          const access=classic?'/start?t=fixture-valid':'/prepare?t=p1.fixture-valid'+(gateway.includes('skins')?'&skin=bet30':'');
          return route.fulfill({json:{handoff_url:gateway+access+'&ef=e1.fixture-signed&fbclid=click&utm_source=facebook&new_meta_field=x&new_meta_field=y&return_to=https://evil.test&provider=evil'}});
        }
        if(url.pathname==='/api/template7/warm')return route.fulfill({json:{ready:true}});
        if(url.pathname==='/prepare')return route.fulfill({contentType:'text/html',body:'<main data-gateway-ready>Gateway</main>'});
        if(url.pathname==='/embed/warm')return route.fulfill({contentType:'text/html',body:'Warm fixture'});
        if(url.pathname.endsWith('.js'))return route.fulfill({contentType:'text/javascript',body:''});
        return route.fulfill({json:{ok:true}});
      });
      await page.goto(origin+pathname+entryQuery,{waitUntil:scenario==='early-click'||scenario==='early-abandon'?'commit':'domcontentloaded'});
      if(scenario==='asset-fails-once'||scenario==='asset-fails-persistently'){
        await page.locator('[data-template7-name]').fill('Nuevo');
        await page.locator('.template7__cta').click();
        if(scenario==='asset-fails-persistently'){
          await page.getByText('No pudimos preparar el acceso.',{exact:false}).waitFor();
          assert.equal(await page.locator('[data-template7-name]').inputValue(),'Nuevo');
          assert.equal(requests.filter(r=>r.path==='/api/template7/start'||r.path==='/api/template7/prepare').length,0);
          allowAssets=true;await page.locator('.template7__cta').click();
        }
      }else if(scenario==='early-abandon'){
        await page.locator('[data-template7-name]').fill('Nuevo');
        const beacon=page.waitForRequest(request=>new URL(request.url()).pathname==='/api/entry-funnel');
        const serialized=await page.evaluate(async()=>{
          const original=navigator.sendBeacon.bind(navigator);
          let captured:Promise<string>=Promise.resolve('null');
          navigator.sendBeacon=(url,data)=>{if(String(url)==='/api/entry-funnel'&&data instanceof Blob)captured=data.text();return original(url,data)};
          window.dispatchEvent(new PageTransitionEvent('pagehide'));
          return captured;
        });
        await beacon;
        const body=JSON.parse(serialized);
        assert.ok(body.events.some((event:{name:string})=>event.name==='name_started'));
        assert.equal(JSON.stringify(body).includes('Nuevo'),false,'unfinished input is not logged');
        assert.equal(requests.filter(r=>r.path==='/api/template7/start'||r.path==='/api/template7/prepare').length,0);
        releaseAsset();await page.waitForLoadState('domcontentloaded');
        checks.push({browser:browserName,engine:classic?'classic':'builder',scenario,html_bytes:Buffer.byteLength(html),account_requests:0});
        await context.close();continue;
      }else if(scenario==='early-click'){
        await page.locator('[data-template7-name]').fill('Nuevo');
        await page.locator('[data-public-landing-cta]').click();
        assert.equal(requests.filter(r=>r.path==='/api/template7/start'||r.path==='/api/template7/prepare').length,0);
        releaseAsset();
      }else if(scenario!=='same-account-bet30'&&scenario!=='query-override-return'){
        await page.waitForFunction(()=>Boolean((window as unknown as {__T7_RUNTIME_READY__:boolean}).__T7_RUNTIME_READY__));
        assert.equal(requests.filter(r=>r.path==='/resume').length,0,'fresh Meta traffic must not bounce through gateway');
        assert.equal(requests.filter(r=>r.path==='/embed/warm').length,0,'heavy chat must not compete with first paint');
        if(scenario.startsWith('selected-skin')){
          assert.equal(requests.filter(r=>r.path==='/api/template7/destination').length,0,'no per-provider fanout before choosing');
          await page.locator('[data-template8-card-index="2"]').click();
        }
        if(!autoRecovery)await page.locator('[data-template7-name]').fill('Nuevo');
        if(scenario==='typing-recovery'){
          releaseDestination();await page.waitForTimeout(100);
          assert.equal(page.url(),origin+pathname+entryQuery,'late recovery preserves active typing');
          assert.equal(await page.locator('[data-template7-name]').inputValue(),'Nuevo');
        }
        if(!autoRecovery)await page.locator('.template7__cta').click();
      }
      await page.locator('[data-gateway-ready]').waitFor({timeout:10000}).catch(async error=>{throw new Error(JSON.stringify({browser:browserName,classic,scenario,url:page.url(),errors,assetRequests,paths:requests.map(r=>r.path),status:await page.locator('[data-template7-error]').textContent().catch(()=>null)}),{cause:error})});
      const starts=requests.filter(r=>r.path==='/api/template7/start'||r.path==='/api/template7/prepare');
      assert.equal(starts.length,1,'one account request per click');
      assert.ok([...new URL(page.url()).searchParams.keys()].every(key=>['t','ef','skin'].includes(key)),'only protocol fields reach the access URL');
      const attribution=starts[0].payload.attribution as Record<string,string>;
      assert.equal(attribution.utm_source,'facebook');assert.match(attribution.fbc,/\.original-click$/);
      assert.equal(attribution.target_provider,scenario.startsWith('selected-skin')||scenario==='same-account-bet30'?'multi_skin':'ganamos_net');
      assert.equal(starts[0].payload.advisor_id,advisor.atrioId);
      if(queryOverride){
        assert.equal(starts[0].payload.landing_slug,'diana');assert.equal(attribution.landing,'diana');assert.equal(attribution.landing_resolution,'url_parameter');
        assert.equal(requests.filter(r=>r.path==='/resume').length,scenario==='query-override-return'?1:0);
      }
      if(scenario==='typing-recovery'||autoRecovery)assert.equal(starts[0].payload.name,'Original','recover authoritative existing name on submit');
      if(scenario.startsWith('selected-skin')){
        assert.equal(new URL(page.url()).searchParams.get('skin'),'bet30');
        assert.equal(new URL(page.url()).searchParams.get('ef'),'e1.fixture-signed');
        assert.equal(starts[0].payload.card_index,2);
        assert.deepEqual(requests.filter(r=>r.path==='/api/template7/destination').map(r=>r.payload.card_index),[2]);
      }
      if(scenario==='same-account-bet30'){
        assert.equal(new URL(page.url()).searchParams.get('skin'),'bet30','classic start conversion preserves the selected brand');
        assert.equal(requests.filter(r=>r.path==='/resume').length,0,'prior Plus cookie must not override the Bet30 landing');
        assert.equal(requests.filter(r=>r.path==='/api/template7/destination').length,1);
        assert.equal(starts[0].payload.landing_id,config.id,'selected landing owns server-side skin resolution');
        assert.equal(starts[0].payload.promo_code,'ORIGINAL');
      }
      assert.deepEqual(errors,[]);
      checks.push({browser:browserName,engine:classic?'classic':'builder',scenario,html_bytes:Buffer.byteLength(html),account_requests:starts.length});
      await context.close();
    }
  }finally{await browser.close()}
}
console.log(JSON.stringify({passed:checks.length,checks},null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1});
