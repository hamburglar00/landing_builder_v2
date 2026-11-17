// Exercises real gateway renderers in mobile WebKit/Chromium; browser chrome itself is OS-owned.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {loadProductPaths} from './product-worktrees.mjs';
const require=createRequire(new URL('../frontend/package.json',import.meta.url));
const {build}=require('esbuild'),{chromium,webkit}=require('playwright');
const roots=loadProductPaths(), output=path.resolve(roots('landing-builder'),'../.local/entry-recovery-keyboard-20261116/safe-area');
await mkdir(output,{recursive:true});
const cases=[['rey_de_ases','landing-autologuin','#141414'],['ases_del_norte','ases-gateway','#101114'],['ganamos_net','ganamos-gateway','#11001f'],['multi_skin','multi-skin-gateway','#121212']];
const providers=[];
for(const [provider,repo,color] of cases){
 const canonical=roots(repo);
 const source=`export * from './src/lib/gateway-agency-page';export * from './src/lib/gateway-entry-transition';export * from './src/lib/html-rewriter';${repo==='landing-autologuin'?'':"export * from './src/lib/skin-registry';"}`;
 const compiled=await build({absWorkingDir:canonical,stdin:{contents:source,resolveDir:canonical,loader:'ts'},bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'response-only',setup(b){b.onResolve({filter:/^next\/server$/},()=>({path:'response',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const NextResponse=Response;',loader:'js'}));}}]});
 const api=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
 const template='<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body><header>Casino</header></body></html>';
 const options={appId:provider,displayName:provider,chatEmbedUrl:'https://chat.fixture/embed/test',initialChatOpen:true,skin:api.getSkinConfig?.('ganamos_plus'),provider:api.getProviderConfig?.(),accessToken:'fixture',user:{}};
 const casino=repo==='landing-autologuin'?api.rewriteReyHtml(template,{gatewayClient:options}).html:repo==='ases-gateway'?api.rewriteAsesHtml(template,options):repo==='ganamos-gateway'?api.rewriteGanamosHtml(template,options):api.rewriteMultiSkinHtml(template,options);
 providers.push({provider,repo,color,api,casino,login:await api.gatewayAgencyPage(provider,277).text()});
}
let checked=0;
for(const [engine,type]of [['chromium',chromium],['webkit',webkit]]){
 const browser=await type.launch();
 try{for(const p of providers){
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await page.route('**/*',async route=>{const url=new URL(route.request().url());
   if(url.pathname==='/login')return route.fulfill({contentType:'text/html',body:p.login});
   if(url.pathname==='/casino')return route.fulfill({contentType:'text/html',body:p.casino});
   if(url.pathname==='/gateway-client.js')return route.fulfill({contentType:'text/javascript',body:''});
   if(/\.(?:webp|avif|png|css)$/.test(url.pathname))try{return route.fulfill({body:await readFile(roots(p.repo,'public',url.pathname.slice(1))),contentType:url.pathname.endsWith('.css')?'text/css':undefined})}catch{}
   return route.fulfill({json:{active:false}});
  });
  await page.goto('https://safe-area.fixture/login');await page.locator('#username').waitFor({state:'visible'});
  const login=await page.evaluate(()=>({meta:document.querySelector('meta[name="theme-color"]').content,base:getComputedStyle(document.documentElement).getPropertyValue('--page').trim(),glow:getComputedStyle(document.body,'::before').backgroundImage,edge:getComputedStyle(document.body,'::after').backgroundImage}));
  assert.equal(login.meta,login.base);assert.ok(login.glow.includes('radial-gradient'));assert.ok(login.edge.startsWith('linear-gradient'));
  if(engine==='chromium')await page.screenshot({path:path.join(output,p.provider+'-login.png')});
  await page.goto('https://safe-area.fixture/casino');
  const snapshot=()=>page.evaluate(()=>({meta:document.querySelector('meta[name="theme-color"]').content,canvas:getComputedStyle(document.documentElement).backgroundColor,body:getComputedStyle(document.body).backgroundColor,edge:getComputedStyle(document.getElementById('gateway-browser-edge')).backgroundColor,hidden:document.getElementById('gateway-entry-transition').hidden}));
  const first=await snapshot(),rgb='rgb('+[1,3,5].map(i=>parseInt(p.color.slice(i,i+2),16)).join(', ')+')';
  assert.equal(first.meta,p.color);assert.equal(first.canvas,rgb);assert.equal(first.body,rgb);assert.equal(first.edge,rgb);
  await page.addScriptTag({content:p.api.GATEWAY_ENTRY_TRANSITION_RUNTIME+'\nwindow.safeAreaController=createGatewayEntryTransition(document.getElementById("gateway-entry-transition"));safeAreaController.start("connecting");'});
  for(let cycle=0;cycle<2;cycle++){
   const during=await snapshot();assert.equal(during.meta,p.color);assert.equal(during.canvas,rgb);assert.equal(during.body,rgb);
   await page.evaluate(()=>safeAreaController.finish());const after=await snapshot();assert.equal(after.meta,p.color);assert.equal(after.canvas,rgb);assert.equal(after.hidden,true);
   await page.evaluate(()=>safeAreaController.start('connecting'));
  }
  console.log(JSON.stringify({provider:p.provider,engine,login:login.base,casino:p.color,firstPaintAndReopen:true}));checked++;await page.close();
 }}finally{await browser.close()}
}
console.log(JSON.stringify({checks:checked,physicalSafariChrome:false,output}));
