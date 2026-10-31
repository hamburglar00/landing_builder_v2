// Real landing/runtime/gateway code, local brand assets and synthetic requests only.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const workspace=fileURLToPath(new URL('../../',import.meta.url));
const frontend=path.join(workspace,'landing-builder/frontend'),gateway=path.join(workspace,'multi-skin-gateway');
const require=createRequire(path.join(frontend,'package.json')),{build}=require('esbuild');
const {chromium,webkit}=require(path.join(process.env.APPDATA,'npm/node_modules/playwright'));
const output=fileURLToPath(new URL('../.vercel/all-skin-entry-presentation-20261031/',import.meta.url));
await mkdir(output,{recursive:true});
async function bundle(cwd,contents){
 const result=await build({absWorkingDir:cwd,stdin:{contents,loader:'ts',resolveDir:cwd},bundle:true,write:false,platform:'node',format:'cjs',external:['react','react/jsx-runtime','react-dom/server','next/*']});
 const module={exports:{}};new Function('require','module','exports',result.outputFiles[0].text)(createRequire(path.join(cwd,'package.json')),module,module.exports);return module.exports;
}
process.env.MULTI_SKIN_GATEWAY_ORIGIN='https://multi.test';process.env.GANAMOS_PLUS_GATEWAY_ORIGIN='https://plus.test';
const api=await bundle(gateway,`export {MULTI_SKIN_CODES,MULTI_SKIN_CATALOG} from './src/lib/multi-skin-catalog';export {getMultiSkinBrand} from './src/lib/skin-branding';export {skinPreparationTheme} from './src/lib/skin-presentation';export {getSkinConfig} from './src/lib/skin-registry';export {renderPreparationPage} from './src/lib/preparation-page';export {GATEWAY_ENTRY_TRANSITION_RUNTIME} from './src/lib/gateway-entry-transition';`);
const builder=await bundle(frontend,`export {renderPublicLandingHtml} from './components/public-landing/renderPublicLandingHtml';export {template7RuntimeAsset} from './components/public-landing/template7RuntimeAsset';export {buildLandingConfig} from './lib/landing/buildLandingConfig';export {DEFAULT_CONFIG} from './lib/landing/mocks';`);
const classic=createRequire(path.join(workspace,'landing-prueba-1/package.json'))('./lib/template7/shared.cjs');
const origin=code=>code==='ganamos_plus'?'https://plus.test':'https://multi.test';
const rgb=hex=>'rgb('+[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)).join(', ')+')';
const rows=[],errors=[];
for(const[engine,launcher]of[['Chromium',chromium],['WebKit',webkit]]){
 const browser=await launcher.launch({headless:true});
 try{
  for(const code of api.MULTI_SKIN_CODES){
   const brand=api.getMultiSkinBrand(code),skin=api.getSkinConfig(code);
   assert.equal(skin.widgetTheme.code,code);assert.equal(skin.themeColor,brand.background);assert.equal(skin.widgetTheme.colors.primary,brand.primary);assert.equal(skin.upstreamOrigin,api.MULTI_SKIN_CATALOG[code].origin);
   for(const landingEngine of ['builder','classic'])for(const template of[7,8]){
    const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});const page=await context.newPage();
    let html;const requests=[];const pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message));
    const other=code==='ganamos_plus'?'bet30':'ganamos_plus';
    const theme={...builder.DEFAULT_CONFIG,template:'template'+template,ctaDestination:'atrio',targetProvider:'multi_skin',multiSkinCode:template===7?code:other,
      titleLine1:brand.name,titleLine2:'',logoUrl:origin(code)+brand.logo.replace(/\.avif$/,'.webp'),template8Cover:{cardCount:2,headerText:'Elegí tu página',footerText:'',backgroundImageUrl:'',cards:[code,other].map(value=>({imageUrl:origin(value)+api.getMultiSkinBrand(value).logo.replace(/\.avif$/,'.webp'),text:api.MULTI_SKIN_CATALOG[value].name,ctaText:'',targetProvider:'multi_skin',multiSkinCode:value}))}};
    const config=builder.buildLandingConfig({id:'11111111-1111-4111-8111-111111111111',name:'audit-'+code,comment:'',pixelId:'',postUrl:'',landingTag:'TEST',config:theme});
    html=landingEngine==='builder'?builder.renderPublicLandingHtml({slug:config.name,config}):classic.renderClassicTemplate7InlineHtml({slug:config.name,config},'function getOrCreateDeviceId(){return "44444444-4444-4444-8444-444444444444";}');
    await context.route('**/*',async route=>{
     const request=route.request(),url=new URL(request.url());requests.push({origin:url.origin,path:url.pathname,method:request.method()});
     assert.ok(['https://landing.test','https://multi.test','https://plus.test'].includes(url.origin),'Unexpected external origin: '+url.origin);
     if(url.pathname.startsWith('/public-assets/template-entry/'))return route.fulfill({contentType:'text/javascript',body:builder.template7RuntimeAsset(template,landingEngine==='classic').source});
     if(/\.(avif|webp|png)$/.test(url.pathname))return route.fulfill({body:await readFile(path.join(gateway,'public',url.pathname)),contentType:url.pathname.endsWith('.avif')?'image/avif':url.pathname.endsWith('.webp')?'image/webp':'image/png'});
     if(url.pathname==='/api/template7/destination')return route.fulfill({json:{atrioClientId:'22222222-2222-4222-8222-222222222222',atrioId:'33333333-3333-4333-8333-333333333333',atrioSlug:'fixture',preparationReady:false}});
     if(url.pathname==='/api/client-identity/bootstrap')return route.fulfill({headers:{'Set-Cookie':'lb_cid=44444444-4444-4444-8444-444444444444; Path=/; HttpOnly; SameSite=Lax'},json:{ok:true}});
     if(/complete|finalize|\/start|\/prepare/.test(url.pathname))throw Error('No account or login request is permitted in the landing visual fixture');
     if(url.pathname.startsWith('/api/'))return route.fulfill({json:{ok:true,active:false}});
     if(url.pathname.endsWith('.js'))return route.fulfill({contentType:'text/javascript',body:'/* vendor fixture */'});
     if(request.isNavigationRequest())return route.fulfill({contentType:'text/html;charset=utf-8',body:html});
     return route.fulfill({status:204,body:''});
    });
    try{
     await page.goto('https://landing.test/'+config.name);await page.waitForFunction(()=>window.__T7_RUNTIME_READY__===true);
     if(template===8){
      await page.locator('[data-template8-card-index="2"]').click();await page.locator('[data-template8-back]').click();
      await page.locator('[data-template8-card-index="1"]').click();
      assert.equal(await page.evaluate(()=>window.__T7_SELECTED_GATEWAY__),origin(code));
      assert.equal(await page.locator('[data-template8-selected-page]').innerText(),brand.name);
     }
     const logo=page.locator('.template7__logo');await logo.waitFor();await page.waitForFunction(()=>{const image=document.querySelector('.template7__logo');return image?.complete&&image.naturalWidth>0});
     assert.equal(new URL(await logo.getAttribute('src')).pathname,brand.logo.replace(/\.avif$/,'.webp'));
     const overlay=page.locator('#gateway-entry-transition');assert.equal(await overlay.getAttribute('data-palette'),brand.background);
     await page.addScriptTag({content:api.GATEWAY_ENTRY_TRANSITION_RUNTIME+';window.__auditTransition=createGatewayEntryTransition(document.getElementById("gateway-entry-transition"));window.__auditTransition.start("creating");'});
     await page.waitForFunction(()=>{const image=document.querySelector('[data-entry-logo]');return image?.complete&&image.naturalWidth>0});
     for(const selector of['html','body','#gateway-entry-transition'])assert.equal(await page.locator(selector).evaluate(el=>getComputedStyle(el).backgroundColor),rgb(brand.background));
     assert.equal(await overlay.locator('[data-entry-title]').evaluate(el=>getComputedStyle(el).color),rgb(brand.accent));
     assert.equal(new URL(await overlay.locator('[data-entry-logo]').getAttribute('src')).pathname,brand.logo.replace(/\.avif$/,'.webp'));
     const picture=overlay.locator('[data-entry-source]');if(await picture.count())assert.equal(new URL(await picture.getAttribute('srcset')).pathname,brand.logo);
     assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(pageErrors,[]);
     rows.push({engine,skin:code,stage:'landing',landingEngine,template,logo:true,palette:true,selectedOrigin:origin(code),runtimeAsset:true,cardSwitch:template===8,passed:true});
    }finally{await context.close();}
   }
   // Both token paths used by T7/T8 end at this same preparation page.
   for(const tokenMode of['preparation','classic-handoff'])for(const manual of[true,false]){
    const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});const page=await context.newPage();
    const pageErrors=[],requests=[];let releaseLogin,loginStarted=false;const loginGate=new Promise(resolve=>{releaseLogin=resolve;});
    page.on('pageerror',error=>pageErrors.push(error.message));await page.clock.install();
    await context.route('**/*',async route=>{
     const request=route.request(),url=new URL(request.url());assert.equal(url.origin,origin(code));requests.push(url.pathname);
     if(url.pathname==='/prepare')return route.fulfill({contentType:'text/html;charset=utf-8',body:api.renderPreparationPage(tokenMode==='preparation'?'p1.fixture':'classic-fixture',api.skinPreparationTheme(code))});
     if(/\.(avif|webp|png)$/.test(url.pathname))return route.fulfill({body:await readFile(path.join(gateway,'public',url.pathname)),contentType:url.pathname.endsWith('.avif')?'image/avif':url.pathname.endsWith('.webp')?'image/webp':'image/png'});
     if(url.pathname==='/api/preparations/complete')return route.fulfill({json:{username:'fixture-'+code,continuation_token:'c1.fixture',entry_token:'ge1.fixture',handoff_url:origin(code)+'/start?t=fixture'}});
     if(url.pathname==='/start'){loginStarted=true;await loginGate;return route.fulfill({json:{username:'fixture-'+code,password:'fixture-password',redirect_url:origin(code)+'/home',entry_confirmation:'ge1.confirmed',entry_id:'entry-'+code,entry_wait:{enabled:false,seconds:4,continueButtonEnabled:manual}}});}
     if(url.pathname==='/api/session/recover'){assert.equal(request.postDataJSON().entry_confirmation,'ge1.confirmed');return route.fulfill({json:{active:true,entry_confirmed:true,entry_id:'entry-'+code}});}
     if(url.pathname==='/home')return route.fulfill({contentType:'text/html',body:'<p>Confirmed fixture session</p>'});
     if(url.pathname==='/api/entry-funnel')return route.fulfill({status:204,body:''});
     throw Error('Unexpected preparation request '+url.pathname);
    });
    try{
     await page.goto(origin(code)+'/prepare');while(!loginStarted)await new Promise(resolve=>setTimeout(resolve,10));
     const button=page.locator('#continue');assert.equal(await button.isHidden(),true);releaseLogin();
     if(manual){
      await page.locator('#password').filter({hasText:'fixture-password'}).waitFor();
      assert.equal(await page.locator('#username').innerText(),'fixture-'+code);assert.equal(await button.isVisible(),true);
      await page.waitForFunction(()=>{const image=document.querySelector('img.logo');return image?.complete&&image.naturalWidth>0});
      assert.equal(await page.locator('img.logo').getAttribute('alt'),brand.name);assert.equal(new URL(await page.locator('img.logo').getAttribute('src'),page.url()).pathname,brand.logo.replace(/\.avif$/,'.webp'));
      assert.equal(await page.locator('html').evaluate(el=>getComputedStyle(el).backgroundColor),rgb(brand.background));assert.equal(await button.evaluate(el=>getComputedStyle(el).backgroundColor),rgb(brand.accent));assert.equal(await button.evaluate(el=>getComputedStyle(el).color),rgb(brand.accentText));
      assert.equal(await page.locator('meta[name="theme-color"]').getAttribute('content'),brand.background);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await page.clock.fastForward(180000);assert.equal(new URL(page.url()).pathname,'/prepare');assert.equal(requests.includes('/api/session/recover'),false);
      if(engine==='Chromium'&&tokenMode==='preparation')await page.screenshot({path:path.join(output,code+'-continue.png'),fullPage:true});
      await button.click();
     }
     await page.waitForURL(origin(code)+'/home');assert.equal(requests.filter(value=>value==='/start').length,1);assert.equal(requests.filter(value=>value==='/api/session/recover').length,1);assert.equal(requests.filter(value=>value==='/api/preparations/complete').length,tokenMode==='preparation'?1:0);assert.deepEqual(pageErrors,[]);
     rows.push({engine,skin:code,stage:'continue',tokenMode,manual,credentials:manual,brand:manual,humanWait:manual,automatic:!manual,exactSessionConfirmed:true,passed:true});
    }finally{await context.close();}
   }
   console.log(engine+' '+code+': 8 scenarios passed');
  }
 }catch(error){errors.push({engine,error:String(error.stack||error)});throw error;}finally{await browser.close();await writeFile(path.join(output,'report.json'),JSON.stringify({checkedAt:new Date().toISOString(),fixtureOnly:true,productionWrites:0,createdAccounts:0,realLogins:0,codes:api.MULTI_SKIN_CODES,brands:api.MULTI_SKIN_CODES.map(code=>({code,...api.getMultiSkinBrand(code)})),rows,errors},null,2)+'\n');}
}
console.log(rows.length+' all-skin browser scenarios passed; production writes and real accounts: 0');
