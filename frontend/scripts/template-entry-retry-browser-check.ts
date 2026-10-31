import assert from 'node:assert/strict';
import * as localPlaywright from 'playwright';
import {createRequire} from 'node:module';
import path from 'node:path';
import {renderPublicLandingHtml,renderClassicTemplate7InlineHtml} from '../components/public-landing/renderPublicLandingHtml';
import {template7RuntimeAssetResponse} from '../components/public-landing/template7RuntimeAsset';
import type {PublicLandingConfig} from '../components/public-landing/types';

Object.assign(process.env,{NEXT_PUBLIC_SUPABASE_URL:'https://events.invalid',NEXT_PUBLIC_SUPABASE_ANON_KEY:'fixture',INTERNAL_CHAT_ORIGIN:'https://chat.invalid',GANAMOS_NET_GATEWAY_ORIGIN:'https://net.invalid',MULTI_SKIN_GATEWAY_ORIGIN:'https://skins.invalid',GANAMOS_PLUS_GATEWAY_ORIGIN:'https://skins.invalid'});
const id=(n:number)=>`a0000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const advisor={atrioClientId:id(2),atrioId:id(3),atrioSlug:'advisor',preparationReady:true};
const fixture=(template:7|8):PublicLandingConfig=>({id:id(1),schemaVersion:1,updatedAt:'',name:'Fixture',comment:'',layout:{template,ctaPosition:'bottom'},tracking:{pixelId:'123456789',postUrl:'https://events.invalid/conversions',landingTag:'TEST',target_provider:'ganamos_net'},content:{logoUrl:'',title:['Crear cuenta'],subtitle:['Nombre'],ctaText:'CREAR USUARIO',template8:{cardCount:2,backgroundImageUrl:'',headerText:'Pagina',footerText:'',cards:[{imageUrl:'',text:'Plus',ctaText:'Elegir Plus',targetProvider:'multi_skin',multiSkinCode:'ganamos_plus'},{imageUrl:'',text:'Bet30',ctaText:'Elegir Bet30',targetProvider:'multi_skin',multiSkinCode:'bet30'}]}}});
async function main(){
  let runtime=localPlaywright;
  try{runtime=createRequire(import.meta.url)(path.join(process.env.APPDATA||'','npm/node_modules/playwright')) as typeof localPlaywright}catch{}
  const checks=[];
  for(const [browserName,type] of [['Chromium',runtime.chromium],['WebKit',runtime.webkit]] as const){
    const browser=await type.launch({headless:true});
    try{for(const classic of [false,true])for(const template of [7,8] as const)for(const scenario of ['identity-failure','identity-persistent','destination-headers','destination-body','selection-race','persisted-restore'] as const){
      if(scenario.startsWith('identity')&&classic||scenario==='identity-persistent'&&template!==8||scenario==='selection-race'&&template!==8)continue;
      if(process.env.ENTRY_RETRY_SCENARIO&&process.env.ENTRY_RETRY_SCENARIO!==scenario)continue;
      console.error(`${browserName} ${classic?'classic':'builder'} T${template} ${scenario}`);
      const context=await browser.newContext({viewport:{width:390,height:844}});
      await context.addInitScript(({scenario})=>{
        localStorage.setItem('template7:identity-recovery:v1','same-identity-proof');
        const set=window.setTimeout.bind(window);
        // Exercise the actual deadlines without spending 12 s on each mocked failure.
        window.setTimeout=((handler:TimerHandler,ms?:number,...args:unknown[])=>set(handler,ms===12000||ms===5000?400:ms,...args)) as typeof window.setTimeout;
        if(scenario==='destination-body'){
          const fetchOriginal=window.fetch.bind(window);let seen=false;
          window.fetch=async(input,init)=>{const response=await fetchOriginal(input,init);if(String(input).endsWith('/api/template7/destination')&&!seen){seen=true;response.json=()=>new Promise(()=>{});}return response;};
        }
      },{scenario});
      const page=await context.newPage(),errors:string[]=[];
      page.on('pageerror',error=>errors.push(error.message));
      const requests:{path:string;body:Record<string,unknown>}[]=[];
      let bootstrap=0,destinations=0,releases:(()=>void)[]=[];
      const origin='https://entry.invalid',landingPath=classic?'/gast':'/l/gast';
      const html=classic?renderClassicTemplate7InlineHtml({slug:'diana',config:fixture(template)},`function getOrCreateDeviceId(){return '${id(9)}';}`):renderPublicLandingHtml({slug:'diana',config:fixture(template)});
      await page.route('**/*',async route=>{
        const req=route.request(),url=new URL(req.url());let body:Record<string,unknown>={};try{body=req.postDataJSON()||{}}catch{}
        requests.push({path:url.pathname,body});
        if(url.pathname.startsWith('/public-assets/template-entry/')){const result=template7RuntimeAssetResponse(url.pathname.split('/').at(-1)!);return route.fulfill({status:result.status,contentType:'text/javascript',body:await result.text()});}
        if(url.origin===origin&&url.pathname===landingPath)return route.fulfill({contentType:'text/html',body:html});
        if(url.pathname==='/api/client-identity/bootstrap'){bootstrap++;return route.fulfill({status:scenario==='identity-failure'&&bootstrap===1||scenario==='identity-persistent'&&bootstrap<=3?503:200,json:{ok:true,recovery_token:'same-identity-proof'}});}
        if(url.pathname==='/api/template7/destination'){
          destinations++;
          if((scenario==='destination-headers'||scenario==='selection-race')&&destinations===1)await new Promise<void>(resolve=>releases.push(resolve));
          return route.fulfill({json:{...advisor,...(scenario==='selection-race'&&body.card_index===1?{existingName:'OldSelection',promoCode:'OLD'}:{})}}).catch(()=>{});
        }
        if(url.pathname==='/api/template7/start'||url.pathname==='/api/template7/prepare'){
          if(scenario==='persisted-restore'&&requests.filter(r=>r.path==='/api/template7/start'||r.path==='/api/template7/prepare').length===1)await new Promise<void>(resolve=>releases.push(resolve));
          return route.fulfill({json:{handoff_url:(template===8?'https://skins.invalid':'https://net.invalid')+'/prepare?t=p1.fixture'+(template===8?'&skin=bet30':'')}}).catch(()=>{});
        }
        if(url.pathname==='/prepare')return route.fulfill({contentType:'text/html',body:'<main data-gateway-ready>Ready</main>'});
        if(url.pathname==='/api/template7/warm')return route.fulfill({json:{ready:true}});
        if(url.pathname.endsWith('.js'))return route.fulfill({contentType:'text/javascript',body:''});
        return route.fulfill({json:{ok:true}});
      });
      await page.goto(origin+landingPath+'?landing=diana&fbclid=original-click&utm_source=facebook&new_meta_field=x',{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>Boolean((window as unknown as {__T7_RUNTIME_READY__:boolean}).__T7_RUNTIME_READY__));
      if(scenario.startsWith('identity'))await page.waitForTimeout(40);
      if(template===8){
        await page.locator(`[data-template8-card-index="${scenario==='selection-race'?1:2}"]`).click();
        if(scenario==='selection-race'){
          await page.waitForFunction(()=>Object.keys((window as unknown as {__PUBLIC_LANDING_ATRIO_PROMISES:object}).__PUBLIC_LANDING_ATRIO_PROMISES).length>0);
          await page.locator('[data-template8-back]').click();
          await page.locator('[data-template8-card-index="2"]').click();
          releases.splice(0).forEach(release=>release());await page.waitForTimeout(50);
          assert.equal(page.url().startsWith(origin),true,'old selection must not navigate');
        }
      }
      await page.locator('[data-template7-name]').fill('Nuevo');
      if(scenario.startsWith('destination')){
        await page.waitForTimeout(500);
        assert.equal(await page.locator('[data-template7-name]').inputValue(),'Nuevo');
      }
      const firstAccount = scenario==='persisted-restore'?page.waitForRequest(request=>['/api/template7/start','/api/template7/prepare'].includes(new URL(request.url()).pathname)):null;
      await page.locator('.template7__cta').click();
      if(scenario==='identity-persistent'){
        await page.locator('[data-template7-error]:not([hidden])').waitFor();
        await page.waitForFunction(()=>!(document.querySelector('.template7__cta') as HTMLButtonElement).disabled);
        assert.equal(await page.evaluate(()=>Boolean((window as unknown as {__T7_ENTRY_STARTED__:boolean}).__T7_ENTRY_STARTED__)),false,'failed identity must unlock selection');
        assert.equal(startsCount(),0);
        await page.locator('[data-template8-back]').click();
        await page.locator('[data-template8-grid]:not([hidden])').waitFor();
        await page.locator('[data-template8-card-index="2"]').click();
        assert.equal(await page.locator('[data-template7-name]').inputValue(),'Nuevo');
        await page.locator('.template7__cta').click();
      }
      if(scenario==='persisted-restore'){
        await firstAccount;
        await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
        assert.equal(await page.locator('.template7__cta').isEnabled(),true,'persisted page must release its old CTA lock');
        releases.splice(0).forEach(release=>release());await page.waitForTimeout(50);
        assert.equal(page.url().startsWith(origin),true,'old account response must not navigate after restore');
        await page.locator('.template7__cta').click();
      }
      await page.locator('[data-gateway-ready]').waitFor({timeout:12000}).catch(async error=>{throw new Error(JSON.stringify({browserName,classic,template,scenario,errors,paths:requests.map(r=>r.path),status:await page.locator('[data-template7-error]').textContent(),url:page.url()}),{cause:error});});
      releases.splice(0).forEach(release=>release());
      const starts=requests.filter(r=>r.path==='/api/template7/start'||r.path==='/api/template7/prepare');
      assert.equal(starts.length,scenario==='persisted-restore'?2:1);
      assert.equal(new Set(starts.map(start=>start.body.promo_code)).size,1,'retries preserve the same promo/attempt');
      assert.ok(requests.filter(r=>r.path==='/api/track'&&(r.body.payload as Record<string,unknown>)?.event_name==='Contact').length<=1,'one Contact per entry, including restoration');
      for(const start of starts){assert.equal(start.body.landing_slug,'diana');assert.equal(start.body.advisor_id,advisor.atrioId);assert.equal(start.body.name,'Nuevo');const attribution=start.body.attribution as Record<string,string>;assert.equal(attribution.utm_source,'facebook');assert.match(attribution.fbc,/\.original-click$/);if(template===8){assert.equal(start.body.card_index,2);assert.equal(attribution.skin_code,'bet30');}if(classic)assert.equal(start.body.device_id,id(9));}
      if(scenario==='identity-failure')assert.ok(bootstrap>=2);
      if(scenario.startsWith('destination'))assert.equal(destinations,2,'retry must start one new bounded request');
      if(scenario==='selection-race')assert.deepEqual(requests.filter(r=>r.path==='/api/template7/destination').map(r=>r.body.card_index),[1,2]);
      assert.ok(requests.filter(r=>r.path==='/api/client-identity/bootstrap'&&r.body.verify!==true).every(r=>r.body.recovery_token==='same-identity-proof'));
      assert.deepEqual(errors,[]);
      checks.push({browser:browserName,engine:classic?'classic':'builder',template,scenario,account_requests:starts.length});
      await context.close();
      function startsCount(){return requests.filter(r=>r.path==='/api/template7/start'||r.path==='/api/template7/prepare').length;}
    }}finally{await browser.close();}
  }
  console.log(JSON.stringify({passed:checks.length,checks},null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
