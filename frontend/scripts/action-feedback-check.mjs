// Real feedback, forms, modal portals and styles; persistence uses isolated fixtures.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
const require=createRequire(import.meta.url),{build}=require('esbuild'),{chromium,webkit}=require('playwright');
const root=process.cwd(),out=process.env.ACTION_FEEDBACK_ARTIFACT_DIR||path.join(tmpdir(),'builder-action-feedback');
await mkdir(out,{recursive:true});
const mocks={
  gerencias:`export async function updateGerencia(){window.writes.update++;if(window.fail)throw Error('No se pudo guardar la gerencia.')}export async function deleteGerencia(){window.writes.delete++;if(window.fail)throw Error('No se pudo eliminar la gerencia.')}export function formatGerenciaError(error,fallback){return error.message||fallback}export async function createGerencia(){}export async function fetchGerenciaWorkGroups(){return []}export async function createGerenciaWorkGroup(){}export async function updateGerenciaWorkGroup(){}export async function deleteGerenciaWorkGroup(){}`,
  atrio:`export async function createAtrioClient(){}`,
  supabase:`export const supabase={auth:{getUser:async()=>({data:{user:{id:'fixture-user'}}})},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{nombre:'Fixture'}})})}),update:()=>({eq:async()=>{window.writes.profile++;return {error:window.profileFail?Error('No se pudo guardar el perfil.'):null}}})})};`,
  settings:`export async function getSettings(){return {url_base:'https://landing.invalid',show_client_landing_preview:true}}export async function updateSettings(){window.writes.settings++;if(window.settingsFail)throw Error('No se pudo guardar la configuración.');}`,
  revalidation:`export async function getRevalidationStatus(){return true}`,
  conversions:`export async function updateConversionEmail(id,email){window.writes.email++;await new Promise(r=>setTimeout(r,30));if(window.fail)throw Error('No se pudo guardar el email.');window.lastEmail=email}`,
};
const compiled=await build({absWorkingDir:root,outfile:path.join(out,'fixture.js'),stdin:{resolveDir:root,loader:'tsx',contents:`
import React,{useEffect,useState}from'react';import{createRoot}from'react-dom/client';
import{ActionNotice,useActionFeedback,useActionMessage}from'./components/ui/ActionNotice';
import{AppConfirmProvider}from'./components/ui/AppConfirmDialog';
import{GerenciaActions}from'./components/bots/BotsManagement';
import Email from'./components/conversiones/EditableConversionEmailCell';
import Settings from'./app/(panel)/admin/settings/page';
import Notifications from'./components/notificaciones/NotificationsPageContent';
window.writes={update:0,delete:0,email:0,settings:0,profile:0,notifications:0};
function NotificationsFixture(){const [settings,setSettings]=useState({user_id:'fixture-user',enabled:false,channel:'telegram',inactive_days:1,renotify_days:1,notify_hour:10,timezone:'America/Buenos_Aires'}),[bot,setBot]=useState({telegram_bot_token:'fixture',telegram_bot_username:'fixture_bot'});return <><button onClick={()=>setBot({...bot,telegram_bot_username:'refreshed_bot'})}>Actualizar bot desde servidor</button><Notifications isAdmin={true} botConfig={bot} settings={settings} destinations={[]} saving={false} onSaveBot={async next=>setBot({...next})} onSaveSettings={async next=>{window.writes.notifications++;if(window.notificationsFail)throw Error('Fixture refusal');setSettings({...next})}} onDisconnectDestination={async()=>{}} onDisconnectLegacy={async()=>{}}/></>}
function ResultForm({leave}){const notify=useActionFeedback();return <button onClick={()=>{notify('Landing guardada y publicada.');leave()}}>Guardar y salir</button>}
function Fixture(){const notify=useActionFeedback(),[tick,setTick]=useState(0),[message,setMessage,key]=useActionMessage(''),[show,setShow]=useState(true),[settings,setSettings]=useState(false),[notifications,setNotifications]=useState(false),[email,setEmail]=useState('before@fixture.invalid');
useEffect(()=>{const timer=setInterval(()=>setTick(n=>n+1),100);return()=>clearInterval(timer)},[]);
useEffect(()=>{window.notify=notify},[notify]);
return <main style={{padding:16,minHeight:'160vh'}}><input aria-label="Conservar foco"/><button onClick={()=>setMessage('Guardado')}>Aviso repetido</button><ActionNotice message={message} noticeKey={key}><small>Actualización {tick}</small></ActionNotice>
<button onClick={()=>setSettings(!settings)}>Abrir configuración</button><button onClick={()=>setNotifications(true)}>Abrir notificaciones</button>{notifications?<NotificationsFixture/>:settings?<Settings/>:<><GerenciaActions gerencia={{id:1,nombre:'Gerencia fixture',source_type:'manual'}} onChanged={async()=>{if(window.refreshFail)throw Error('No se pudo actualizar la lista.')}}/>
<table><tbody><tr><Email row={{id:'conversion-1',phone:'5491100000000',email}} onSaved={(_,value)=>setEmail(value)}/></tr></tbody></table>{show?<ResultForm leave={()=>setShow(false)}/>:<p>Página siguiente</p>}</>}
</main>}
createRoot(document.getElementById('root')).render(<AppConfirmProvider><Fixture/></AppConfirmProvider>);
`},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env':'{}','process.env.NODE_ENV':'"production"'},plugins:[{name:'isolated-services',setup(b){
 const ids={'@/lib/gerencias/gerenciasDb':'gerencias','@/lib/atrio/atrioDb':'atrio','@/lib/supabaseClient':'supabase','@/lib/settingsDb':'settings','@/lib/revalidation/client':'revalidation','@/lib/conversionsDb':'conversions'};
 b.onResolve({filter:/^@\/lib\/(gerencias\/gerenciasDb|atrio\/atrioDb|supabaseClient|settingsDb|revalidation\/client|conversionsDb)$/},args=>({path:ids[args.path],namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:mocks[args.path],loader:'js'}));
}}]});
const cssPath=path.join(root,'app/globals.css');
const css=(await require('postcss')([require('@tailwindcss/postcss')({base:root})]).process(await readFile(cssPath,'utf8'),{from:cssPath})).css+'\n'+compiled.outputFiles.find(f=>f.path.endsWith('.css')).text;
const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>`;
const results=[];
for(const [engine,driver] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await driver.launch({headless:true});
 try{for(const width of [1280,320]){
  const page=await browser.newPage({viewport:{width,height:800}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>{assert.equal(new URL(route.request().url()).origin,'https://feedback.invalid');assert.equal(route.request().method(),'GET');return route.fulfill({contentType:route.request().url().endsWith('.js')?'text/javascript':'text/html',body:route.request().url().endsWith('.js')?compiled.outputFiles.find(f=>f.path.endsWith('.js')).text:html})});
  const notices=page.locator('[data-tone]'),close=async()=>{for(const button of await page.getByRole('button',{name:'Cerrar aviso',exact:true}).all())await button.click()};
  await page.goto('https://feedback.invalid/');
  const focus=page.getByLabel('Conservar foco');await focus.focus();
  const overflow=await page.evaluate(()=>document.body.style.overflow);
  await page.evaluate(()=>window.notify('Prueba de éxito.'));
  const success=page.locator('[data-tone=success]');await success.waitFor();
  const style=await success.evaluate(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return{color:s.color,bg:s.backgroundColor,delay:s.animationDelay,duration:s.animationDuration,left:r.left,right:r.right}});
  assert.equal(style.color,'rgb(134, 239, 172)');assert.equal(style.bg,'rgb(18, 53, 36)');assert.equal(style.delay,'3s');assert.equal(style.duration,'0.3s');assert.ok(style.left>=0&&style.right<=width);
  assert.equal(await focus.evaluate(el=>el===document.activeElement),true);assert.equal(await page.evaluate(()=>document.body.style.overflow),overflow);assert.equal(await page.getByRole('dialog').count(),0);
  await page.waitForTimeout(2000);assert.equal(await success.evaluate(el=>getComputedStyle(el).opacity),'1');
  await success.waitFor({state:'detached',timeout:2200});
  await page.evaluate(()=>window.notify('Prueba de error.','error'));
  const error=page.locator('[data-tone=error]');await error.waitFor();assert.equal(await error.getAttribute('role'),'alert');assert.equal(await error.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(60, 28, 35)');await close();
  // Countdown updates cannot extend the timer; a deliberate repeat does restart it.
  await page.getByRole('button',{name:'Aviso repetido',exact:true}).click();
  await page.waitForTimeout(2100);await page.getByRole('button',{name:'Aviso repetido',exact:true}).click();
  assert.equal(await notices.count(),1);await page.waitForTimeout(1800);assert.equal(await notices.count(),1);await notices.waitFor({state:'detached',timeout:2000});
  await page.getByRole('button',{name:'Guardar y salir',exact:true}).click();await success.filter({hasText:'Landing guardada'}).waitFor();assert.equal(await page.getByText('Página siguiente',{exact:true}).count(),1);await close();
  await page.getByRole('button',{name:'Administrar gerencia',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Administrar gerencia',exact:true}),remove=dialog.getByRole('button',{name:'Eliminar gerencia',exact:true});
  assert.equal(await remove.locator('svg').count(),1);assert.ok(await remove.evaluate(el=>el.classList.contains('ui-button-danger')));assert.equal(await remove.evaluate(el=>getComputedStyle(el).color),'rgb(253, 164, 175)');
  await remove.click();const confirm=page.getByRole('dialog',{name:'Eliminar gerencia',exact:true});assert.equal(await confirm.getByRole('button',{name:'Eliminar',exact:true}).locator('svg').count(),1);await confirm.getByRole('button',{name:'Cancelar',exact:true}).click();assert.equal(await page.evaluate(()=>window.writes.delete),0);
  await page.evaluate(()=>window.fail=true);await dialog.getByRole('button',{name:'Guardar',exact:true}).click();await error.filter({hasText:'No se pudo guardar la gerencia.'}).waitFor();assert.equal(await dialog.count(),1);await close();
  await dialog.getByRole('button',{name:'Guardar',exact:true}).click();await error.waitFor();await close();
  await page.evaluate(()=>{window.fail=false;window.refreshFail=true});await dialog.getByRole('button',{name:'Guardar',exact:true}).click();await error.filter({hasText:'actualizar la lista'}).waitFor();await close();
  await page.evaluate(()=>window.refreshFail=false);await dialog.getByRole('button',{name:'Guardar',exact:true}).click();await dialog.waitFor({state:'hidden'});await success.filter({hasText:'Gerencia actualizada.'}).waitFor();await close();
  await page.getByRole('button',{name:'Administrar gerencia',exact:true}).click();await remove.click();await confirm.getByRole('button',{name:'Eliminar',exact:true}).click();await success.filter({hasText:'Gerencia eliminada.'}).waitFor();await close();
  assert.equal(await page.evaluate(()=>window.writes.delete),1);
  const edit=page.getByRole('button',{name:/email de 5491100000000/});await edit.click();let input=page.getByRole('textbox',{name:'Email de 5491100000000'});await input.fill('cancel@fixture.invalid');await input.press('Escape');assert.equal(await page.evaluate(()=>window.writes.email),0);
  await edit.click();await input.fill('after@fixture.invalid');await input.press('Enter');await success.filter({hasText:'Email guardado.'}).waitFor();assert.equal(await page.evaluate(()=>window.writes.email),1);await close();
  await page.evaluate(()=>window.fail=true);await edit.click();await input.fill('error@fixture.invalid');await input.press('Tab');await error.filter({hasText:'No se pudo guardar el email.'}).waitFor();assert.equal(await edit.innerText(),'after@fixture.invalid');await close();
  await page.getByRole('button',{name:'Abrir configuración',exact:true}).click();await page.getByLabel('Nombre del administrador',{exact:true}).waitFor();
  await page.evaluate(()=>window.profileFail=true);await page.getByRole('button',{name:'Guardar',exact:true}).click();await error.filter({hasText:'No se pudo guardar el perfil.'}).waitFor();assert.equal(await success.count(),0);await close();
  await page.evaluate(()=>{window.profileFail=false;window.settingsFail=true});await page.getByRole('button',{name:'Guardar',exact:true}).click();await error.filter({hasText:'No se pudo guardar la configuración.'}).waitFor();assert.equal(await success.count(),0);await close();
  await page.evaluate(()=>window.settingsFail=false);await page.getByRole('button',{name:'Guardar',exact:true}).click();await success.filter({hasText:'Configuración guardada.'}).waitFor();
  await page.screenshot({path:path.join(out,`${engine}-${width}.png`)});await close();
  await page.getByRole('button',{name:'Abrir notificaciones',exact:true}).click();const toggle=page.getByTitle('Activar notificaciones de seguimiento',{exact:true});await toggle.waitFor();await page.waitForTimeout(850);assert.equal(await page.evaluate(()=>window.writes.notifications),0,'opening saved settings never writes');
  await toggle.click();await success.filter({hasText:'Configuración de notificaciones guardada.'}).waitFor();await page.waitForTimeout(850);assert.equal(await page.evaluate(()=>window.writes.notifications),1,'server refresh does not autosave again');await close();
  await page.evaluate(()=>window.notificationsFail=true);await toggle.click();await error.filter({hasText:'No se pudo guardar la configuracion de notificaciones.'}).waitFor();assert.equal(await success.count(),0);assert.equal(await page.evaluate(()=>window.writes.notifications),2);await close();
  const botInput=page.getByPlaceholder('@Geraldina_bot');assert.equal(await botInput.isDisabled(),true);await page.getByRole('button',{name:'Editar',exact:true}).click();assert.equal(await botInput.isDisabled(),false);await page.getByRole('button',{name:'Actualizar bot desde servidor',exact:true}).click();assert.equal(await botInput.inputValue(),'refreshed_bot');assert.equal(await botInput.isDisabled(),true);
  assert.deepEqual(errors,[]);results.push({engine,width,status:'passed',checks:['timing','repeat','countdown','navigation','focus','save-error','delete-cancel','delete-confirm','email','profile-error','notification-autosave','server-refresh']});console.log(engine+' '+width+': passed');await page.close();
 }}finally{await browser.close()}
}
await writeFile(path.join(out,'results.json'),JSON.stringify({results,productionBusinessWrites:0},null,2));
console.log(JSON.stringify({results,artifacts:out,productionBusinessWrites:0},null,2));
