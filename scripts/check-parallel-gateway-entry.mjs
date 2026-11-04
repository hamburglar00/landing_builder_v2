// All provider HTML and HTTP are isolated fixtures. Uses real shared renderers/clients.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {withTestBrowser} from '../../internal-chat/tests/helpers/browser-session.mjs';
const workspace=fileURLToPath(new URL('../../',import.meta.url));
const require=createRequire(new URL('../frontend/package.json',import.meta.url));
const {build}=require('esbuild');
const {chromium,webkit}=require(path.join(process.env.APPDATA,'npm/node_modules/playwright'));
const variants=[['landing-autologuin','Rey'],['ases-gateway','Ases'],['ganamos-gateway','Ganamos'],['multi-skin-gateway','MultiSkin','ganamos_plus'],['multi-skin-gateway','MultiSkin','bet30'],['multi-skin-gateway','MultiSkin','jugamos']];
const fixtures=[];
for(const[repo,kind,skin]of variants){
 const root=path.join(workspace,repo);
 const options=kind==='Rey'?`{gatewayClient:{appId:'reydeases_gateway',displayName:'Rey de Ases',chatEmbedUrl,initialChatOpen:true,initialChatAction:'wallet',streamingEntry:true}}`:
  `{appId:'fixture_gateway',displayName:provider.displayName,chatEmbedUrl,initialChatOpen:true,initialChatAction:'wallet',${kind==='Ases'?'':'streamingEntry:true,'}${kind==='MultiSkin'?"skin:provider,accessToken:'fixture-token',user:{username:'fixture'}":'provider'}}`;
 const contents=`import{renderGatewayEntryShell}from'./src/lib/gateway-entry-shell';import{rewrite${kind}Html}from'./src/lib/html-rewriter';${kind==='Rey'?'':`import{${kind==='MultiSkin'?'getSkinConfig':'getProviderConfig'}}from'./src/lib/skin-registry';`}
 export function html(){const chatEmbedUrl='https://chat.test/embed?token=fixture';${kind==='Rey'?"const provider={homePath:'/casino/list/home',backgroundColor:'#141414',displayName:'Rey de Ases'};":`const provider=${kind==='MultiSkin'?`getSkinConfig('${skin}')`:'getProviderConfig()'};`}
 const result=rewrite${kind}Html(renderGatewayEntryShell(provider.homePath,provider.backgroundColor,provider.displayName),${options});return typeof result==='string'?result:result.html;}`;
 const output=await build({absWorkingDir:root,tsconfig:path.join(root,'tsconfig.json'),stdin:{contents,resolveDir:root,loader:'ts'},bundle:true,write:false,format:'esm',platform:'node'});
 const {html}=await import('data:text/javascript;base64,'+Buffer.from(output.outputFiles[0].text).toString('base64'));
 fixtures.push({repo,skin,html:html(),js:await readFile(path.join(root,'public/gateway-client.js'),'utf8'),css:await readFile(path.join(root,'public/gateway-client.css'),'utf8')});
}
let scenarios=0;
for(const engine of [chromium,webkit])await withTestBrowser(engine,async browser=>{
 for(const fixture of fixtures){
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
  let release,blocked=new Promise(resolve=>release=resolve),casinoRequested=false,casinoDelivered=false;const errors=[],external=[],batches=[];
  try{
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   await context.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.origin==='https://chat.test')return route.fulfill({contentType:'text/html',body:`<!doctype html><input placeholder="Escribi un mensaje..."><script>parent.postMessage({source:'atrio-widget',type:'atrio.widget.ready',visibleEntry:true,presentation:{template:'atrio',primary:'#fff',primaryHover:'#eee',accent:'#ddd',background:'#111',surface:'#222',text:'#fff',buttonText:'#000',border:'#555'}},'https://gateway.test')</script>`});
    if(url.origin!=='https://gateway.test'){external.push(url.href);return route.abort();}
    if(url.pathname==='/api/entry-funnel'){
     if(route.request().method()==='POST'){batches.push(route.request().postDataJSON());return route.fulfill({status:204});}
     return route.fulfill({json:{landing_id:'11111111-1111-4111-8111-111111111111',flow_id:'22222222-2222-4222-8222-222222222222',template:7,telemetry_origin:'https://landing.panelbotadmin.com',started_at:Date.now()}});
    }
    if(url.pathname==='/entry')return route.fulfill({contentType:'text/html',body:fixture.html});
    if(url.pathname==='/gateway-client.js')return route.fulfill({contentType:'text/javascript',body:fixture.js});
    if(url.pathname==='/gateway-client.css')return route.fulfill({contentType:'text/css',body:fixture.css});
    if(/^\/(?:home|casino\/list\/home|jugadores\/home.php)$/.test(url.pathname)){
     casinoRequested=true;await blocked;casinoDelivered=true;
     return route.fulfill({contentType:'text/html',body:'<!doctype html><h1>Casino fixture</h1><script src="/gateway-client.js"></script>'});
    }
    if(url.pathname==='/auth/signIn')return route.fulfill({contentType:'text/html',body:'<!doctype html><h1>Acceso</h1>'});
    if(url.pathname.startsWith('/api/'))return route.fulfill({json:{messages:[],active:false}});
    return route.fulfill({status:204});
   });
   await page.goto('https://gateway.test/entry',{waitUntil:'domcontentloaded'});
   const chat=page.frameLocator('#gateway-chat-shell iframe');
   await chat.locator('input').fill('Chat usable antes del casino');
   await page.locator('#gateway-entry-transition[hidden]').waitFor({state:'attached'});
   assert.equal(casinoRequested,true);assert.equal(casinoDelivered,false,'casino response is still held while chat can be used');
   release();await page.frameLocator('#gateway-casino').locator('h1').waitFor();
   for(let attempts=0;attempts<50;attempts++){
    await page.evaluate(()=>window.__entryFunnel?.flush());
    if(batches.flatMap(batch=>batch.events).filter(e=>/^casino_/.test(e.phase||'')).length>=3)break;
    await page.waitForTimeout(50);
   }
   for(const phase of ['casino_ttfb','casino_download','casino_navigation'])assert.ok(batches.flatMap(batch=>batch.events).some(e=>e.phase===phase),'actual parent client emits '+phase);
   assert.equal(await page.frameLocator('#gateway-casino').locator('#gateway-chat-shell').count(),0,'no second chat mounts in casino document');
   await page.frameLocator('#gateway-casino').locator('h1').evaluate(()=>location.assign('/auth/signIn'));
   await page.waitForURL('https://gateway.test/auth/signIn');assert.equal(await page.locator('#gateway-chat-shell').count(),0);
   assert.deepEqual(errors,[]);assert.deepEqual(external,[]);scenarios++;
  }finally{release();await context.close();}
 }
});
console.log(`Parallel entry: ${scenarios} Chromium/WebKit scenarios passed for four gateways and three Multi Skin brands.`);
