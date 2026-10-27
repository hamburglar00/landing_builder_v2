// Real renderers/components with isolated browser responses. No real accounts or writes.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const workspace=fileURLToPath(new URL("../../",import.meta.url)), atrio=path.join(workspace,"internal-chat");
const require=createRequire(new URL("../frontend/package.json",import.meta.url)), {build}=require("esbuild");
const appRequire=createRequire(path.join(atrio,"package.json"));
const {chromium,webkit}=require(path.join(process.env.APPDATA,"npm/node_modules/playwright"));
const output=fileURLToPath(new URL("../.vercel/validation-entry-presentation-20261027/",import.meta.url));
await mkdir(output,{recursive:true});
const cssPath=path.join(atrio,"src/app/globals.css");
const css=(await appRequire("postcss")([appRequire("@tailwindcss/postcss")({base:atrio})]).process(await readFile(cssPath,"utf8"),{from:cssPath})).css;
const component=await build({absWorkingDir:atrio,stdin:{resolveDir:atrio,loader:"tsx",contents:`import React,{useState}from"react";import{createRoot}from"react-dom/client";import{ClientProfileModal}from"./src/components/client-chat-shell";import{widgetThemeCssVariables}from"./src/lib/widget-theme";
const colors={primary:"#9637c4",primaryHover:"#a748d5",accent:"#e8b6ff",background:"#11001f",surface:"#270538",surfaceAlt:"#31074d",bubble:"#270538",avatar:"#31074d",text:"#ffffff",mutedText:"#d0b4db",border:"#9637c4",success:"#4ade80",danger:"#ef4444"};
function App(){const[draft,setDraft]=useState({displayName:"Prueba",whatsapp:"",email:""});return <main style={{...widgetThemeCssVariables(window.template,{code:"fixture",colors}),position:"relative",width:"100%",height:"100dvh"}}><ClientProfileModal gatewayOrigin="https://fixture.test" conversationId="00000000-0000-4000-8000-000000000001" draft={draft} onChange={(field,value)=>setDraft({...draft,[field]:value})} onSave={()=>{}} onClose={()=>{}} error={null} isLoading={false} isSaving={false} status="idle"/></main>};createRoot(document.getElementById("root")).render(<App/>);`},bundle:true,write:false,platform:"browser",format:"iife",jsx:"automatic",define:{"process.env":"{}","process.env.NODE_ENV":'"production"'},plugins:[{name:"fixture-ui",setup(b){
 b.onLoad({filter:/client-chat-shell\.tsx$/},async args=>({contents:(await readFile(args.path,"utf8"))+"\nexport {ClientProfileModal};",loader:"tsx"}));
 b.onResolve({filter:/^@\/lib\/client-gateway-credentials$/},()=>({path:"credentials",namespace:"fixture"}));
 b.onLoad({filter:/.*/,namespace:"fixture"},()=>({contents:'export async function requestClientGatewayCredentials(){return{username:"fixtureplayer",password:"fixture-password"}}'}));
}}]});
const configs=[["landing-autologuin","rey_de_ases","#141414"],["ases-gateway","ases_del_norte","#071b2c"],["ganamos-gateway","ganamos_net","#11001f"],["multi-skin-gateway","multi_skin","#121212"]];
const rgb=hex=>"rgb("+[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)).join(", ")+")";
const assets=await Promise.all(configs.map(async([repo,provider,palette])=>{
 const cwd=path.join(workspace,repo), result=await build({absWorkingDir:cwd,stdin:{resolveDir:cwd,loader:"ts",contents:'export{renderPreparationPage}from"./src/lib/preparation-page";export{renderGatewayEntryTransition,GATEWAY_ENTRY_TRANSITION_RUNTIME}from"./src/lib/gateway-entry-transition";'},bundle:true,write:false,platform:"node",format:"cjs"});
 const module={exports:{}};new Function("module","exports",result.outputFiles[0].text)(module,module.exports);
 const route=await readFile(path.join(cwd,"src/app/prepare/route.ts"),"utf8"),logo=route.match(/const LOGO\s*=\s*"([^"]+)"/)[1];
 const theme=new Function("LOGO","return ("+route.match(/renderPreparationPage\(token,\s*(\{[\s\S]*?\})\)\)/)[1]+")")(logo);
 return {repo,provider,palette,cwd,theme,...module.exports};
}));
const checks=[];
for(const[engine,type]of[["Chromium",chromium],["WebKit",webkit]]){
 const browser=await type.launch({headless:true});
 try{
  for(const viewport of[{width:320,height:568},{width:390,height:844},{width:844,height:390},{width:1366,height:768}]){
   for(const template of["atrio","whatsapp","page"]){
    const page=await browser.newPage({viewport});page.on("pageerror",error=>console.error("Profile fixture:",error.message));
    await page.route("**/*",route=>route.fulfill({contentType:"text/html",body:`<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script>window.template=${JSON.stringify(template)}</script><script>${component.outputFiles[0].text.replaceAll("</script","<\\/script")}</script></body></html>`}));
    await page.goto("https://fixture.test/profile");
    const dialog=page.getByRole("dialog",{name:"Mi perfil"});await page.getByLabel("Clave",{exact:true}).waitFor();
    assert.equal(await dialog.evaluate(el=>getComputedStyle(el).backgroundColor),rgb(template==="whatsapp"?"#ffffff":template==="page"?"#270538":"#1a1a1f"));
    assert.equal(await page.getByLabel("Usuario",{exact:true}).evaluate(el=>getComputedStyle(el).color),rgb(template==="whatsapp"?"#111b21":"#ffffff"));
    assert.equal(await page.getByLabel("Tu cuenta",{exact:true}).count(),1);
    const phone=page.getByPlaceholder("Tu teléfono",{exact:true});
    assert.equal(await phone.inputValue(),"");
    if(viewport.width<640){
      assert.ok(await phone.evaluate(el=>parseFloat(getComputedStyle(el).fontSize))>=16,"No iOS input zoom");
      await phone.focus();
      await page.setViewportSize({width:viewport.width,height:330});
      await page.waitForTimeout(180);
      const field=await phone.boundingBox(),modal=await dialog.boundingBox();
      assert.ok(field.y>=modal.y && field.y+field.height<=modal.y+modal.height,"Focused phone remains in the resized modal");
      await page.setViewportSize(viewport);
    }
    assert.equal(await dialog.evaluate(el=>el.scrollWidth>el.clientWidth),false,"Profile fields must fit inside the modal");
    await page.getByRole("button",{name:"Mostrar clave"}).click();assert.equal(await page.getByLabel("Clave",{exact:true}).inputValue(),"fixture-password");
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.getByRole("button",{name:"Guardar perfil"}).scrollIntoViewIfNeeded();
    if(viewport.width===390)await page.screenshot({path:path.join(output,`${engine}-profile-${template}.png`)});
    checks.push({engine,viewport,template,profilePalette:true});await page.close();
   }
   for(const asset of assets){
    const page=await browser.newPage({viewport});
    const errors=[];page.on("pageerror",error=>errors.push(String(error)));
    await page.addInitScript(()=>Object.defineProperty(navigator,"clipboard",{value:{writeText:async value=>{window.copied=value}}}));
    await page.route("https://fixture.test/**",async route=>{
     const pathname=new URL(route.request().url()).pathname;
     if(pathname==="/api/preparations/complete")return route.fulfill({json:{username:"fixtureplayer",continuation_token:"c1.fixture",handoff_url:"https://fixture.test/start?t=fixture"}});
     if(pathname==="/start")return route.fulfill({json:{username:"fixtureplayer",password:"fixture-password",redirect_url:"https://fixture.test/home",entry_wait:{enabled:true,seconds:60}}});
     if(pathname==="/api/session/credentials")throw Error("Entry must reuse /start credentials");
     if(pathname==="/api/session/recover")return route.fulfill({json:{active:true}});
     if(pathname.endsWith(".avif")||pathname.endsWith(".webp"))return route.fulfill({body:await readFile(path.join(asset.cwd,"public",pathname)),contentType:pathname.endsWith(".avif")?"image/avif":"image/webp"});
     if(pathname==="/overlay")return route.fulfill({contentType:"text/html",body:`<html><head><meta name="theme-color" content="#000000"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>html,body{background:#000}</style></head><body>${asset.renderGatewayEntryTransition(asset.provider,{active:true,stage:"creating"})}<script>${asset.GATEWAY_ENTRY_TRANSITION_RUNTIME};window.transition=createGatewayEntryTransition(document.getElementById("gateway-entry-transition"));transition.start("creating");</script></body></html>`});
     return route.fulfill({contentType:"text/html",body:asset.renderPreparationPage("p1.fixture",asset.theme)});
    });
    await page.goto("https://fixture.test/prepare");await page.locator("#password").filter({hasText:"fixture-password"}).waitFor();
    await page.getByRole("button",{name:"Copiar clave",exact:true}).click();assert.equal(await page.evaluate(()=>window.copied),"fixture-password");
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.equal(await page.locator("#status").innerText(),"");
    assert.equal(await page.locator("html").evaluate(el=>getComputedStyle(el).backgroundColor),rgb(asset.palette));
    if(viewport.width===390)await page.screenshot({path:path.join(output,`${engine}-${asset.provider}-account.png`),fullPage:true});
    await page.goto("https://fixture.test/overlay");
    for(const selector of["html","body","#gateway-entry-transition"])assert.equal(await page.locator(selector).evaluate(el=>getComputedStyle(el).backgroundColor),rgb(asset.palette));
    assert.equal(await page.locator('meta[name="theme-color"]').getAttribute("content"),asset.palette);
    if(viewport.width===390)await page.screenshot({path:path.join(output,`${engine}-${asset.provider}-creating.png`)});
    await page.evaluate(()=>window.transition.finish());assert.equal(await page.locator('meta[name="theme-color"]').getAttribute("content"),"#000000");
    assert.deepEqual(errors,[]);checks.push({engine,viewport,provider:asset.provider,accountPassword:true,transitionPalette:true});await page.close();
   }
  }
 }finally{await browser.close();}
 console.log(JSON.stringify({engine,passed:checks.filter(check=>check.engine===engine).length}));
}
await writeFile(path.join(output,"report.json"),JSON.stringify({fixtureOnly:true,productionWrites:0,nativeBrowserBarsVerified:false,checks},null,2));
console.log(JSON.stringify({passed:checks.length,productionWrites:0}));
