// Actual integration form, loopback fixtures and no Meta/Supabase credentials.
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {createServer} from "node:http";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
const require=createRequire(import.meta.url),{build}=require("esbuild");
let browsers=require("playwright");
try { browsers=require(path.join(process.env.APPDATA,"npm/node_modules/playwright")); } catch {}
const directory=process.env.META_CONNECTION_CHECK_DIR||path.join(tmpdir(),"builder-meta-connection-ui");
await mkdir(directory,{recursive:true});
const stubs={
 "@/lib/supabaseClient":`const chain={select:()=>chain,eq:()=>chain,maybeSingle:async()=>({data:{nombre:'Fixture',role:'client'},error:null})};export const supabase={from:()=>chain,auth:{getUser:async()=>({data:{user:{id:'fixture'}}}),getSession:async()=>({data:{session:{access_token:'synthetic-session'}}})}};`,
 "@/lib/conversionsDb":`export const fetchConversionsConfig=async()=>({meta_currency:'ARS',meta_enabled:true,workspace_capi_enabled_ars:true});export const fetchPixelConfigs=async()=>[];export const upsertPixelConfig=async(...args)=>{window.__writes.push(args);return {}};export const upsertConversionsConfig=async()=>({});export const deletePixelConfig=async()=>{};export const setWorkspaceCapiEnabled=async()=>{};`,
 "@/lib/kommoDb":`export const fetchKommoClientConfig=async()=>null;export const upsertKommoClientConfig=async()=>{};`,
 "@/lib/chatraceDb":`export const fetchChatraceClientConfig=async()=>null;export const upsertChatraceClientConfig=async()=>{};`,
 "@/lib/gerencias/gerenciasDb":`export const fetchGerencias=async()=>[];export const fetchGerenciasForAdmin=async()=>[];`,
 "@/components/clients/ClientModulePermissions":`const p={show_kommo:false,show_chatrace:false};export const useClientModulePermissions=()=>p;`,
 "@/components/currency/CurrencyScope":`const scope={currencyScope:'ARS',setCurrencyScope:()=>{}};export const useCurrencyScope=()=>scope;`,
 "@/components/ui/AppConfirmDialog":`export const useAppConfirm=()=>async()=>true;`,
};
const compiled=await build({absWorkingDir:process.cwd(),stdin:{resolveDir:process.cwd(),loader:"tsx",contents:`import React from 'react';import{createRoot}from'react-dom/client';import Form from './components/integraciones/IntegracionesMetaCapi';window.__writes=[];createRoot(document.getElementById('root')).render(<Form/>);`},bundle:true,write:false,platform:"browser",format:"iife",jsx:"automatic",define:{"process.env":"{}","process.env.NODE_ENV":'"production"'},plugins:[{name:"fixture-services",setup(b){b.onResolve({filter:/^@\//},args=>stubs[args.path]?{path:args.path,namespace:"fixture"}:undefined);b.onLoad({filter:/.*/,namespace:"fixture"},args=>({contents:stubs[args.path],loader:"js"}));}}]});
const css=(await require("postcss")([require("@tailwindcss/postcss")()]).process(await readFile("app/globals.css","utf8"),{from:path.resolve("app/globals.css")})).css;
const html=`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><div id="root" style="padding:16px"></div><script src="/fixture.js"></script></html>`;
const server=createServer((request,response)=>{response.setHeader("Content-Type",request.url==="/fixture.js"?"text/javascript":"text/html");response.end(request.url==="/fixture.js"?compiled.outputFiles[0].text:html)});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const origin=`http://127.0.0.1:${server.address().port}`,results=[];
try{for(const [engine,launcher] of [["chromium",browsers.chromium],["webkit",browsers.webkit]]){
 const browser=await launcher.launch({headless:true});
 try{for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  await context.route("**/*",route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  const calls=[];let state="ok";
  await page.route("**/api/meta/connection",route=>{calls.push({body:route.request().postDataJSON(),authorization:route.request().headers().authorization});return route.fulfill({status:state==="ok"?200:422,json:state==="code"?{code:"meta_test_code_required",message:"Meta pidió el código de Probar eventos."}:state==="reject"?{code:"meta_access_rejected",message:"Meta rechazó la prueba. Revisá los permisos."}:{connected:true,mode:"test_event",message:"Conexión CAPI verificada."}})});
  await page.goto(origin+"/?section=meta",{waitUntil:"domcontentloaded"});
  await page.getByRole("button",{name:"AÑADIR PIXEL",exact:true}).click();
  await page.getByPlaceholder("Pixel ID",{exact:true}).fill("123456789");
  await page.getByPlaceholder("Access token",{exact:true}).fill("synthetic-private-token");
  assert.equal(await page.getByPlaceholder("Código de Probar eventos de Meta").count(),0);
  await page.getByRole("button",{name:"Probar conexión",exact:true}).click();
  await page.getByRole("status").filter({hasText:"Conexión CAPI"}).waitFor();
  assert.deepEqual(calls[0],{body:{pixelId:"123456789",token:"synthetic-private-token"},authorization:"Bearer synthetic-session"});
  assert.equal(await page.evaluate(()=>window.__writes.length),0);
  await page.getByPlaceholder("Pixel ID",{exact:true}).fill("987654321");
  assert.equal(await page.getByRole("status").filter({hasText:"Conexión CAPI"}).count(),0);
  state="code";
  await page.getByRole("button",{name:"Probar conexión",exact:true}).click();
  await page.getByPlaceholder("Código de Probar eventos de Meta").waitFor();
  assert.equal(calls[1].body.testEventCode,undefined);
  state="reject";
  await page.getByPlaceholder("Código de Probar eventos de Meta").fill("TEST_FIXTURE");
  await page.getByRole("button",{name:"Probar conexión",exact:true}).click();
  await page.getByRole("alert").filter({hasText:"Meta rechazó"}).waitFor();
  assert.equal(calls[2].body.testEventCode,"TEST_FIXTURE");
  assert.equal(await page.getByPlaceholder("Access token",{exact:true}).inputValue(),"synthetic-private-token");
  await page.getByRole("button",{name:"Cancelar",exact:true}).click();
  await page.getByRole("button",{name:"AÑADIR PIXEL",exact:true}).click();
  assert.equal(await page.getByRole("alert").filter({hasText:"Meta rechazó"}).count(),0);
  assert.equal(await page.getByPlaceholder("Código de Probar eventos de Meta").count(),0);
  assert.deepEqual(errors,[]);
  await page.screenshot({path:path.join(directory,`${engine}-${width}.png`)});
  results.push({engine,width,name:"connection-check-does-not-save-or-leave-stale-success"});await context.close();
 }}finally{await browser.close();}
}}finally{await new Promise(resolve=>server.close(resolve));}
await writeFile(path.join(directory,"results.json"),JSON.stringify({passed:results.length,results},null,2));
console.log(JSON.stringify({passed:results.length,externalRequests:0}));
