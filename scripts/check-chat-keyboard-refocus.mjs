// Real cross-origin iframe/input, simulated native viewport resize and pan.
// Headless engines cannot open an iPhone/Android system keyboard.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {loadProductPaths} from './product-worktrees.mjs';
import {execFileSync} from 'node:child_process';
const productPath=loadProductPaths(),require=createRequire(new URL('../frontend/package.json',import.meta.url));
const {chromium,webkit}=require('playwright');
const baseline=process.argv.find(arg=>arg.startsWith('--baseline='))?.slice(11);
const requestedRepo=process.argv.find(arg=>arg.startsWith('--repo='))?.slice(7);
const repos=['landing-autologuin','ases-gateway','ganamos-gateway','multi-skin-gateway'];
if(requestedRepo)assert(repos.includes(requestedRepo),'unknown gateway repo');
const rows=[];
for(const repo of baseline?['landing-autologuin']:requestedRepo?[requestedRepo]:repos){
const source=async file=>baseline?execFileSync('git',['show',baseline+':'+file],{cwd:productPath(repo),encoding:'utf8'}):readFile(productPath(repo,file),'utf8');
const js=await source('public/gateway-client.js');
const css=await source('public/gateway-client.css');
const viewport=js.match(/  let chatClearanceFrame = 0;[\s\S]*?(?=  function postJson\()/)?.[0];
assert(viewport,'production viewport controller exists');
for(const [engine,type] of [['Chromium',chromium],['WebKit',webkit]]){
 const browser=await type.launch({headless:true});
 try{for(const platform of ['ios','android'])for(const standalone of [false,true]){
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await page.route('https://keyboard.fixture/**',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>html,body{margin:0;overflow:hidden}${platform==='ios'?css.replaceAll('env(safe-area-inset-bottom)','34px'):css}</style><div id="gateway-chat-shell" data-open="true" data-motion="open"><iframe src="https://chat.fixture/embed"></iframe></div>`}));
  await page.route('https://chat.fixture/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;height:100%;overflow:hidden}main{height:100%;display:flex;flex-direction:column}header{height:50px;flex:none}section{flex:1;overflow:auto}input{font-size:16px;height:40px;flex:none}</style><main><header>Asesor</header><section>Historial</section><input placeholder="Escribí un mensaje"></main>'}));
  await page.goto('https://keyboard.fixture/home');
  await page.evaluate(standalone=>{
   if(standalone)document.documentElement.setAttribute('data-gateway-standalone','');
   window.nativeFixture=new EventTarget();Object.assign(window.nativeFixture,{height:844,offsetTop:0});
   Object.defineProperty(window,'visualViewport',{configurable:true,value:window.nativeFixture});
   window.fixtureInnerHeight=844;Object.defineProperty(window,'innerHeight',{configurable:true,get:()=>window.fixtureInnerHeight});
  },standalone);
  await page.addScriptTag({content:`(()=>{const standalone=${standalone};${viewport};window.syncFixture=syncChatVisualViewport;visualViewport.addEventListener('resize',scheduleChatVisualViewport);visualViewport.addEventListener('scroll',scheduleChatVisualViewport);syncChatVisualViewport();})()`});
  const shell=page.locator('#gateway-chat-shell'),original=await shell.boundingBox();
  const input=page.frameLocator('iframe').locator('input');
  await input.waitFor({timeout:5000});
  const updateViewport=async(height,top=0,innerHeight=844)=>{
   await page.evaluate(({height,top,innerHeight})=>{
    window.fixtureInnerHeight=innerHeight;
    Object.assign(window.nativeFixture,{height,offsetTop:top});
    visualViewport.dispatchEvent(new Event('resize'));
    visualViewport.dispatchEvent(new Event('scroll'));
   },{height,top,innerHeight});
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   return shell.boundingBox();
  };
  // Native keyboards report a sequence of shrinking viewports. Checking only
  // their final size missed the previous 110px jump at the 18% threshold.
  const openingHeights=[842,820,780,740,710,695,690,650,500,360];
  await input.focus();
  let previous={height:844,rect:original,top:0};
  for(const height of openingHeights){
   const top=platform==='ios'?Math.max(0,Math.round((650-height)*60/290)):0;
   const rect=await updateViewport(height,top);
   const relativeTop=rect.y-top,previousRelativeTop=previous.rect.y-previous.top;
   const context=JSON.stringify({repo,engine,platform,standalone,height,rect,previous});
   assert(relativeTop>=7.5,'header stays below safe top during animation: '+context);
   assert(rect.y+rect.height<=top+height-Math.min(8,844-original.y-original.height)+.5,
    'composer follows keyboard during animation: '+context);
   assert(rect.height<=original.height+.5,'opening keyboard never enlarges the resting panel');
   assert(relativeTop<=previousRelativeTop+.5,'opening header does not reverse direction: '+context);
   assert(previousRelativeTop-relativeTop<=previous.height-height+2,
    'header movement must follow viewport movement without a threshold jump: '+context);
   const occluded=Math.max(0,844-(top+height));
   const restingGap=844-original.y-original.height;
   const gap=top+height-rect.y-rect.height;
   if(platform==='ios' && occluded>=120)assert(Math.abs(gap-8)<=1,'keyboard already covers the home indicator: '+context);
   if(platform==='ios')assert(rect.y+rect.height<=844-34+.5,'panel stays above physical safe edge');
   if(height===842 && restingGap<=8)assert(rect.y<original.y-.5,'panel follows the first small keyboard movement');
   previous={height,rect,top};
  }
  await input.evaluate(el=>el.blur());
  for(const height of [...openingHeights.slice(0,-1)].reverse().concat(844)){
   const top=platform==='ios'?Math.max(0,Math.round((650-height)*60/290)):0;
   const rect=await updateViewport(height,top);
   const relativeTop=rect.y-top,previousRelativeTop=previous.rect.y-previous.top;
   assert(relativeTop>=previousRelativeTop-.5,'closing header does not overshoot then reverse');
   assert(relativeTop-previousRelativeTop<=height-previous.height+2,'closing header follows viewport continuously');
   previous={height,rect,top};
  }
  assert.deepEqual(await shell.boundingBox(),original,'gradual keyboard dismissal restores approved geometry');
  for(let cycle=0;cycle<3;cycle++){
   await input.focus();
   const top=platform==='ios'?(cycle?160:60):cycle?28:0;
   const rect=await updateViewport(360,top,cycle?360:844);
   assert(rect.y>=top+7.5,JSON.stringify({engine,platform,standalone,cycle,rect,top}));
   assert(rect.y+rect.height<=top+360-7.5,'composer stays above keyboard');
   const frame=await page.locator('iframe').boundingBox();assert(frame.y>=rect.y&&frame.y+frame.height<=rect.y+rect.height+1,'iframe fits panel');
   await input.evaluate(el=>el.blur());
   const restored=await updateViewport(844);
   assert.deepEqual(restored,original,'closing keyboard restores approved panel geometry');
  }
  // A changed orientation must capture its own resting height, not reuse the
  // portrait panel size after a previous keyboard opening.
  await page.setViewportSize({width:600,height:390});
  const landscape=await updateViewport(390,0,390);
  assert.equal(await page.evaluate(()=>document.documentElement.dataset.gatewayKeyboard),'false','rotation itself is not a keyboard');
  await input.focus();
  const rotatedKeyboard=await updateViewport(270,platform==='ios'?20:0,390);
  assert(rotatedKeyboard.height<=landscape.height+.5,'rotated keyboard uses its new resting height');
  await input.evaluate(el=>el.blur());
  assert.deepEqual(await updateViewport(390,0,390),landscape,'rotated keyboard restores landscape geometry');
  await page.setViewportSize({width:390,height:844});
  assert.deepEqual(await updateViewport(844),original,'returning to portrait restores original geometry');
  rows.push({repo,engine,platform,standalone,focusCycles:3,gradualFrames:20,orientationChecked:true,passed:true});await page.close();
 }}finally{await browser.close();}
}
}
console.log(JSON.stringify({rows,physicalKeyboardTested:false,productionRequests:0}));
