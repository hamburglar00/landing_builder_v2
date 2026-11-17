// Rendered journey contract, isolated HTML/browser fixtures; no accounts, login,
// tracking delivery or production network. Uses the real renderer/runtime.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadProductPaths} from './product-worktrees.mjs';
const productPath=loadProductPaths();
const root=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(path.join(root,'frontend/package.json'));
const {build}=require('esbuild'),{chromium}=require('playwright');
async function load(cwd,contents){
 const output=await build({absWorkingDir:cwd,stdin:{contents,loader:'ts',resolveDir:cwd},bundle:true,write:false,platform:'node',format:'cjs',external:['react','react/jsx-runtime','next/*']});
 const module={exports:{}};new Function('module','exports','require',output.outputFiles[0].text)(module,module.exports,createRequire(path.join(cwd,'package.json')));return module.exports;
}
const builder=await load(path.join(root,'frontend'),`export {renderPublicLandingHtml} from './components/public-landing/renderPublicLandingHtml';export {buildLandingConfig} from './lib/landing/buildLandingConfig';export {DEFAULT_CONFIG} from './lib/landing/mocks';`);
const gateway=await load(productPath('landing-autologuin'),`export {renderGatewayEntryTransition,GATEWAY_ENTRY_TRANSITION_RUNTIME} from './src/lib/gateway-entry-transition';export {renderPreparationPage} from './src/lib/preparation-page';`);
const classic=createRequire(productPath('landing-prueba-1','package.json'))('./lib/template7/shared.cjs');
const noScripts=html=>html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:390,height:844}});
await page.route('**/*',route=>route.abort());
const rows=[];
const scale=()=>page.locator('.entry-progress-fill').evaluate(el=>new DOMMatrixReadOnly(getComputedStyle(el).transform).a);
async function settleBar(){await page.locator('.entry-progress-fill').evaluate(el=>{for(const a of el.getAnimations())a.finish();});}
async function inspectMotion(duration){return page.locator('.entry-progress-fill').evaluate((el,duration)=>{
 const animation=el.getAnimations()[0];if(!animation)throw Error('Missing progress motion');animation.pause();
 const points=[];for(let time=0;time<=duration;time+=16){animation.currentTime=time;points.push(new DOMMatrixReadOnly(getComputedStyle(el).transform).a);}
 animation.finish();return {first:points[0],last:points.at(-1),maxFrame:Math.max(...points.slice(1).map((value,index)=>value-points[index])),monotonic:points.every((value,index)=>!index||value>=points[index-1]),distinct:new Set(points.map(value=>value.toFixed(4))).size};
 },duration);}
try{
 for(const engine of ['builder','classic'])for(const template of [7,8,9]){
  const theme={...builder.DEFAULT_CONFIG,template:'template'+template,ctaDestination:'atrio',targetProvider:'ganamos_net',titleLine1:'Fixture',template8Cover:{cardCount:1,headerText:'Fixture',footerText:'',backgroundImageUrl:'',cards:[{imageUrl:'/fixture.webp',text:'Ganamos',targetProvider:'ganamos_net',ctaText:''}]}};
  const config=builder.buildLandingConfig({id:'11111111-1111-4111-8111-111111111111',name:'progress-fixture',comment:'',pixelId:'',postUrl:'',landingTag:'TEST',config:theme});
  const html=engine==='builder'?builder.renderPublicLandingHtml({slug:config.name,config}):classic.renderClassicPublicLandingHtml({slug:config.name,config},'function getOrCreateDeviceId(){return "44444444-4444-4444-8444-444444444444";}');
  await page.setContent(noScripts(html));
  if(template===8)await page.evaluate(()=>{document.querySelector('[data-template8-entry]').hidden=false;document.querySelector('[data-template8-grid]').hidden=true;});
  assert.equal(await page.locator('#gateway-entry-transition').getAttribute('data-stage'),'creating',`${engine} T${template} starts in creating`);
  await page.addScriptTag({content:gateway.GATEWAY_ENTRY_TRANSITION_RUNTIME+';window.fixtureTransition=createGatewayEntryTransition(document.getElementById("gateway-entry-transition"));window.fixtureTransition.start("preparing");'});
  assert.equal(await page.locator('.entry-progress-track').evaluate(el=>el.getBoundingClientRect().height),9,'bar remains clearly visible');
  const initialMotion=await inspectMotion(9000);
  assert(initialMotion.first<.1,'begin visibly before seventy percent');
  assert(initialMotion.monotonic&&initialMotion.maxFrame<.02&&initialMotion.distinct>300,'initial motion flows every frame without discrete jumps');
  assert(initialMotion.last>=.899&&initialMotion.last<1,'elapsed animation stays pending at ninety');
  await settleBar();const pending=await scale();
  await page.evaluate(()=>window.fixtureTransition.start('creating'));const creating=await scale();
  assert(creating>=pending-.001,'identity preparation must not regress when account creation starts');
  const preparationTheme={title:'Fixture',logo:'/fixture.webp',logoAlt:'Fixture',background:'#11001f',accent:'#f7c62f',accentText:'#11001f',text:'#fff',muted:'#f3e8f8',panel:'#270538',panelBorder:'#8d2db8',spinnerTrack:'#8d2db8',shadow:'0 10px 30px #08000dbb'};
  await page.setContent(noScripts(gateway.renderPreparationPage(engine==='classic'?'classic-fixture':'p1.fixture',preparationTheme)));
  const preparation=await scale();assert(preparation>=creating-.001,'navigation to preparation must not regress');await settleBar();const prepared=await scale();
  await page.setContent(gateway.renderGatewayEntryTransition('ganamos_net',{active:true}));
  const connecting=await scale();assert(connecting>=prepared-.001,'confirmed session to chat connection must not regress');
  await page.addScriptTag({content:gateway.GATEWAY_ENTRY_TRANSITION_RUNTIME+`;window.fixtureTransition=createGatewayEntryTransition(document.getElementById('gateway-entry-transition'));window.fixtureTransition.start('connecting');window.fixtureFrame={contentWindow:{},src:'https://chat.fixture/embed/fixture?token=fixture'};window.fixtureTransition.bind(window.fixtureFrame,'https://chat.fixture',true);window.fixtureSignal=function(type,origin='https://chat.fixture'){window.dispatchEvent(new MessageEvent('message',{origin,source:null,data:{source:'atrio-widget',type,visibleEntry:true}}))};`});
  // MessageEvent source is read-only; use a real iframe's WindowProxy.
  await page.evaluate(()=>{const frame=document.createElement('iframe');document.body.appendChild(frame);window.fixtureTransition.bind(frame,'https://chat.fixture',true);window.fixtureSignal=(type,origin='https://chat.fixture')=>window.dispatchEvent(new MessageEvent('message',{origin,source:frame.contentWindow,data:{source:'atrio-widget',type,visibleEntry:true}}));});
  const finalMotion=await inspectMotion(16000);
  assert(finalMotion.monotonic&&finalMotion.maxFrame<.002&&finalMotion.distinct>300,'final motion keeps progressing gradually');
  await settleBar();assert((await scale())<1,'elapsed animation cannot complete entry');
  await page.evaluate(()=>window.fixtureSignal('atrio.widget.usable','https://other.fixture'));
  assert.notEqual(await page.locator('[data-entry-progress]').getAttribute('data-phase'),'complete');
  await page.evaluate(()=>window.fixtureSignal('atrio.widget.ready'));
  assert.equal(await page.locator('#gateway-entry-transition').isHidden(),true,'reveal the composer before awaiting its paint');
  assert.notEqual(await page.locator('[data-entry-progress]').getAttribute('data-phase'),'complete');
  await page.evaluate(()=>window.fixtureSignal('atrio.widget.usable'));
  assert.equal(await page.locator('[data-entry-progress]').getAttribute('data-phase'),'complete');
  rows.push({engine,template,pending,creating,preparation,connecting,initialMotion,finalMotion,completedOnlyAfterUsable:true});
 }
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.setContent(gateway.renderGatewayEntryTransition('ganamos_net',{active:true,stage:'creating'}));
 assert.equal(await page.locator('.entry-progress-fill').evaluate(el=>el.getAnimations().length),0,'reduced motion does not autoplay');
 assert((await scale())<1,'reduced motion cannot imply completion');
 await page.locator('[data-entry-progress]').evaluate(el=>el.dataset.phase='complete');
 assert.equal(await scale(),1,'completion takes effect immediately even with reduced motion');
 console.log(JSON.stringify({fixtureOnly:true,productionRequests:0,rows},null,2));
}finally{await browser.close();}
