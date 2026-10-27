// Actual integration screen + data helpers; browser-only DB fixtures, no production IO.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url)),frontend=path.join(root,'frontend');
const require=createRequire(path.join(frontend,'package.json'));
const {build}=require('esbuild'),postcss=require('postcss'),tailwind=require('@tailwindcss/postcss');
const browsers=require(process.env.PLAYWRIGHT_MODULE_PATH||path.join(process.env.APPDATA,'npm/node_modules/playwright'));
const artifacts=path.join(root,'.vercel/validation-pixel-tabs-20261026');await mkdir(artifacts,{recursive:true});
const uid='19000000-0000-4000-8000-000000000001';
const pixel={id:'19000000-0000-4000-8000-000000000002',user_id:uid,pixel_id:'19000001',meta_access_token:'synthetic',comment:'Campaña de prueba',meta_currency:'ARS',meta_api_version:'v25.0',send_contact_capi:true,send_lead_capi:true,send_complete_registration_capi:false,meta_ads_only_capi:true,send_purchase_capi:true,include_purchase_type_capi:true,send_first_purchase_capi:true,send_repeat_purchase_capi:true,repeat_purchase_capi_window_days:null,purchase_capi_min_amount_enabled:false,purchase_capi_min_amount:0,send_geo_capi:true,geo_use_ipapi:true,geo_fill_only_when_missing:true,is_default:true};
const fixture=`
window.fixture={config:{...${JSON.stringify(pixel)},capi_workspace_settings:{}},pixel:${JSON.stringify(pixel)},writes:[],fail:false,hold:false};
const f=window.fixture;
export const supabase={auth:{getUser:async()=>({data:{user:{id:'${uid}'}}})},
rpc:async(name,args)=>{f.writes.push({rpc:name,args});if(name!=='set_workspace_capi_enabled')throw Error('Unexpected RPC');if(f.hold)await new Promise(r=>f.release=r);if(f.fail)return{error:{message:'synthetic failure'}};f.config.capi_workspace_settings[args.p_currency]=args.p_enabled;return{data:f.config.capi_workspace_settings,error:null};},
from(table){let body=null;const q={select(){return q},eq(){return q},order(){return q},maybeSingle(){return q},upsert(value){body=value;return q},then(resolve){if(body){f.writes.push({table,body});if(table==='conversions_config')Object.assign(f.config,body);else if(table==='conversions_pixel_configs')Object.assign(f.pixel,body);else throw Error('Unexpected write');}const data=table==='profiles'?{nombre:'synthetic-client',role:'client'}:table==='conversions_config'?f.config:table==='conversions_pixel_configs'?[f.pixel]:[];return Promise.resolve({data:structuredClone(data),error:null}).then(resolve)}};return q;}};`;
const permissions={show_kommo:false,show_chatrace:false,show_atrio:true,show_whatsapp_api:true,show_followups:true};
const ui=await build({absWorkingDir:frontend,stdin:{contents:`import React,{useState}from'react';import{createRoot}from'react-dom/client';import Integration from'./components/integraciones/IntegracionesMetaCapi';import{AppConfirmProvider}from'./components/ui/AppConfirmDialog';import{ClientModulePermissionsContext}from'./components/clients/ClientModulePermissions';import{CurrencyFixture}from'@/components/currency/CurrencyScope';function App(){const[open,setOpen]=useState(true);return <CurrencyFixture><button onClick={()=>setOpen(v=>!v)}>Montar pantalla</button>{open&&<AppConfirmProvider><ClientModulePermissionsContext.Provider value={${JSON.stringify(permissions)}}><Integration/></ClientModulePermissionsContext.Provider></AppConfirmProvider>}</CurrencyFixture>}createRoot(document.getElementById('root')).render(<App/>);`,resolveDir:frontend,loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"','process.env.NEXT_PUBLIC_SUPABASE_URL':'"https://fixture.test"'},plugins:[{name:'fixture-io',setup(b){
 b.onResolve({filter:/^@\/lib\/supabaseClient$/},()=>({path:'db',namespace:'fixture'}));
 b.onResolve({filter:/^@\/components\/currency\/CurrencyScope$/},()=>({path:'scope',namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},({path:p})=>({contents:p==='db'?fixture:`import React,{useContext,useState,createContext}from'react';const C=createContext(null);export const useCurrencyScope=()=>useContext(C);export function CurrencyFixture({children}){const[currencyScope,setCurrencyScope]=useState('ARS');return <C.Provider value={{currencyScope,setCurrencyScope}}><select aria-label="Workspace" value={currencyScope} onChange={e=>setCurrencyScope(e.target.value)}><option>ARS</option><option>PYG</option></select>{children}</C.Provider>}`,loader:p==='db'?'js':'tsx',resolveDir:frontend}));
}}]});
const source=await readFile(path.join(frontend,'app/globals.css'),'utf8');
const css=(await postcss([tailwind({base:frontend})]).process(source,{from:path.join(frontend,'app/globals.css')})).css;
const checks=[];
for(const [engine,type]of[['Chromium',browsers.chromium],['WebKit',browsers.webkit]]){
 const browser=await type.launch({headless:true});
 try{for(const viewport of[{width:320,height:568},{width:390,height:844},{width:844,height:390},{width:1366,height:768}]){
  const page=await browser.newPage({viewport});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>new URL(r.request().url()).hostname==='fixture.test'?r.fulfill({contentType:'text/html',body:`<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><main class="mx-auto max-w-6xl space-y-4 p-4"><div id="root"></div></main><script>${ui.outputFiles[0].text}</script></body></html>`}):r.abort());
  await page.goto('https://fixture.test/settings?section=meta');
  const sw=page.getByRole('switch',{name:'Enviar eventos por CAPI',exact:true}),scope=page.getByRole('combobox',{name:'Workspace'});
  await sw.waitFor();assert.equal(await sw.getAttribute('aria-checked'),'true');
  await scope.selectOption('PYG');await sw.click();await page.getByRole('status').filter({hasText:'CAPI desactivado en PYG'}).waitFor();
  await scope.selectOption('ARS');assert.equal(await sw.getAttribute('aria-checked'),'true');
  await scope.selectOption('PYG');assert.equal(await sw.getAttribute('aria-checked'),'false');
  await page.evaluate(()=>window.fixture.fail=true);await sw.click();await page.getByRole('alert').waitFor();assert.equal(await sw.getAttribute('aria-checked'),'false');
  await page.evaluate(()=>{window.fixture.fail=false;window.fixture.hold=true});await sw.click();await page.waitForFunction(()=>!!window.fixture.release);assert.equal(await sw.isDisabled(),true);
  // Switch workspace while the PYG save is pending; its result must not change ARS.
  await scope.selectOption('ARS');await page.evaluate(()=>{window.fixture.hold=false;window.fixture.release()});
  assert.equal(await sw.getAttribute('aria-checked'),'true');await scope.selectOption('PYG');await page.getByRole('status').filter({hasText:'CAPI activo en PYG'}).waitFor();
  await sw.click();await page.getByRole('status').filter({hasText:'CAPI desactivado en PYG'}).waitFor();
  await page.getByRole('button',{name:'Montar pantalla'}).click();await page.getByRole('button',{name:'Montar pantalla'}).click();await sw.waitFor();assert.equal(await sw.getAttribute('aria-checked'),'false');
  const edit=page.getByRole('button',{name:'Editar píxel 19000001'});await edit.click();const modal=page.locator('.integration-edit-modal');await modal.waitFor();
  const ms=name=>modal.getByRole('switch',{name,exact:true});
  const tab=name=>modal.getByRole('tab',{name,exact:true});
  assert.equal(await modal.getByRole('tab').count(),4);assert.equal(await tab('General').getAttribute('aria-selected'),'true');
  await tab('General').focus();await page.keyboard.press('End');assert.equal(await tab('Ubicación').getAttribute('aria-selected'),'true');
  await page.keyboard.press('ArrowRight');assert.equal(await tab('General').getAttribute('aria-selected'),'true');
  await page.keyboard.press('ArrowLeft');assert.equal(await tab('Ubicación').getAttribute('aria-selected'),'true');
  await page.keyboard.press('Home');assert.equal(await tab('General').getAttribute('aria-selected'),'true');
  await modal.getByLabel('Nombre para reconocerlo').fill('Campaña editada');await tab('Eventos').click();
  // Cancelling must not persist either pixel fields or workspace settings.
  await ms('Contact').click();await modal.getByRole('button',{name:'Cancelar',exact:true}).click();await edit.click();assert.equal(await tab('General').getAttribute('aria-selected'),'true');assert.equal(await modal.getByLabel('Nombre para reconocerlo').inputValue(),'Campaña de prueba');
  await modal.getByLabel('Nombre para reconocerlo').fill('Campaña editada');await tab('Eventos').click();assert.equal(await ms('Contact').getAttribute('aria-checked'),'true');
  await ms('Purchase').click();await tab('Purchase').click();await modal.getByText('Activá Purchase en Eventos para configurar el envío de compras.').waitFor();assert.equal(await ms('Clasificar Purchase (first/repeat)').count(),0);
  await modal.getByRole('button',{name:'Ir a Eventos'}).click();await ms('Purchase').click();await tab('Purchase').click();
  await ms('Clasificar Purchase (first/repeat)').click();assert.equal(await ms('First Purchase').count(),0);await ms('Clasificar Purchase (first/repeat)').click();
  await ms('First Purchase').click();await ms('Repeat Purchase').click();await tab('General').click();assert.equal(await modal.getByRole('button',{name:'Guardar',exact:true}).isDisabled(),true);await modal.getByRole('status').filter({hasText:'para poder guardar'}).waitFor();await tab('Purchase').click();await ms('Repeat Purchase').click();
  await ms('Limitar envío de Repeat Purchase').click();await modal.locator('button[aria-haspopup="listbox"]:enabled').click();await modal.getByRole('option',{name:'14 días',exact:true}).click();
  await ms('Filtrar Purchase por monto mínimo').click();await modal.getByLabel('Monto mínimo ARS',{exact:true}).fill('1500');
  await tab('Ubicación').click();await ms('Enviar geo').click();assert.equal(await ms('Geo por IP').count(),0);await ms('Enviar geo').click();
  const box=await modal.boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.width<=viewport.width&&box.height<=viewport.height);
  assert.equal(await modal.evaluate(e=>e.scrollWidth<=e.clientWidth),true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const saveBox=await modal.getByRole('button',{name:'Guardar',exact:true}).boundingBox();assert.ok(saveBox.y>=0&&saveBox.y+saveBox.height<=viewport.height);
  for(const name of ['General','Eventos','Purchase','Ubicación']){
   await tab(name).click();assert.equal(await modal.getByRole('tabpanel').getAttribute('aria-labelledby'),await tab(name).getAttribute('id'));
   await page.waitForFunction(()=>getComputedStyle(document.querySelector('[role="tab"][aria-selected="true"]')).borderBottomColor!==getComputedStyle(document.querySelector('[role="tab"][aria-selected="false"]')).borderBottomColor);
   const rightEdges=await modal.getByRole('switch').evaluateAll(nodes=>nodes.map(e=>e.getBoundingClientRect().right));assert.ok(rightEdges.every(x=>Math.abs(x-rightEdges[0])<1));
   assert.equal(await modal.getByRole('tablist').evaluate(e=>e.scrollWidth<=e.clientWidth),true);
   if(engine==='Chromium'&&[390,1366].includes(viewport.width))await page.screenshot({path:path.join(artifacts,`pixel-${name}-${viewport.width}.png`),animations:'disabled'});
  }
  await modal.getByRole('button',{name:'Guardar',exact:true}).click();await modal.waitFor({state:'hidden'});
  const saved=await page.evaluate(()=>window.fixture);assert.equal(saved.pixel.comment,'Campaña editada');assert.equal(saved.pixel.send_first_purchase_capi,false);assert.equal(saved.pixel.repeat_purchase_capi_window_days,14);assert.equal(saved.pixel.purchase_capi_min_amount,1500);assert.deepEqual(saved.config.capi_workspace_settings,{PYG:false});
  assert.ok(saved.writes.filter(w=>w.table==='conversions_config').every(w=>!Object.hasOwn(w.body,'capi_workspace_settings')));
  assert.ok(saved.writes.filter(w=>w.rpc).every(w=>w.args.p_user_id===uid&&w.args.p_currency==='PYG'));
  await edit.click();assert.equal(await tab('General').getAttribute('aria-selected'),'true');await tab('Purchase').click();assert.equal(await ms('First Purchase').getAttribute('aria-checked'),'false');await modal.getByRole('button',{name:'Cancelar',exact:true}).click();
  if(engine==='Chromium'&&viewport.width===1366)await page.screenshot({path:path.join(artifacts,'workspace-desktop.png')});
  assert.deepEqual(errors,[]);checks.push({engine,viewport,workspaceIsolation:true,persistAndFailure:true,pixelSave:true,responsive:true});await page.close();
 }}finally{await browser.close();}
}
await writeFile(path.join(artifacts,'report.json'),JSON.stringify({passed:checks.length,productionWrites:0,realMetaRequests:0,checks},null,2));console.log(JSON.stringify({passed:checks.length,engines:['Chromium','WebKit'],productionWrites:0}));
