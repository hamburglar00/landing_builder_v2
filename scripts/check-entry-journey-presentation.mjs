// Local rendering only: real T7/8/9 markup and T8 selection adapter. No signup,
// login, analytics delivery or production requests. Images are local fixtures.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import { loadProductPaths } from './product-worktrees.mjs';
import { loadSource as load } from './gateway-browser-fixtures.mjs';
const product = loadProductPaths();
const root = product('landing-builder');
Object.assign(process.env,{REY_GATEWAY_ORIGIN:'https://rey.fixture',ASES_DEL_NORTE_GATEWAY_ORIGIN:'https://ases.fixture',GANAMOS_NET_GATEWAY_ORIGIN:'https://net.fixture',MULTI_SKIN_GATEWAY_ORIGIN:'https://plus.fixture',GANAMOS_PLUS_GATEWAY_ORIGIN:'https://plus.fixture',MULTI_SKIN_GATEWAY_BASE_DOMAIN:'skins.fixture'});
const require=createRequire(path.join(root,'frontend/package.json'));
const {chromium}=require('playwright');
const builder=await load(path.join(root,'frontend'),`export {renderPublicLandingHtml} from './components/public-landing/renderPublicLandingHtml';export {buildLandingConfig} from './lib/landing/buildLandingConfig';export {DEFAULT_CONFIG} from './lib/landing/mocks';export {buildTemplate7RuntimeConfig} from './components/public-landing/template7FastRuntime';export {adaptTemplate8Runtime} from './components/public-landing/template8Runtime';export {getMultiSkinBrand} from './lib/skin-branding';`);
const nexo=await load(product('NexoBet'),`export {nexoLandingEntryPresentation} from './src/lib/nexobet/landing-entry-presentation';export {renderTemplate9View} from './src/vendor/builder/components/public-landing/template9View';export {TEMPLATE9_CSS} from './src/vendor/builder/components/public-landing/template9Css';export {renderTemplate8View} from './src/vendor/builder-workspace/components/public-landing/template8View';export {TEMPLATE8_CRITICAL_CSS} from './src/vendor/builder-workspace/components/public-landing/publicLandingCss';`);
const classic=createRequire(product('landing-prueba-1','package.json'))('./lib/template7/shared.cjs');
const noScripts=html=>html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
const browser=await chromium.launch({headless:true});
const page=await browser.newPage();
let currentRepo='landing-autologuin';
await page.route('**/*',async route=>{
 const pathname=new URL(route.request().url()).pathname;
 // Only serve entry logos from disk. Everything else is intentionally isolated.
 if(/\.(avif|webp)$/.test(pathname)&&!pathname.includes('..')){
  try{return await route.fulfill({body:await readFile(product(currentRepo,'public',pathname.slice(1))),contentType:pathname.endsWith('.avif')?'image/avif':'image/webp'});}catch{}
 }
 return route.abort();
});
async function measure(){return page.evaluate(()=>{
 const box=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};};
 const overlay=document.querySelector('#gateway-entry-transition');
 const style=getComputedStyle(overlay||document.body),heading=getComputedStyle(document.querySelector(overlay?'[data-entry-title]':'h1'));
 return{logo:box(overlay?'[data-entry-logo]':'.logo'),bar:box('.entry-progress-track'),heading:box(overlay?'[data-entry-title]':'h1'),color:heading.color,font:heading.font,spacing:heading.letterSpacing,background:style.backgroundColor,gradient:getComputedStyle(document.querySelector('.entry-progress-fill')).backgroundImage,overflow:document.documentElement.scrollWidth>innerWidth};
});}
function same(actual,expected,label){
 for(const element of ['logo','bar','heading'])for(const key of ['x','y','width','height'])assert(Math.abs(actual[element][key]-expected[element][key])<1,`${label} ${element}.${key}: ${actual[element][key]} != ${expected[element][key]}`);
 for(const key of ['color','font','spacing','background','gradient'])assert.equal(actual[key],expected[key],`${label} ${key}`);
 assert.equal(actual.overflow,false,label+' no horizontal overflow');
}
function sameStatusAppearance(actual, expected, label) {
 for (const key of ['font', 'spacing', 'background']) assert.equal(actual[key],expected[key],label+' '+key);
 assert.equal(actual.color,'rgb(255, 255, 255)',label+' white status text');
 for (const key of ['x', 'width', 'height']) assert.ok(Math.abs(actual.logo[key]-expected.logo[key])<1,label+' logo '+key);
 assert.equal(actual.overflow,false,label+' no horizontal overflow');
}
const rows=[];
try{
 for(const [provider,skin,repo] of [['rey_de_ases',null,'landing-autologuin'],['ases_del_norte',null,'ases-gateway'],['ganamos_net',null,'ganamos-gateway'],['multi_skin','ganamos_plus','multi-skin-gateway'],['multi_skin','casino_zeus','multi-skin-gateway']]){
  currentRepo=repo;
  const gateway=await load(product(repo),`export * from './src/lib/gateway-entry-transition';export {renderPreparationPage} from './src/lib/preparation-page';`);
  const override=skin?builder.getMultiSkinBrand(skin):undefined;
  const theme=gateway.gatewayPreparationTheme(provider,override);
  const expectedLandingLogo = skin === 'ganamos_plus' ? '/ganamos-wordmark.webp' : theme.logo.replace(/\.avif$/,'.webp');
  if (skin === 'ganamos_plus') {
   const plus = await readFile(product(repo,'public',expectedLandingLogo.slice(1)));
   const net = await readFile(product('ganamos-gateway','public','ganamos-net-transition-logo.webp'));
   assert.ok(plus.equals(net),'Ganamos+ uses the Ganamos NET wordmark on the landing');
  }
  for(const viewport of [{width:320,height:568},{width:390,height:844},{width:1365,height:768}]){
   await page.setViewportSize(viewport);
   await page.setContent(noScripts(gateway.renderPreparationPage('opaque-fixture',theme,'',{newAccount:true})));
   const preparation=await measure();
   assert.equal(preparation.overflow,false);
   assert.equal(await page.locator('[data-stop]').count(),0);
   for(const engine of ['builder','classic','nexo'])for(const template of engine==='nexo'?[8,9]:[7,8,9]){
    const source={...builder.DEFAULT_CONFIG,template:'template'+template,ctaDestination:'atrio',targetProvider:provider,multiSkinCode:skin,skinCode:skin,titleLine1:'Fixture',template8Cover:{cardCount:1,headerText:'Fixture',footerText:'',backgroundImageUrl:'',cards:[{imageUrl:'/fixture.webp',text:theme.title,targetProvider:provider,multiSkinCode:skin,ctaText:''}]}};
    const config=builder.buildLandingConfig({id:'11111111-1111-4111-8111-111111111111',name:'presentation-fixture',comment:'',pixelId:'',postUrl:'',landingTag:'TEST',config:source});
    // The public config owns the resolved skin; this is normally set by its adapter.
    if(skin)config.tracking.skin_code=skin;
    const nexoEntry=nexo.nexoLandingEntryPresentation(config,'https://fixture.local',['https://fixture.local']);
    const html=engine==='nexo'?`<style>${template===8?nexo.TEMPLATE8_CRITICAL_CSS:nexo.TEMPLATE9_CSS}</style>${template===8?nexo.renderTemplate8View({slug:config.name,config}):nexo.renderTemplate9View(config)}${nexoEntry.overlay}`:engine==='builder'?builder.renderPublicLandingHtml({slug:config.name,config}):classic.renderClassicPublicLandingHtml({slug:config.name,config},'function getOrCreateDeviceId(){return "44444444-4444-4444-8444-444444444444";}');
    await page.setContent(noScripts(html));
    if(engine==='nexo'){
     await page.addScriptTag({content:`(function(){${nexoEntry.script}if(${template}===8){selectNexoEntryPresentation(1);document.querySelector('[data-template8-grid]').hidden=true;document.querySelector('[data-template8-entry]').hidden=false;}nexoEntryTransition.start('creating');})();`});
    }else if(template===8){
     const cfg=builder.buildTemplate7RuntimeConfig(config.name,config);
     // Run the actual selection adapter with inert identity/analytics dependencies.
     await page.addScriptTag({content:`var cfg=${JSON.stringify(cfg)},clickLocked=false,template7EntryGeneration=0;window.__T7_ENTRY_STARTED__=false;function clearTemplate7Unavailable(){}function cancelTemplate7Destination(){}function setTemplate7Error(){}function notifyTemplate6CardClick(){}function template7RequestDestination(){return Promise.resolve(null)}function observeTemplate7Destination(){}function warmTemplate7Entry(){}${builder.adaptTemplate8Runtime('      function init() {}',false)}init();`});
     await page.locator('[data-template8-card-index="1"]').click();
    }
    if(engine!=='nexo')await page.addScriptTag({content:gateway.GATEWAY_ENTRY_TRANSITION_RUNTIME+';createGatewayEntryTransition(document.getElementById("gateway-entry-transition")).start("creating");'});
    const transition=await measure(),label=`${provider}/${skin||''} ${engine} T${template} ${viewport.width}`;
    same(transition,preparation,label);
    assert.equal(await page.locator('[data-stop]').count(),0,label+' has no obsolete steps');
    const logo=await page.locator('[data-entry-logo]').getAttribute('data-src');
    const expectedLogo = template === 8 ? theme.logo.replace(/\.avif$/,'.webp') : expectedLandingLogo;
    assert.equal(new URL(logo,'https://fixture.local').pathname,expectedLogo,label+' landing logo');
    if(process.env.ENTRY_VISUAL_SCREENSHOT&&template===9&&engine==='builder'&&provider==='ganamos_net'&&viewport.width===390){await page.locator('[data-entry-logo]').evaluate(image=>image.decode());await page.screenshot({path:process.env.ENTRY_VISUAL_SCREENSHOT});}
    rows.push(label);
   }
   await page.setContent(gateway.renderGatewayEntryTransition(provider,{active:true,brand:override}));
   const connecting = await measure();
   sameStatusAppearance(connecting, preparation, provider+' connecting '+viewport.width);
   assert.equal(await page.locator('[data-entry-title]').innerText(),'Conectando con tu asesor…');
   assert.equal(await page.locator('[data-entry-progress]').isVisible(),false);
   await page.emulateMedia({reducedMotion:'reduce'});
   assert.equal(await page.locator('.entry-progress-fill').evaluate(el=>getComputedStyle(el).animationDuration),'0s');
   await page.emulateMedia({reducedMotion:'no-preference'});
  }
 }
 console.log(JSON.stringify({localOnly:true,productionRequests:0,renderedJourneys:rows.length,connectingChecks:15,providers:5,viewports:3,matching:'logo, heading, progress positions; palette, fonts, gradient; selected T8 brand; reduced motion'},null,2));
}finally{await browser.close();}
