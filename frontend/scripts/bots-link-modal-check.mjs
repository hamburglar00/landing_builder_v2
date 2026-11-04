// Real modal/form components and CSS; all persistence and HTTP boundaries are fixtures.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';

const require=createRequire(import.meta.url),{build}=require('esbuild');
let playwright=require('playwright');
try{playwright=require(path.join(process.env.APPDATA,'npm/node_modules/playwright'))}catch{}
const directory=process.env.BOTS_MODAL_ARTIFACT_DIR||path.join(tmpdir(),'bots-link-modal-20261104');
await mkdir(directory,{recursive:true});
const compiled=await build({absWorkingDir:process.cwd(),stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
import React from 'react';import{createRoot}from'react-dom/client';
import{BotsManagement,GerenciaActions}from'./components/bots/BotsManagement';
import{AppConfirmProvider}from'./components/ui/AppConfirmDialog';
window.fixtureWrites=[];window.fixtureChanged=0;
const params=new URLSearchParams(location.search);
createRoot(document.getElementById('root')).render(<AppConfirmProvider><BotsManagement userId="fixture-user" workspace="ARS" gerencias={[]} isAdmin={params.has('admin')} canAtrio={!params.has('no-atrio')} onChanged={async()=>{window.fixtureChanged++}} onImported={async()=>{}}/><GerenciaActions gerencia={{id:1,nombre:'Gerencia fixture',gerencia_id:184,source_type:'pbadmin'}} onChanged={async()=>{}}/></AppConfirmProvider>);
`},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env':'{}','process.env.NODE_ENV':'"production"'},plugins:[{name:'isolated-persistence',setup(b){
 b.onResolve({filter:/^@\/lib\/(supabaseClient|gerencias\/gerenciasDb|atrio\/atrioDb)$/},args=>({path:args.path,namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},args=>({loader:'js',contents:args.path.endsWith('supabaseClient')
 ? 'export const supabase={auth:{getSession:async()=>({data:{session:{access_token:"fixture"}}})}};'
 : args.path.endsWith('atrioDb')
 ? 'export async function createAtrioClient(user,payload){window.fixtureWrites.push({kind:"atrio",user,payload})}'
 : 'export async function createGerencia(user,payload){window.fixtureWrites.push({kind:"manual",user,payload})};export async function updateGerencia(){};export async function deleteGerencia(){};export async function fetchGerenciaWorkGroups(){return []};export async function createGerenciaWorkGroup(){};export async function updateGerenciaWorkGroup(){};export async function deleteGerenciaWorkGroup(){};export function formatGerenciaError(){return "fixture"}'}));
}}]});
const postcss=require('postcss');
const css=(await postcss([require('@tailwindcss/postcss')()]).process(await readFile('app/globals.css','utf8'),{from:path.resolve('app/globals.css')})).css;
const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><main style="padding:16px"><div id="root"></div></main><script src="/fixture.js"></script></body></html>`;
const results=[];
for(const [name,engine]of [['Chromium',playwright.chromium],['WebKit',playwright.webkit]]){
 const browser=await engine.launch({headless:true});
 try{for(const width of [1280,390,320]){
  console.log(`${name} ${width}: link and edit dialogs`);
  const context=await browser.newContext({viewport:{width,height:width===320?568:800},hasTouch:width<600});
  try{
   const page=await context.newPage(),errors=[],requests=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.route('**/*',async route=>{
    const req=route.request(),u=new URL(req.url());
    assert.equal(u.origin,'https://modal.invalid');
    if(u.pathname==='/fixture.js')return route.fulfill({contentType:'text/javascript',body:compiled.outputFiles[0].text});
    if(u.pathname==='/api/bots/import'){
     const body=req.postDataJSON();requests.push(body);
     return route.fulfill({json:body.action==='preview'?{agencies:[{agency_id:body.id,name:'Gerencia fixture',bots:[]}],unassigned:[]}:{gerencias:1,asesores:0,existentes:0,warnings:[]}});
    }
    assert.equal(req.method(),'GET');return route.fulfill({contentType:'text/html',body:html});
   });
   const choose=async label=>{
    await page.getByRole('button',{name:'Vincular mediante',exact:true}).click();
    const option=page.getByRole('option',{name:label,exact:true});
    if(width<600)await option.tap();else await option.click();
    assert.equal(await page.getByRole('listbox').count(),0);
   };
   await page.goto('https://modal.invalid/fixture');
   await page.getByRole('button',{name:'Vincular Bots',exact:true}).click();
   const dialog=page.getByRole('dialog',{name:'Vincular Bots',exact:true});
   const dimensions=await dialog.boundingBox();assert.ok(dimensions.width<=448&&dimensions.x>=0&&dimensions.x+dimensions.width<=width);
   assert.equal(await dialog.locator('select').count(),0,'uses custom controls');
   const agency=dialog.getByLabel('Agency ID',{exact:true});
   await agency.pressSequentially('184');assert.equal(await agency.inputValue(),'184');assert.ok(await agency.evaluate(el=>el===document.activeElement),'typing keeps focus');
   const style=await agency.evaluate(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return{height:r.height,border:s.borderTopWidth,bg:s.backgroundColor}});
   assert.ok(style.height>=40&&parseFloat(style.border)>=1);assert.notEqual(style.bg,'rgba(0, 0, 0, 0)');
   await choose('Owner ID · todas sus gerencias');
   const owner=dialog.getByLabel('Owner ID',{exact:true});assert.equal(await owner.inputValue(),'');
   await owner.pressSequentially('200');assert.equal(await owner.inputValue(),'200');
   await dialog.getByRole('button',{name:'Buscar bots',exact:true}).click();
   await dialog.getByRole('button',{name:'Importar bots',exact:true}).waitFor();
   assert.deepEqual(requests[0],{action:'preview',kind:'owner',id:200,workspaceCurrency:'ARS'});
   await page.screenshot({path:path.join(directory,`${name}-${width}-preview.png`)});
   await choose('Gerencia manual');
   assert.equal(await dialog.getByRole('button',{name:'Importar bots',exact:true}).count(),0);
   await dialog.getByLabel('Nombre de la gerencia',{exact:true}).pressSequentially('Prueba completa');
   assert.equal(await dialog.getByLabel('Nombre de la gerencia',{exact:true}).inputValue(),'Prueba completa');
   await dialog.getByRole('button',{name:'Guardar',exact:true}).click();
   await dialog.waitFor({state:'hidden'});
   assert.deepEqual(await page.evaluate(()=>window.fixtureWrites[0]),{kind:'manual',user:'fixture-user',payload:{nombre:'Prueba completa',source_type:'manual',workspace_currency:'ARS'}});
   await page.getByRole('button',{name:'Vincular Bots',exact:true}).click();
   await choose('Vincular asesor de Atrio existente');
   const advisor='a0000000-0000-4000-8000-000000000001';
   await dialog.getByLabel('ID del asesor de Atrio',{exact:true}).pressSequentially(advisor);
   await dialog.getByLabel('Slug del asesor',{exact:true}).pressSequentially('asesor-fixture');
   await dialog.getByRole('button',{name:'Guardar',exact:true}).click();
   await dialog.waitFor({state:'hidden'});
   assert.deepEqual(await page.evaluate(()=>window.fixtureWrites[1]),{kind:'atrio',user:'fixture-user',payload:{workspaceCurrency:'ARS',slug:'asesor-fixture',atrioId:advisor}});
   await page.getByRole('button',{name:'Vincular Bots',exact:true}).click();
   const trigger=page.getByRole('button',{name:'Vincular mediante',exact:true});
   await trigger.focus();await page.keyboard.press('ArrowDown');
   await page.waitForFunction(()=>document.activeElement?.getAttribute('role')==='option');
   await page.keyboard.press('Home');await page.keyboard.press('Enter');
   await dialog.getByLabel('Agency ID',{exact:true}).waitFor();
   await dialog.getByLabel('Agency ID',{exact:true}).pressSequentially('321');
   await page.screenshot({path:path.join(directory,`${name}-${width}-agency.png`)});
   await trigger.click();
   const menu=page.getByRole('listbox');const box=await menu.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width&&box.y>=0&&box.y+box.height<=(width===320?568:800));
   await page.screenshot({path:path.join(directory,`${name}-${width}-menu.png`)});
   await page.getByRole('option',{name:'Agency ID · una gerencia',exact:true}).click();
   await dialog.getByRole('button',{name:'Cerrar',exact:true}).click();
   await page.getByRole('button',{name:'Administrar gerencia',exact:true}).click();
   const manage=page.getByRole('dialog',{name:'Administrar gerencia',exact:true});
   await manage.getByLabel('Nombre',{exact:true}).fill('');await manage.getByLabel('Nombre',{exact:true}).pressSequentially('Nombre corregido');
   assert.equal(await manage.getByLabel('Nombre',{exact:true}).inputValue(),'Nombre corregido');
   await manage.getByRole('button',{name:'Cerrar',exact:true}).click();
   await page.goto('https://modal.invalid/fixture?admin&no-atrio');
   await page.getByRole('button',{name:'Vincular Bots',exact:true}).click();
   await page.getByRole('button',{name:'Vincular mediante',exact:true}).click();
   await page.getByRole('listbox').waitFor();
   assert.equal(await page.getByRole('option').count(),3);
   assert.deepEqual(errors,[]);
   results.push({browser:name,width,passed:true,checks:['width','input-style','typing-focus','agency','owner-preview','manual-save','atrio-save','keyboard','menu-bounds','edit','admin-permission']});
  }finally{await context.close()}
 }}finally{await browser.close()}
}
await writeFile(path.join(directory,'results.json'),JSON.stringify({passed:results.length,results},null,2));
console.log(JSON.stringify({passed:results.length,scenariosPerViewport:11,directory}));
