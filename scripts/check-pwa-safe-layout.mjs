import assert from 'node:assert/strict';import {createRequire} from 'node:module';import{readFile,writeFile,mkdir}from'node:fs/promises';import path from'node:path';import{fileURLToPath}from'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),require=createRequire(new URL('../frontend/package.json',import.meta.url)),{build}=require('esbuild'),{chromium,webkit}=require(path.join(process.env.APPDATA,'npm/node_modules/playwright'));
const output=new URL('../.vercel/pwa-safe-layout/',import.meta.url);await mkdir(output,{recursive:true});
const repos=['landing-autologuin','ases-gateway','ganamos-gateway','multi-skin-gateway'],results=[];
const factories={
 'landing-autologuin':{name:'rewriteReyHtml',options:'{gatewayClient:{appId:"fixture",displayName:"Fixture",chatEmbedUrl:"https://chat.test/embed"}}',suffix:'.html'},
 'ases-gateway':{name:'rewriteAsesHtml',extra:'import{getProviderConfig}from"./src/lib/skin-registry";',options:'{appId:"fixture",displayName:"Fixture",chatEmbedUrl:"https://chat.test/embed",provider:getProviderConfig()}'},
 'ganamos-gateway':{name:'rewriteGanamosHtml',extra:'import{getProviderConfig}from"./src/lib/skin-registry";',options:'{appId:"fixture",displayName:"Fixture",chatEmbedUrl:"https://chat.test/embed",provider:getProviderConfig()}'},
 'multi-skin-gateway':{name:'rewriteMultiSkinHtml',extra:'import{getSkinConfig}from"./src/lib/skin-registry";',options:'{appId:"fixture",displayName:"Fixture",chatEmbedUrl:"https://chat.test/embed",skin:getSkinConfig("ganamos_plus"),accessToken:"synthetic",user:{id:1}}'}
};
const provider='<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><link rel="apple-touch-icon" href="/old-wordmark.png"><link rel="icon" href="/old-wordmark.png"><style>html,body{margin:0;height:100%;font-family:system-ui}#provider-header{position:fixed;inset:0 0 auto;height:56px;background:#432166;color:white;display:flex;align-items:center;justify-content:center}#provider-nav{position:fixed;inset:auto 0 0;height:56px;background:#432166;color:white;display:flex;align-items:center;justify-content:space-around}#provider-nav button{height:32px;color:white;background:transparent;border:1px solid white;font-size:20px}main{padding:90px 20px;color:white}</style></head><body><header id="provider-header">Casino · 0.00 ARS</header><main>Home de la plataforma</main><nav id="provider-nav"><button>♧</button><button>♤</button><button>♢</button></nav></body></html>';
for(const repo of repos){
 const gateway=path.join(root,repo),f=factories[repo];const compiled=await build({absWorkingDir:gateway,tsconfig:path.join(gateway,'tsconfig.json'),stdin:{resolveDir:gateway,loader:'ts',contents:'import{'+f.name+'}from"./src/lib/html-rewriter";'+(f.extra||'')+'export const html='+f.name+'('+JSON.stringify(provider)+','+f.options+')'+(f.suffix||'')+';'},bundle:true,write:false,platform:'node',format:'cjs',packages:'external'});
 const loaded={exports:{}};new Function('module','exports','require',compiled.outputFiles[0].text)(loaded,loaded.exports,createRequire(path.join(gateway,'package.json')));
 let html=loaded.exports.html;assert.ok(!html.includes('viewport-fit=cover'));assert.ok(!html.includes('black-translucent'));assert.ok(!html.includes('/old-wordmark.png'));
 const css=await readFile(path.join(gateway,'public/gateway-client.css'),'utf8'),js=await readFile(path.join(gateway,'public/gateway-client.js'),'utf8'),guide=await readFile(path.join(gateway,'public/gateway-pwa-guide.js'),'utf8');
 html=html.replace('</head>','<style>'+css+'</style></head>');
 for(const [engine,launcher] of [['Chromium',chromium],['WebKit',webkit]]){
  const browser=await launcher.launch({headless:true});try{
   for(const [installed,width,height] of [[false,390,844],[true,390,844],[true,844,390]]){
    const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce',userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Version/26.0 Mobile Safari/604.1'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await context.addInitScript(installed=>Object.defineProperty(navigator,'standalone',{configurable:true,value:installed}),installed);
    await context.route('https://fixture.test/**',async route=>{const url=new URL(route.request().url());if(url.pathname==='/gateway-client.js')return route.fulfill({contentType:'text/javascript',body:js});if(url.pathname.startsWith('/api/'))return route.fulfill({json:{ok:true}});if(url.pathname==='/os')return route.fulfill({contentType:'text/html',body:'<!doctype html><html><body style="margin:0;background:#11001f"><div id="native-status" style="position:fixed;inset:0 0 auto;height:55px;color:white">16:12 — área nativa simulada</div><iframe id="webview" src="/home" style="position:fixed;top:55px;left:0;width:100%;height:calc(100% - 89px);border:0"></iframe><div id="native-home" style="position:fixed;inset:auto 0 0;height:34px;color:white">Indicador de inicio simulado</div></body></html>'});return route.fulfill({contentType:'text/html',body:html});});
    await context.route('https://chat.test/**',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><p>Chat de prueba</p>'}));
    await page.goto('https://fixture.test/'+(installed?'os':'home'));
    const frame=installed?page.frames().find(f=>f.url().endsWith('/home')):page.mainFrame();assert.ok(frame);
    await frame.waitForSelector('#gateway-chat-button',{state:'attached'});await frame.evaluate(()=>document.documentElement.dataset.gatewayPresentationReady='true');
    if(installed){
     assert.equal(await frame.locator('#gateway-browser-edge').evaluate(e=>getComputedStyle(e).display),'none','Standalone never masks the fixed casino menu');
     assert.equal(await frame.locator('html').getAttribute('data-gateway-standalone'),'');
     const canvas=await page.locator('#webview').boundingBox(),header=await frame.locator('#provider-header').boundingBox(),nav=await frame.locator('#provider-nav').boundingBox();
     assert.ok(header.y>=55&&header.y+header.height<=height-34);assert.ok(nav.y>=55&&nav.y+nav.height<=height-34);assert.ok(Math.abs(canvas.y-55)<1);
     for(const button of await frame.locator('#provider-nav button').all()){const bounds=await button.boundingBox();assert.ok(bounds.y+bounds.height<=height-34);}
     await page.screenshot({path:fileURLToPath(new URL(engine+'-'+repo+'-'+width+'-installed.png',output))});
    }else{
     await frame.addScriptTag({content:guide});
     for(const kind of ['install','notifications']){
      await frame.evaluate(kind=>{window.testGuide=window.AtrioPwaGuide.create({kind,icon:'/logo.png'});},kind);
      assert.equal(await frame.locator('#gateway-chat-button').evaluate(e=>getComputedStyle(e).visibility),'hidden');
      const sheet=await frame.locator('.ig-sheet').boundingBox();assert.ok(sheet.x>=16&&sheet.y>=25&&sheet.x+sheet.width<=width-16&&sheet.y+sheet.height<=height-16);
      assert.equal(await frame.evaluate(()=>document.elementFromPoint(innerWidth-40,innerHeight-110)?.closest('#gateway-chat-button')!==null),false);
      await page.screenshot({path:fileURLToPath(new URL(engine+'-'+repo+'-'+kind+'.png',output))});
      await frame.locator('.ig-x').click();assert.equal(await frame.locator('#gateway-chat-button').evaluate(e=>getComputedStyle(e).visibility),'visible');
     }
    }
    assert.deepEqual(errors,[]);results.push({repo,engine,installed,width,height,simulatedNativeInsets:installed,headerAndFooterVisible:true,modalOwnsLauncher:!installed});await context.close();
   }
  }finally{await browser.close();}
 }
}
await writeFile(new URL('report.json',output),JSON.stringify({results,physicalDeviceValidated:false,productionMutations:0},null,2));console.log(JSON.stringify({passed:results.length,physicalDeviceValidated:false,productionMutations:0}));
