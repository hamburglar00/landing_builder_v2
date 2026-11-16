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
const rows=[];
for(const repo of baseline?['landing-autologuin']:['landing-autologuin','ases-gateway','ganamos-gateway','multi-skin-gateway']){
const source=async file=>baseline?execFileSync('git',['show',baseline+':'+file],{cwd:productPath(repo),encoding:'utf8'}):readFile(productPath(repo,file),'utf8');
const js=await source('public/gateway-client.js');
const css=await source('public/gateway-client.css');
const viewport=js.match(/  let chatClearanceFrame = 0;[\s\S]*?(?=  function postJson\()/)?.[0];
assert(viewport,'production viewport controller exists');
for(const [engine,type] of [['Chromium',chromium],['WebKit',webkit]]){
 const browser=await type.launch({headless:true});
 try{for(const platform of ['ios','android'])for(const standalone of [false,true]){
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await page.route('https://keyboard.fixture/**',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>html,body{margin:0;overflow:hidden}${css}</style><div id="gateway-chat-shell" data-open="true" data-motion="open"><iframe src="https://chat.fixture/embed"></iframe></div>`}));
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
  for(let cycle=0;cycle<3;cycle++){
   await input.focus();
   const top=platform==='ios'?(cycle?160:60):cycle?28:0;
   await page.evaluate(({top,cycle})=>{window.fixtureInnerHeight=cycle?360:844;Object.assign(window.nativeFixture,{height:360,offsetTop:top});visualViewport.dispatchEvent(new Event('resize'));visualViewport.dispatchEvent(new Event('scroll'));},{top,cycle});
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const rect=await shell.boundingBox();
   assert(rect.y>=top+7.5,JSON.stringify({engine,platform,standalone,cycle,rect,top}));
   assert(rect.y+rect.height<=top+360-7.5,'composer stays above keyboard');
   const frame=await page.locator('iframe').boundingBox();assert(frame.y>=rect.y&&frame.y+frame.height<=rect.y+rect.height+1,'iframe fits panel');
   await input.evaluate(el=>el.blur());
   await page.evaluate(()=>{window.fixtureInnerHeight=844;Object.assign(window.nativeFixture,{height:844,offsetTop:0});visualViewport.dispatchEvent(new Event('resize'));});
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const restored=await shell.boundingBox();
   assert.deepEqual(restored,original,'closing keyboard restores approved panel geometry');
  }
  rows.push({repo,engine,platform,standalone,focusCycles:3,passed:true});await page.close();
 }}finally{await browser.close();}
}
}
console.log(JSON.stringify({rows,physicalKeyboardTested:false,productionRequests:0}));
