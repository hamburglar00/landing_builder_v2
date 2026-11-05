// Real shared HTML/CSS with isolated HTTP: never creates accounts or sessions.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {withTestBrowser} from '../../internal-chat/tests/helpers/browser-session.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const require=createRequire(new URL('../frontend/package.json',import.meta.url));
const {build}=require('esbuild');
let playwright;try{playwright=require(path.join(process.env.APPDATA,'npm/node_modules/playwright'));}catch{playwright=require('playwright');}
const compiled=await build({absWorkingDir:path.join(root,'landing-autologuin'),stdin:{contents:'export {gatewayLoginPage} from "./src/lib/gateway-login-page";export {gatewayAgencyPage} from "./src/lib/gateway-agency-page";',resolveDir:path.join(root,'landing-autologuin'),loader:'ts'},bundle:true,write:false,platform:'node',format:'esm',target:'es2022',plugins:[{name:'response-only',setup(b){b.onResolve({filter:/^next\/server$/},()=>({path:'fixture',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const NextResponse=Response;',loader:'js'}));}}]});
const {gatewayLoginPage,gatewayAgencyPage}=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const output=path.join(root,'landing-builder/.vercel/gateway-auth-fit-20261105');await mkdir(output,{recursive:true});
const providers={rey_de_ases:'landing-autologuin',ases_del_norte:'ases-gateway',ganamos_net:'ganamos-gateway',multi_skin:'multi-skin-gateway'};
const viewports=[[320,480],[320,568],[390,664],[430,932],[568,320],[667,375],[844,390],[1024,600],[1365,635],[1920,1080]];
const report=[];
for(const [engine,launcher] of [['chromium',playwright.chromium],['webkit',playwright.webkit]])await withTestBrowser(launcher,async browser=>{
 for(const [provider,repo] of Object.entries(providers))for(const [width,height] of viewports){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url());assert.equal(url.origin,'https://gateway.test');
   if(url.pathname==='/login'||url.pathname==='/17')return route.fulfill({contentType:'text/html',body:await (url.pathname==='/login'?gatewayLoginPage(provider):gatewayAgencyPage(provider,17)).text()});
   if(url.pathname==='/api/session/recover')return route.fulfill({json:{active:false}});
   if(['/api/session/login','/api/agency-entry'].includes(url.pathname))return route.fulfill({status:401,json:{error:'No pudimos ingresar. Revisá tu usuario y contraseña e intentá nuevamente.'}});
   assert.match(url.pathname,/\.webp$/);
   return route.fulfill({contentType:'image/webp',body:await readFile(path.join(root,repo,'public',url.pathname))});
  });
  async function fit(state){
   const dimensions=await page.evaluate(()=>{const r=document.querySelector('.auth-card').getBoundingClientRect(),d=document.documentElement;return {width:innerWidth,height:innerHeight,scrollWidth:d.scrollWidth,scrollHeight:d.scrollHeight,top:r.top,bottom:r.bottom,left:r.left,right:r.right,scrollY};});
   const label=`${engine} ${provider} ${width}x${height} ${state}: ${JSON.stringify(dimensions)}`;
   assert.ok(dimensions.scrollWidth<=width,label);assert.ok(dimensions.scrollHeight<=height+1,label);
   assert.ok(dimensions.top>=7&&dimensions.bottom<=height-7,label);assert.ok(dimensions.left>=11&&dimensions.right<=width-11,label);
   assert.equal(dimensions.scrollY,0,label);
   for(const button of await page.locator('#login-submit,#submit,#toggle').all())assert.equal(await button.evaluate(el=>getComputedStyle(el).textTransform),'uppercase');
   assert.ok(await page.locator('img').evaluate(img=>img.complete&&img.naturalWidth>0));
   report.push({engine,provider,width,height,state,passed:true});
  }
  try{
   for(const mode of ['login','17']){
    await page.goto('https://gateway.test/'+mode);await page.locator('#username').waitFor({state:'visible'});
    assert.equal(await page.locator('.intro').textContent(),'Tu plataforma y tu asesor, en el mismo lugar.');
    await fit(mode);
    if(mode==='login'&&engine==='chromium'&&((width===390&&height===664)||(width===1365&&height===635)||(provider==='ganamos_net'&&width===568)))await page.screenshot({path:path.join(output,`${provider}-${width}x${height}.png`)});
    await page.locator('#username').fill('cliente');await page.locator('#password').fill('synthetic-password');
    await page.locator('#show-password').click();assert.equal(await page.locator('#password').getAttribute('type'),'text');
    await page.locator(mode==='login'?'#login-submit':'#submit').click();await page.locator('[role=alert]').filter({hasText:'No pudimos ingresar.'}).waitFor();
    await fit(mode+' error');
    if(mode==='17'){
     await page.locator('#toggle').click();await page.locator('#name').waitFor({state:'visible'});await fit('register');
     await page.locator('#name').fill('Cliente');await page.locator('#submit').click();await page.locator('#error').filter({hasText:'No pudimos ingresar.'}).waitFor();await fit('register error');
    }
   }
   assert.deepEqual(errors,[]);
  }finally{await context.close();}
 }
});
await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.length,engines:2,providers:4,viewports:viewports.length,verticalOverflow:false,horizontalOverflow:false,isolatedHttp:true}));
