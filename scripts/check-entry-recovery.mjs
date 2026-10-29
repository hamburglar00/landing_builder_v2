// Actual gateway HTML + classic/constructor inline recovery. Every request is intercepted.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const workspace=fileURLToPath(new URL('../../',import.meta.url));
const require=createRequire(new URL('../frontend/package.json',import.meta.url)),{build}=require('esbuild');
const {chromium,webkit}=require(path.join(process.env.APPDATA,'npm/node_modules/playwright'));
async function moduleAt(cwd,contents){
 const built=await build({absWorkingDir:cwd,stdin:{resolveDir:cwd,loader:'ts',contents},bundle:true,write:false,platform:'node',format:'cjs',minify:true,target:'es2017'});
 const module={exports:{}};new Function('module','exports',built.outputFiles[0].text)(module,module.exports);return module.exports;
}
const assets=[];
for(const repo of ['landing-autologuin','ases-gateway','ganamos-gateway','multi-skin-gateway']){
 const cwd=path.join(workspace,repo),module=await moduleAt(cwd,'export{renderPreparationPage}from"./src/lib/preparation-page";');
 const route=await readFile(path.join(cwd,'src/app/prepare/route.ts'),'utf8');
 const logo=route.match(/const LOGO\s*=\s*"([^"]+)"/)[1];
 const theme=new Function('LOGO','return ('+route.match(/renderPreparationPage\(token,\s*(\{[\s\S]*?\})\)\)/)[1]+')')(logo);
 assets.push({repo,html:module.renderPreparationPage('p1.fixture',theme)});
}
const builder=await moduleAt(path.join(workspace,'landing-builder/frontend'),'export{renderPublicLandingHtml,renderClassicTemplate7InlineHtml}from"./components/public-landing/renderPublicLandingHtml";');
const config={schemaVersion:1,updatedAt:'2026-10-27',id:'a0000000-0000-4000-8000-000000000001',name:'Fixture',comment:'',layout:{template:7,ctaPosition:'bottom'},tracking:{pixelId:'',postUrl:'/conversions',landingTag:'FIXTURE',target_provider:'ganamos_net'},content:{logoUrl:'',title:['Crear cuenta'],subtitle:['Ahora'],ctaText:'Continuar'},background:{mode:'single',images:[],rotateEveryHours:24}};
const engines=[builder.renderPublicLandingHtml({slug:'fixture',config}),builder.renderClassicTemplate7InlineHtml({slug:'fixture',config},'function getOrCreateDeviceId(){return "fixture";}')];
let checks=0;
for(const [engine,type] of [['Chromium',chromium],['WebKit',webkit]]){
 const browser=await type.launch({headless:true});
 try{
  for(const asset of assets)for(const scenario of ['transient','lost-response','truncated-json','permanent','outage']){
   const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[],requests=[];
   page.on('pageerror',e=>errors.push(e.message));
   // Accelerate recovery only; auto-redirect stays off for inspection.
   await page.addInitScript(()=>{const timer=window.setTimeout;window.setTimeout=function(fn,ms,...args){return timer(fn,[500,1500,3500].includes(ms)?1:ms,...args)};});
   await page.route('**/*',async route=>{
    const pathname=new URL(route.request().url()).pathname;
    if(pathname==='/api/preparations/complete'){
     requests.push(route.request().postData());
     if(scenario==='permanent')return route.fulfill({status:400,json:{error:'preparation_failed',retryable:false}});
     if(scenario==='lost-response'&&requests.length===1)return route.abort('failed');
     if(scenario==='truncated-json'&&requests.length===1)return route.fulfill({contentType:'application/json',body:'{"username":'});
     if(scenario==='outage'||(scenario==='transient'&&requests.length<3))return route.fulfill({status:503,json:{error:'service_unavailable'}});
     return route.fulfill({json:{username:'fixtureplayer',continuation_token:'c1.fixture',handoff_url:'https://fixture.test/start?t=fixture'}});
    }
    if(pathname==='/start')return route.fulfill({json:{username:'fixtureplayer',password:'fixture-password',redirect_url:'https://fixture.test/home',entry_wait:{enabled:true,seconds:60}}});
    if(pathname==='/api/session/recover')return route.fulfill({json:{active:true}});
    if(pathname==='/prepare')return route.fulfill({contentType:'text/html',body:asset.html});
    return route.fulfill({body:''});
   });
   await page.goto('https://fixture.test/prepare');
   if(['outage','permanent'].includes(scenario)){
    await page.locator('main[data-view="error"]').waitFor();
    assert.equal(requests.length,scenario==='outage'?4:1);
    assert.equal(await page.locator('#username').innerText(),'');
   }else{
    await page.locator('#password').filter({hasText:'fixture-password'}).waitFor();
    assert.equal(requests.length,scenario==='transient'?3:2);
   }
   assert.equal(new Set(requests).size,1,'Same preparation token throughout recovery');
   assert.deepEqual(errors,[]);checks++;await page.close();
  }
  for(const html of engines)for(const scenario of ['http','truncated','body-error','body-timeout']){
   const page=await browser.newPage();
   // Execute the actual compiled inline declaration, including minification, without external analytics.
   const ts=require('typescript');let source;
   for(const script of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)){
    const file=ts.createSourceFile('runtime.js',script[1],ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
    const visit=node=>{if(ts.isVariableDeclaration(node)&&node.name.getText(file)==='fetchWithEntryRecovery')source=node.initializer.getText(file);ts.forEachChild(node,visit)};
    visit(file);
   }
   assert.ok(source,'Both engines embed the shared closure-free recovery function');
   const result=await page.evaluate(async ({source,scenario})=>{
    let count=0;const bodies=[];
    window.fetch=async(_url,init)=>{
     bodies.push(init.body);count++;
     if(count>=3)return new Response('{}');
     if(scenario==='http')return new Response('{}',{status:503});
     if(scenario==='truncated')return new Response('{"username":');
     return new Response(new ReadableStream({start(controller){
      controller.enqueue(new TextEncoder().encode('{"username":'));
      if(scenario==='body-error')controller.error(new TypeError('response lost'));
      else init.signal.addEventListener('abort',()=>controller.error(new DOMException('timeout','AbortError')),{once:true});
     }}));
    };
    const timer=window.setTimeout;window.setTimeout=(fn,ms)=>timer(fn,ms===45000?25:0);
    const request=eval('('+source+')');const response=await request('/entry',{method:'POST',body:'same-identity'});
    return {count,status:response.status,bodies,body:await response.json()};
   },{source,scenario});
   assert.deepEqual(result,{count:3,status:200,bodies:['same-identity','same-identity','same-identity'],body:{}});checks++;await page.close();
  }
  for (const asset of assets) {
   const page=await browser.newPage({viewport:{width:390,height:844}}),requests=[],errors=[];
   let held, starts=0;
   page.on('pageerror',error=>errors.push(error.message));
   await page.clock.install();
   await page.route('**/*',async route=>{
    const pathname=new URL(route.request().url()).pathname;
    if(pathname==='/api/preparations/complete'){
     requests.push(route.request().postData());
     return route.fulfill({json:{username:'fixtureplayer',continuation_token:'c1.fixture',handoff_url:'https://fixture.test/start?t=fixture'}});
    }
    if(pathname==='/start'){
     starts++;if(starts===1){held=route;return;}
     return route.fulfill({json:{username:'fixtureplayer',password:'fixture-password',redirect_url:'https://fixture.test/home',entry_wait:{enabled:true,seconds:60}}});
    }
    if(pathname==='/api/session/recover')return route.fulfill({json:{active:true}});
    if(pathname==='/prepare')return route.fulfill({contentType:'text/html',body:asset.html});
    return route.fulfill({body:''});
   });
   await page.goto('https://fixture.test/prepare');
   await page.locator('#username').filter({hasText:'fixtureplayer'}).waitFor();
   await page.clock.fastForward(45001);
   await page.locator('main[data-view="error"]').waitFor();
   assert.match(await page.locator('section.error').innerText(),/Tu acceso sigue pendiente/);
   assert.ok(held,'Actual login request was held');
   await held.fulfill({json:{username:'fixtureplayer',password:'fixture-password',redirect_url:'https://fixture.test/home',entry_wait:{enabled:false,seconds:4}}}).catch(()=>{});
   await page.waitForTimeout(1);
   assert.equal(new URL(page.url()).pathname,'/prepare','Late login must not navigate');
   await page.locator('#retry').click();
   await page.locator('#password').filter({hasText:'fixture-password'}).waitFor();
   assert.equal(requests.length,2);assert.equal(new Set(requests).size,1);
   assert.deepEqual(errors,[]);checks++;await page.close();
  }
  console.log(engine+': gateway recovery, bounded waits and both compiled landing engines passed');
 }finally{await browser.close();}
}
console.log('PASS '+checks+' browser scenarios; zero external business requests.');
