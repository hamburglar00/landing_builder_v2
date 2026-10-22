/* eslint-disable @typescript-eslint/no-explicit-any -- Isolated browser fixtures model external services without production access. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { build } from "esbuild";
import { chromium } from "playwright";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { handleManagerDestinations, type DestinationBackend } from "../lib/atrio/managerDestinations.server";
import { DEFAULT_CONFIG } from "../lib/landing/mocks";

// Render the actual client/admin editor pages. Only authentication, storage and
// external services are synthetic; destination requests use the real HTTP handler.
async function main() {
  const root = process.cwd();
  const require = createRequire(path.join(root, "package.json"));
  const id = (n: number) => `b0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const clients = ["gera", "diana"].map((slug, i) => ({ id:id(i+10), atrio_id:id(i+20), user_id:id(2), workspace_currency:"ARS", slug, usage_count:0 }));
  const connections = [
    [1035, "rey_de_ases", 0], [1040, "ases_del_norte", 0],
    [1041, "ganamos_net", 0], [1042, "ganamos_net", 0], [1044, "ganamos_net", 1],
  ].map(([manager, provider, advisor], i) => ({ connection_id:id(i+100), advisor_id:clients[Number(advisor)].atrio_id, advisor_slug:clients[Number(advisor)].slug, advisor_name:null,
    manager_id:manager, agency_id:manager, agency_name:`Gerencia ${manager}`, target_provider:provider, manager_type:"mkt", active:true, verified_at:null, usage_count:0, chats_started:0, messages_received:0 }));
  const advisors = clients.map(client => ({id:client.atrio_id,slug:client.slug,name:client.slug,connections:connections.filter(connection=>connection.advisor_id===client.atrio_id)}));
  let landing: any, pools: Record<string, any> = {}, operations: any[] = [], actorMode = "dashboard";
  const reset = () => {
    landing = {id:id(1),userId:id(2),workspaceCurrency:"ARS",landingType:"internal",publishTarget:"constructor",externalDomain:"",name:"Nueva-landing-fixture",pixelId:"123456",landingTag:"EDITOR8",comment:"Isolated editor E2E",
      gerenciaSelectionMode:"weighted_random",gerenciaFairCriterion:"usage_count",atrioSelectionMode:"weighted_random",atrioFairCriterion:"usage_count",phoneMode:"random",phoneKind:"mkt",phoneIntervalStartHour:null,phoneIntervalEndHour:null,postUrl:"",config:{...DEFAULT_CONFIG}};
    pools={};operations=[];
  };
  const backend: DestinationBackend = {
    authenticate:async token=>token==="fixture-token",
    landing:async(_,value)=>value===landing.id?{id:landing.id,user_id:id(2),workspace_currency:"ARS",config:landing.config}:null,
    clients:async()=>clients,workspaceClients:async(_,owner,workspace)=>owner===id(2)&&workspace==="ARS"?clients:[],
    assign:async()=>{operations.push({action:"assign"});},
    call:async(action,input:any)=>{
      operations.push({action,...input});
      if(action==="directory")return {advisors};
      if(action==="configuration")return pools[input.target_provider]??{configuration:null};
      if(action==="configure") {
        for(const destination of input.destinations)assert.ok(connections.some(connection=>connection.connection_id===destination.connection_id&&connection.target_provider===input.target_provider));
        pools[input.target_provider]={...input};return pools[input.target_provider];
      }
      throw Error("Unexpected fixture action");
    },
  };
  let javascript="", css="";
  const server=createServer(async(req,res)=>{
    try {
      const url=new URL(req.url||"/",`http://${req.headers.host}`);
      const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));const body=Buffer.concat(chunks).toString();
      let response:Response;
      if(url.pathname==="/api/atrio/manager-destinations")response=await handleManagerDestinations(new Request(url,{method:req.method,headers:req.headers as HeadersInit,body}),backend);
      else if(url.pathname==="/fixture/landing"&&req.method==="POST") {const data=JSON.parse(body);assert.equal(data.id,landing.id);landing={...landing,...data.payload};operations.push({action:"save",config:landing.config});response=Response.json({ok:true});}
      else if(url.pathname==="/fixture/landing")response=Response.json(landing);
      else if(url.pathname==="/fixture/publish") {operations.push({action:"publish"});response=Response.json({ok:true});}
      else if(url.pathname==="/editor.js")response=new Response(javascript,{headers:{"Content-Type":"text/javascript"}});
      else if(url.pathname==="/editor.css")response=new Response(css,{headers:{"Content-Type":"text/css"}});
      else if(url.pathname.startsWith("/dashboard/")||url.pathname.startsWith("/admin/"))response=new Response(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/editor.css"></head><body><div id="root"></div><script>window.fixture=${JSON.stringify({id:id(1),owner:id(2),actor:actorMode==="admin"?id(3):id(2),clients,mode:actorMode})}</script><script src="/editor.js"></script></body></html>`,{headers:{"Content-Type":"text/html"}});
      else throw Error(`Unexpected local request: ${url.pathname}`);
      res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
    }catch(error){res.writeHead(500);res.end(String(error));}
  });
  await new Promise<void>(done=>server.listen(0,"127.0.0.1",done));
  const origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
  let browser;
  try {
    const mocks:Record<string,string>={
      navigation:`const router={push(value){window.fixtureDestination=value},replace(value){window.fixtureDestination=value}};export const useRouter=()=>router;export const useParams=()=>({id:window.fixture.id});export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);`,
      link:`import React from 'react';export default function Link({href,prefetch,...props}){return <a href={href} {...props}/>}`,
      supabase:`const query=table=>{let single=false;const q=new Proxy({},{get(_,key){if(key==='then')return resolve=>{const values={profiles:{id:window.fixture.owner,nombre:'editor-test',role:window.fixture.mode==='admin'?'admin':'client'},landings:{user_id:window.fixture.owner},settings:{id:1,url_base:location.origin,show_client_landing_preview:false},client_template_permissions:{template7_enabled:true,template8_enabled:true}};resolve({data:single?(values[table]??null):[],error:null})};return()=>{if(key==='single'||key==='maybeSingle')single=true;return q}}});return q};export const supabase={from:query,auth:{getUser:async()=>({data:{user:{id:window.fixture.actor}},error:null}),getSession:async()=>({data:{session:{access_token:'fixture-token'}},error:null})}};`,
      landings:`export const UNIQUE_VIOLATION_CODE='23505';export const fetchLandingById=async()=>fetch('/fixture/landing').then(r=>r.json());export const fetchTemplate7Permission=async()=>true;export const fetchTemplate8Permission=async()=>true;export async function updateLanding(id,payload){const response=await fetch('/fixture/landing',{method:'POST',body:JSON.stringify({id,payload})});if(!response.ok)throw Error('Fixture save failed')}export const deleteLanding=async()=>{throw Error('No deletion in this test')};`,
      gerencias:`export const fetchGerencias=async()=>[];export const fetchGerenciasForAdmin=async()=>[];export const fetchGerenciaWorkGroups=async()=>[];export const fetchLandingGerencias=async()=>[];export const setLandingGerencias=async()=>{};export const assertLandingGerenciasWorkspaceCompatible=async()=>{};`,
      atrio:`export const fetchAtrioClients=async()=>window.fixture.clients;export const fetchLandingAtrioAssignments=async()=>[];export const setLandingAtrioAssignments=async()=>{};`,
      publish:`export async function publishLandingChanges(){const response=await fetch('/fixture/publish',{method:'POST'});if(!response.ok)throw Error('Fixture publish failed');return {revalidated:true}}`,
      dialogs:`export const useAppConfirm=()=>async()=>true;export const useAppPrompt=()=>async()=>null;`,
    };
    const bundle=await build({absWorkingDir:root,tsconfig:path.join(root,"tsconfig.json"),stdin:{resolveDir:root,loader:"tsx",contents:`import React from 'react';import{createRoot}from'react-dom/client';import Client from './app/(panel)/dashboard/landing/[id]/editar/page';import Admin from './app/(panel)/admin/landings/[id]/editar/page';import{CurrencyScopeProvider}from './components/currency/CurrencyScope';const Page=window.fixture.mode==='admin'?Admin:Client;createRoot(document.getElementById('root')).render(<CurrencyScopeProvider><Page/></CurrencyScopeProvider>);`},bundle:true,write:false,platform:"browser",format:"iife",jsx:"automatic",define:{"process.env":"{}","process.env.NODE_ENV":'"production"',"process.env.NEXT_PUBLIC_SUPABASE_URL":JSON.stringify(origin),"process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY":'"synthetic-public"'},plugins:[{name:"isolated-editor",setup(b){
      b.onResolve({filter:/^(next\/navigation|next\/link|@\/lib\/supabaseClient|@\/lib\/landing\/landingsDb|@\/lib\/gerencias\/gerenciasDb|@\/lib\/atrio\/atrioDb|@\/lib\/landing\/publishLanding|@\/components\/ui\/AppConfirmDialog)$/},args=>({path:({"next/navigation":"navigation","next/link":"link","@/lib/supabaseClient":"supabase","@/lib/landing/landingsDb":"landings","@/lib/gerencias/gerenciasDb":"gerencias","@/lib/atrio/atrioDb":"atrio","@/lib/landing/publishLanding":"publish","@/components/ui/AppConfirmDialog":"dialogs"} as Record<string,string>)[args.path],namespace:"fixture"}));
      b.onResolve({filter:/^@\/components\/landing\/(LandingPreview|Template6AnalyticsSection|GerenciaRedirectSection|GerenciasAssignmentSummary)$/},args=>({path:args.path.split("/").at(-1)!,namespace:"empty-component"}));
      b.onLoad({filter:/.*/,namespace:"fixture"},args=>({contents:mocks[args.path],loader:"tsx",resolveDir:root}));
      b.onLoad({filter:/.*/,namespace:"empty-component"},args=>({contents:`export const ${args.path}=()=>null;`,loader:"tsx",resolveDir:root}));
    }}]});
    javascript=bundle.outputFiles[0].text;
    const cssPath=path.join(root,"app/globals.css");css=(await require("postcss")([require("@tailwindcss/postcss")()]).process(await readFile(cssPath,"utf8"),{from:cssPath})).css;
    browser=await chromium.launch({headless:true});
    const results=[];
    for(const mode of ["dashboard","admin"]) {
      reset();actorMode=mode;
      const context=await browser.newContext({viewport:{width:1280,height:900}});const page=await context.newPage();const errors:string[]=[];
      page.on("pageerror",error=>errors.push(error.message));
      await context.route("**/*",route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
      const url=origin+(mode==="admin"?`/admin/landings/${id(1)}/editar`:`/dashboard/landing/${id(1)}/editar`);
      await page.goto(url);
      try { await page.locator('input[value="template1"]').waitFor({timeout:10000}); }
      catch { throw Error(JSON.stringify({mode,errors,body:(await page.locator("body").innerText()).slice(0,1200),redirect:await page.evaluate(()=>(window as any).fixtureDestination)})); }
      await page.locator('input[value="Nueva-landing-fixture"]').fill("editor8test");
      await page.locator('input[value="template8"]').check();
      await page.getByRole("button",{name:"Redirección",exact:true}).click();
      await page.getByText("gera",{exact:true}).click();await page.getByText("diana",{exact:true}).click();
      assert.equal(landing.config.template,"template1","Reading the editor must not persist its draft");
      assert.equal(await page.getByRole("group",{name:"Modo de reparto"}).count(),1);
      assert.equal(await page.getByText("Redirección por página",{exact:true}).count(),0);
      assert.equal(operations.filter(value=>value.action==="directory").length,1);
      assert.equal(operations.filter(value=>value.action==="configure"||value.action==="assign"||value.action==="save").length,0);
      for(const manager of [1035,1040,1041,1044])await page.getByRole("checkbox",{name:`Seleccionar bot ${manager}`,exact:true}).check();
      if(mode==="dashboard") {
        await page.getByRole("button",{name:"Equitativa",exact:true}).click();
        await page.getByRole("button",{name:"Chats iniciados",exact:true}).click();
      } else {
        await page.getByRole("spinbutton",{name:"Peso bot 1044",exact:true}).fill("3");
      }
      await page.getByRole("button",{name:"Guardar",exact:true}).first().click();
      await page.waitForFunction(()=>Boolean((window as any).fixtureDestination));
      assert.equal(landing.config.template,"template8");assert.equal(landing.config.ctaDestination,"atrio");
      assert.equal(pools.ganamos_net.mode,mode==="dashboard"?"fair":"weighted_random");assert.equal(pools.ganamos_net.criterion,mode==="dashboard"?"messages_received":"usage_count");assert.equal(pools.ganamos_net.destinations.length,2);
      assert.equal(pools.ganamos_net.destinations.find((value:any)=>value.connection_id===connections[4].connection_id).weight,mode==="dashboard"?1:3);
      assert.equal(pools.rey_de_ases.mode,"fixed");assert.equal(pools.ases_del_norte.mode,"fixed");assert.equal(pools.multi_skin,undefined);
      assert.ok(operations.findIndex(value=>value.action==="save")<operations.findIndex(value=>value.action==="configure"));
      assert.equal(operations.at(-1).action,"publish");
      await page.goto(url);await page.getByRole("button",{name:"Redirección",exact:true}).click();
      await page.getByText("gera",{exact:true}).click();await page.getByText("diana",{exact:true}).click();
      for(const manager of [1035,1040,1041,1044])assert.equal(await page.getByRole("checkbox",{name:`Seleccionar bot ${manager}`,exact:true}).isChecked(),true);
      assert.equal(await page.getByRole("button",{name:mode==="dashboard"?"Equitativa":"Aleatoria",exact:true}).getAttribute("aria-pressed"),"true");
      if(mode==="dashboard")assert.equal(await page.getByRole("button",{name:"Chats iniciados",exact:true}).getAttribute("aria-pressed"),"true");
      else assert.equal(await page.getByRole("spinbutton",{name:"Peso bot 1044",exact:true}).inputValue(),"3");
      await mkdir("test-results/template8",{recursive:true});await page.screenshot({path:`test-results/template8/${mode}-unified-editor.png`,fullPage:true});
      assert.deepEqual(errors,[]);results.push({mode,firstSave:true,oneDirectoryRead:true,threeProviderPools:true,restoredSelection:true});
      await context.close();
    }
    reset();actorMode="dashboard";
    const context=await browser.newContext();const page=await context.newPage();
    await context.route("**/*",route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
    await page.goto(`${origin}/dashboard/landing/${id(1)}/editar`);
    await page.locator('input[value="Nueva-landing-fixture"]').fill("editor7test");
    await page.locator('input[value="template7"]').check();
    await page.getByRole("button",{name:"Redirección",exact:true}).click();await page.getByText("gera",{exact:true}).click();
    await page.getByRole("checkbox",{name:"Seleccionar bot 1035",exact:true}).check();
    assert.equal(landing.config.template,"template1");
    await page.getByRole("button",{name:"Guardar",exact:true}).first().click();await page.waitForFunction(()=>Boolean((window as any).fixtureDestination));
    assert.equal(landing.config.template,"template7");assert.equal(pools.rey_de_ases.mode,"fixed");assert.equal(Object.keys(pools).length,1);
    results.push({mode:"dashboard-template7",firstSave:true,oneDirectoryRead:true,threeProviderPools:false,restoredSelection:false});
    await context.close();
    await writeFile("test-results/template8/editor-results.json",JSON.stringify(results,null,2));console.log(JSON.stringify(results));
  }finally{await browser?.close();await new Promise<void>(done=>server.close(()=>done()));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
