// Local fixture E2E: actual chat/settings, gateway bridge, credential handler and Atrio POST.
// Postgres is an explicitly named disposable test container, never production.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
const workspace = fileURLToPath(new URL("../../", import.meta.url)), atrio = path.join(workspace, "internal-chat");
const require = createRequire(new URL("../frontend/package.json", import.meta.url));
const { build } = require("esbuild");
const appRequire = createRequire(path.join(atrio,"package.json"));
const postcss=appRequire("postcss"),tailwind=appRequire("@tailwindcss/postcss");
const browsers = require(process.env.PLAYWRIGHT_MODULE_PATH || path.join(process.env.APPDATA, "npm/node_modules/playwright"));
const container = process.env.ATRIO_CREDENTIALS_TEST_CONTAINER;
assert.match(container ?? "", /^atrio-credentials-validation-[a-z0-9-]+$/);
const sql = input => execFileSync("docker", ["exec", "-i", container, "psql", "-U", "postgres", "-At", "-v", "ON_ERROR_STOP=1"], { input, encoding: "utf8", windowsHide: true }).trim();
const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const advisor=id(1), player=id(3), account=id(6), conversation=id(8), bot=id(4);
const secret = "fixture-gateway-secret-32-characters-long"; process.env.INTERNAL_CHAT_GATEWAY_SECRET = secret;
const artifact = fileURLToPath(new URL("../.vercel/validation-client-credentials/", import.meta.url)); await mkdir(artifact,{recursive:true});
async function server(root, contents, plugins = []) {
  const result = await build({ absWorkingDir:root, tsconfig:path.join(root,"tsconfig.json"), stdin:{resolveDir:root,loader:"ts",contents},bundle:true,write:false,platform:"node",format:"cjs",packages:"external",plugins });
  const module={exports:{}};new Function("module","exports","require",result.outputFiles[0].text)(module,module.exports,createRequire(path.join(root,"package.json")));return module.exports;
}
const api=await server(atrio,'export{POST}from"./src/app/api/gateway/chat/route";export{createGatewayChatSessionToken}from"./src/lib/gateway-contract";', [{name:"private-fixture-db",setup(b){
  b.onResolve({filter:/^@\/lib\/supabase\/(admin|server)$/},()=>({path:"db",namespace:"fixture"}));
  b.onLoad({filter:/.*/,namespace:"fixture"},()=>({contents:'export function createAdminSupabaseClient(){return globalThis.__credentialsDb}export function createServerSupabaseClient(){return globalThis.__credentialsDb}'}));
  b.onResolve({filter:/^server-only$/},()=>({path:"empty",namespace:"empty"}));b.onLoad({filter:/.*/,namespace:"empty"},()=>({contents:""}));
}}]);
let provider="ganamos_net", mode="credentials", managerType="mkt", rejectSave=false, profileFails=0, rpcCalls=0;
globalThis.__credentialActor={isAuthenticated:true,userId:advisor,profile:{id:advisor,role:"advisor"}};
const actions=await server(atrio,'export{saveManualClientChipAction}from"./src/app/dashboard/manager-connection-actions";', [{name:"settings-fixtures",setup(b){
  b.onResolve({filter:/^@\/lib\/supabase\/admin$/},()=>({path:"db",namespace:"fixture"}));
  b.onResolve({filter:/^@\/lib\/auth$/},()=>({path:"auth",namespace:"fixture"}));
  b.onLoad({filter:/.*/,namespace:"fixture"},args=>({contents:args.path==="auth"?'export async function getCurrentSession(){return globalThis.__credentialActor}':'export function createAdminSupabaseClient(){return globalThis.__credentialsDb}'}));
  b.onResolve({filter:/^server-only$/},()=>({path:"empty",namespace:"empty"}));b.onLoad({filter:/.*/,namespace:"empty"},()=>({contents:""}));
}}]);
globalThis.__credentialsDb={from(table){
  const rows={profiles:[{id:advisor,slug:"fixture",role:"advisor",status:"disponible"}],players:[{id:player,advisor_id:advisor,device_id:id(20),tags:[]}],conversations:[{id:conversation,advisor_id:advisor,player_id:player,player_provider_account_id:account}],player_provider_accounts:[{id:account,player_id:player,target_provider:provider}]};
  let selected=rows[table]??(table==="advisor_manager_connections"?JSON.parse(sql("select json_agg(c)::text from advisor_manager_connections c;")):null),patch;
  if(!selected)throw Error("Unexpected fixture table: "+table);
  const q={select(){return q},update(value){patch=value;return q},eq(key,value){selected=selected.filter(row=>row[key]===value);return q},async maybeSingle(){
    if(patch&&selected[0]){if(rejectSave)throw Error("Fixture save failure");sql(`update advisor_manager_connections set manual_client_chip=${quote(patch.manual_client_chip)} where id=${quote(selected[0].id)};`);mode=patch.manual_client_chip;}
    return{data:selected[0]??null,error:null};
  }};return q;
},async rpc(name,p){assert.equal(name,"send_gateway_client_credentials");rpcCalls++;
  const args=[p.p_advisor_id,p.p_player_id,p.p_account_id,p.p_conversation_id,p.p_request_id,p.p_username,p.p_password].map(quote).join(",");
  return{data:JSON.parse(sql(`select coalesce(public.send_gateway_client_credentials(${args}),'null'::jsonb)::text;`)),error:null};
}};
const anon='export function createAnonSupabaseClient(){const channel={on(){return channel},subscribe(){return channel}};return{channel(){return channel},removeChannel(){return Promise.resolve()},rpc(){return Promise.resolve({data:null,error:null})}}}';
const ui=await build({absWorkingDir:atrio,tsconfig:path.join(atrio,"tsconfig.json"),stdin:{resolveDir:atrio,loader:"tsx",contents:'import React,{useState}from"react";import{createRoot}from"react-dom/client";import{ClientChatShell}from"./src/components/client-chat-shell";import{ManualClientChipSettings}from"./src/components/manual-client-chip-settings";function Settings(){const[c,set]=useState(window.fixtureConnection);return <ManualClientChipSettings connection={c} onSaved={chip=>set({...c,manual_client_chip:chip})}/>};createRoot(document.getElementById("root")).render(window.fixtureProps?<ClientChatShell {...window.fixtureProps}/>:<Settings/>);'},bundle:true,write:false,platform:"browser",format:"iife",jsx:"automatic",define:{"process.env.NODE_ENV":'"production"',"process.env.NEXT_PUBLIC_SUPABASE_URL":'"https://db.fixture.test"',"process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY":'"fixture"'},plugins:[{name:"ui-fixtures",setup(b){
  b.onResolve({filter:/^@\/lib\/supabase\/anon$/},()=>({path:"anon",namespace:"fixture"}));
  b.onResolve({filter:/^@\/app\/dashboard\/manager-connection-actions$/},()=>({path:"actions",namespace:"fixture"}));
  b.onLoad({filter:/.*/,namespace:"fixture"},args=>({contents:args.path==="anon"?anon:'export async function saveManualClientChipAction(id,chip){return fetch("/fixture-preference",{method:"POST",body:JSON.stringify({id,chip})}).then(r=>r.json())}'}));
}}]});
const cssPath=path.join(atrio,"src/app/globals.css"),css=(await postcss([tailwind({base:atrio})]).process(await readFile(cssPath,"utf8"),{from:cssPath})).css;
assert.ok(css.includes(".whitespace-pre-line"),"Compile Atrio utilities from the app directory");
const html=(script,extra="")=>`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}html,body,#root{height:100%;margin:0}body{background:#141414;color:white}</style></head><body><div id="root"></div><script>${script}</script>${extra}<script>${ui.outputFiles[0].text.replaceAll("</script","<\\/script")}</script></body></html>`;
const configs=[["landing-autologuin","rey_de_ases","reydeases-gateway","#141414"],["ases-gateway","ases_del_norte","ases-del-norte-gateway","#071b2c"],["ganamos-gateway","ganamos_net","ganamos-net-gateway","#11001f"],["multi-skin-gateway","multi_skin","multi-skin-gateway","#121212"]];
const shared=await server(path.join(workspace,configs[0][0]),'export{clientCredentialsResponse}from"./src/lib/client-credentials";export{applyGatewayBrowserAppearance}from"./src/lib/gateway-browser-appearance";');
const securityToken=api.createGatewayChatSessionToken({appId:"fixture_gateway",advisorSlug:"fixture",playerId:player,conversationId:conversation,playerProviderAccountId:account,targetProvider:provider});
for(const patch of[{accountId:id(7)},{playerId:id(99)},{advisorSlug:"other"},{targetProvider:"rey_de_ases"},{conversationId:id(9)},{requestId:id(99)}]){
  const proofConversation=patch.conversationId??conversation,proofRequest=patch.requestId??id(40);
  const own={advisorSlug:"fixture",playerId:player,accountId:account,targetProvider:provider,username:"fixtureplayer",password:"fixture-password",...patch};
  const proofResponse=await shared.clientCredentialsResponse(new Request("https://fixture.test/api/session/credentials",{method:"POST",headers:{origin:"https://fixture.test","content-type":"application/json"},body:JSON.stringify({purpose:"chat",conversationId:proofConversation,requestId:proofRequest})}),async()=>own,secret);
  const {proof}=await proofResponse.json();
  const response=await api.POST(new Request("https://chat.test/api/gateway/chat",{method:"POST",headers:{authorization:"Bearer "+securityToken,"content-type":"application/json"},body:JSON.stringify({action:"credentials",proof,requestId:id(40)})}));
  assert.equal(response.status,403,"Reject proof from a different account, player, advisor, provider, conversation or request");
}
assert.equal(rpcCalls,0,"Unauthorized proofs never reach the insert RPC");
const chips=await server(atrio,'export{withManualClientChip}from"./src/lib/manual-client-chip";');
const baseStarters=[{id:id(30),label:"Cargar",message:"",behavior:"wallet",sortOrder:0,hasOptions:false},{id:id(31),label:"Retirar",message:"Quiero retirar",behavior:"message",sortOrder:1,hasOptions:false},{id:id(32),label:"Soporte",message:"Necesito ayuda",behavior:"message",sortOrder:2,hasOptions:false}];
const checks=[];
for(const [engine,type]of[["Chromium",browsers.chromium],["WebKit",browsers.webkit]]){
 const filter=process.argv.find(arg=>arg.startsWith("--engine="))?.slice(9);if(filter&&filter!==engine)continue;
 const browser=await type.launch({headless:true});
 try{
  const settings=await browser.newPage({viewport:{width:390,height:844}}),settingRequests=[];
  await settings.route("https://fixture.test/**",async route=>{
    if(new URL(route.request().url()).pathname==="/fixture-preference"){
      const body=JSON.parse(route.request().postData());const result=await actions.saveManualClientChipAction(body.id,body.chip);settingRequests.push({body,result});return route.fulfill({json:result});
    }
    return route.fulfill({contentType:"text/html",body:html("window.fixtureConnection="+JSON.stringify({id:bot,advisor_id:advisor,manager_id:1041,manager_type:"mkt",manual_client_chip:mode}))});
  });
  await settings.goto("https://fixture.test/settings");const select=settings.getByRole("button",{name:"Chip del bot 1041",exact:true});
  await select.click();await settings.getByRole("option",{name:"Soporte",exact:true}).click();
  try{await settings.getByText("Chip guardado.",{exact:true}).waitFor({timeout:10000});}catch(e){await settings.screenshot({path:path.join(artifact,"settings-error.png")});console.log(JSON.stringify({engine,settingRequests,body:await settings.locator("body").innerText()}));throw e;}
  assert.equal(sql(`select manual_client_chip from advisor_manager_connections where id='${bot}'`),"support");
  rejectSave=true;await select.click();await settings.getByRole("option",{name:"Usuario",exact:true}).click();await settings.getByText(/No pudimos guardar/).waitFor();
  assert.equal(sql(`select manual_client_chip from advisor_manager_connections where id='${bot}'`),"support");rejectSave=false;
  await select.focus();await settings.keyboard.press("ArrowDown");await settings.keyboard.press("Home");await settings.keyboard.press("Enter");
  await settings.getByText("Chip guardado.",{exact:true}).waitFor();assert.equal(sql(`select manual_client_chip from advisor_manager_connections where id='${bot}'`),"credentials");
  await select.click();await settings.keyboard.press("Escape");await settings.getByRole("listbox").waitFor({state:"detached",timeout:2000});
  await select.click();await settings.getByText("Acceso rápido del cliente",{exact:true}).click();await settings.getByRole("listbox").waitFor({state:"detached",timeout:2000});
  assert.equal((await actions.saveManualClientChipAction(id(5),"credentials")).ok,false);
  globalThis.__credentialActor={isAuthenticated:false};assert.equal((await actions.saveManualClientChipAction(bot,"credentials")).ok,false);
  globalThis.__credentialActor={isAuthenticated:true,userId:advisor,profile:{id:advisor,role:"advisor"}};
  assert.equal((await actions.saveManualClientChipAction(id(99),"credentials")).ok,false);
  await settings.close();checks.push({engine,settingsPersisted:true,failedSavePreservesChoice:true,fullCargaRejected:true,otherBotRejected:true,unauthenticatedRejected:true});
  for(const[repo,target,source,palette]of configs){provider=target;
   const gatewayJs=await readFile(path.join(workspace,repo,"public/gateway-client.js"),"utf8"),gatewayCss=await readFile(path.join(workspace,repo,"public/gateway-client.css"),"utf8");
   for(const template of["atrio","whatsapp","page"]){mode="credentials";managerType="mkt";sql(`delete from messages;update advisor_manager_connections set target_provider=${quote(provider)},manual_client_chip='credentials' where id='${bot}';update player_provider_accounts set target_provider=${quote(provider)} where id='${account}';`);
    const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[],requests=[];page.on("pageerror",e=>errors.push(String(e)));
    await page.addInitScript(()=>Object.defineProperty(navigator,"clipboard",{value:{writeText:async value=>{window.fixtureClipboard=value}}}));
    const token=api.createGatewayChatSessionToken({appId:"fixture_gateway",advisorSlug:"fixture",playerId:player,conversationId:conversation,playerProviderAccountId:account,targetProvider:provider});
    const props=()=>({advisorSlug:"fixture",deviceId:id(20),embedded:true,embeddedParentOrigin:"https://fixture.test",embeddedGatewaySource:source,embeddedHasActiveWallet:false,conversationSessionToken:token,widgetTemplate:template,initialMessages:[],quickStarters:chips.withManualClientChip(baseStarters,{active:true,manager_type:managerType,manual_client_chip:mode}),session:{advisor_id:advisor,advisor_name:"Fixture",advisor_avatar_url:null,advisor_status:"disponible",player_id:player,conversation_id:conversation,player_display_name:"Fixture",player_platform:"ios",app_installed_status:"unknown",whatsapp_url:null,telegram_url:null}});
    await page.route("**/*",async route=>{
      const req=route.request(),url=new URL(req.url());
      if(url.origin==="https://fixture.test"){
        if(url.pathname==="/gateway-client.js")return route.fulfill({contentType:"application/javascript",body:gatewayJs});
        if(url.pathname==="/api/session/credentials"){
          requests.push({purpose:JSON.parse(req.postData()).purpose});
          const r=await shared.clientCredentialsResponse(new Request(req.url(),{method:"POST",headers:{origin:"https://fixture.test","content-type":"application/json"},body:req.postData()}),async()=>{if(profileFails){profileFails--;return null}return{advisorSlug:"fixture",playerId:player,accountId:account,targetProvider:provider,username:"fixtureplayer",password:"fixture-password"}},secret);
          requests.at(-1).status=r.status;
          return route.fulfill({status:r.status,headers:Object.fromEntries(r.headers),body:await r.text()});
        }
        if(url.pathname.startsWith("/api/"))return route.fulfill({json:{ok:true}});
        if(url.pathname!=="/")return route.fulfill({status:204});
        return route.fulfill({contentType:"text/html",body:shared.applyGatewayBrowserAppearance(`<html><head><style>${gatewayCss}</style></head><body><main style="padding:30px">Casino fixture</main><script src="/gateway-client.js" data-chat-url="https://chat.test/embed"></script></body></html>`,palette)});
      }
      if(url.pathname==="/api/gateway/chat"&&req.method()==="POST"){
        if(req.postDataJSON()?.action!=="credentials")return route.fulfill({json:{ok:true}});
        const response=await api.POST(new Request(req.url(),{method:"POST",headers:req.headers(),body:req.postData()}));
        return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});
      }
      if(url.pathname==="/api/gateway/chat")return route.fulfill({json:{messages:JSON.parse(sql(`select coalesce(json_agg(m),'[]')::text from messages m;`))}});
      if(url.pathname==="/api/client/profile")return route.fulfill({json:{ok:true,profile:{displayName:"Fixture",email:"",whatsapp:""}}});
      if(url.pathname==="/embed")return route.fulfill({contentType:"text/html",body:html("window.fixtureProps="+JSON.stringify(props()))});
      return route.fulfill({json:{ok:true}});
    });
    await page.goto("https://fixture.test/");await page.locator("#gateway-chat-button").click();
    const frame=page.frameLocator("#gateway-chat-shell iframe");await frame.getByRole("button",{name:"Usuario",exact:true}).waitFor();
    await frame.getByRole("button",{name:"Mi perfil",exact:true}).click();
    const username=frame.getByLabel("Usuario",{exact:true}),password=frame.getByLabel("Clave",{exact:true});
    try{await username.waitFor({timeout:15000});}catch(e){await page.screenshot({path:path.join(artifact,"profile-error.png")});console.log(JSON.stringify({repo,engine,template,errors,requests,body:await frame.locator("body").innerText()}));throw e;}
    assert.equal(await username.inputValue(),"fixtureplayer");assert.equal(await password.getAttribute("type"),"password");
    if(repo===configs[0][0])await page.screenshot({path:path.join(artifact,engine+"-"+template+"-profile.png")});
    await frame.getByRole("button",{name:"Mostrar clave",exact:true}).click();assert.equal(await password.inputValue(),"fixture-password");assert.equal(await password.getAttribute("type"),"text");
    await frame.getByRole("button",{name:"Copiar clave",exact:true}).click();
    await frame.getByRole("button",{name:"Cerrar",exact:true}).click();assert.equal(await frame.getByLabel("Clave",{exact:true}).count(),0);
    await frame.getByRole("button",{name:"Usuario",exact:true}).click();await frame.getByText(/Te paso tu usuario y clave/).waitFor();
    assert.equal(await frame.getByText(/Te paso tu usuario y clave/).evaluate(el=>getComputedStyle(el).whiteSpace),"pre-line");
    assert.equal(sql('select count(*) from messages'),"1");assert.equal(await page.locator("#gateway-browser-edge").evaluate(el=>getComputedStyle(el).backgroundColor),"rgb("+[1,3,5].map(i=>parseInt(palette.slice(i,i+2),16)).join(", ")+")");
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
    if(repo===configs[0][0])await page.screenshot({path:path.join(artifact,engine+"-"+template+".png")});
    if(template==="whatsapp"){
      mode="support";await page.frames().find(f=>f.url().startsWith("https://chat.test/embed")).goto("https://chat.test/embed");
      await frame.getByRole("button",{name:"Soporte",exact:true}).waitFor();assert.equal(await frame.getByRole("button",{name:"Usuario",exact:true}).count(),0);
      managerType="full_carga";mode="credentials";await page.frames().find(f=>f.url().startsWith("https://chat.test/embed")).goto("https://chat.test/embed");
      await frame.getByRole("button",{name:"Soporte",exact:true}).waitFor();assert.equal(await frame.getByRole("button",{name:"Usuario",exact:true}).count(),0);
    }
    checks.push({repo,engine,template,profileMasked:true,revealAndCopy:true,manualCredentialReply:true,palettePreserved:true});console.log(JSON.stringify({repo,engine,template,passed:true}));await page.close();
   }
  }
 }finally{await browser.close();}
}
await writeFile(path.join(artifact,"report.json"),JSON.stringify({fixtureOnly:true,physicalSafariToolbarVerified:false,productionWrites:0,rpcCalls,checks},null,2));console.log(JSON.stringify({passed:checks.length,productionWrites:0}));
