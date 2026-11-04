// Real statistics component and theme; no production database, events or users.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
const require=createRequire(import.meta.url),{build}=require('esbuild');
let playwright=require('playwright');
try{playwright=require(path.join(process.env.APPDATA,'npm/node_modules/playwright'))}catch{}
const directory=process.env.STATS_CHECK_DIR||path.join(tmpdir(),'conversion-statistics-refinements-20261104');
await mkdir(directory,{recursive:true});
const compiled=await build({absWorkingDir:process.cwd(),stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
import React from 'react';import{createRoot}from'react-dom/client';
import StatsPanel from './components/conversiones/StatsPanel';
import ConversionFiltersModal from './components/conversiones/ConversionFiltersModal';
const t=1793790000;
const base={user_id:'fixture',landing_id:'fixture-landing',source_platform:'landing',created_at:new Date(t*1000).toISOString(),phone:'',external_id:'fixture',valor:0};
const rows=[
 {...base,id:'wa',promo_code:'WA-one',contact_event_id:'wa-contact',contact_event_time:t,contact_payload_raw:JSON.stringify({cta_destination:'whatsapp'}),telefono_asignado:'5491111111111',lead_event_id:'wa-message',lead_event_time:t+1,registration_event_id:'wa-registration',registration_event_time:t+2,purchase_event_id:'wa-purchase',purchase_event_time:t+3,purchase_type:'first',valor:1000,geo_region:'Buenos Aires'},
 {...base,id:'at',promo_code:'AT-one',contact_event_id:'at-contact',contact_event_time:t,contact_payload_raw:JSON.stringify({cta_destination:'atrio',landing_cta_meta_event:'CompleteRegistration'}),atrio_id:'advisor',purchase_event_id:'at-purchase',purchase_event_time:t+3,purchase_type:'first',valor:2500,geo_region:'Córdoba'},
 {...base,id:'other',promo_code:'no-channel',purchase_event_id:'unknown-purchase',purchase_event_time:t+3,valor:999999}
];
rows.push(...['chatrace','whatsapp_cloud_api'].map((source,index)=>({...rows[1],id:'wrong-origin-'+index,source_platform:source,promo_code:'wrong-origin-'+index,purchase_event_id:'wrong-origin-'+index,valor:100000})));
const starts=['whatsapp','atrio'].map((channel,i)=>({...base,id:'s'+i,start_identity_key:'s'+i,journey_destination:channel,first_seen_at:new Date(t*1000).toISOString()}));
const params=new URLSearchParams(location.search);
if(params.has('empty')){rows.length=0;starts.length=0}
if(params.has('players')){
 rows.splice(0,rows.length,...Array.from({length:51},(_,index)=>({...base,id:'first-'+index,external_id:'player-'+index,promo_code:'P-'+index,contact_event_id:'c-'+index,contact_event_time:t,contact_payload_raw:JSON.stringify({cta_destination:'whatsapp'}),telefono_asignado:'5491111111111',lead_event_id:'l-'+index,lead_event_time:t+1,purchase_event_id:'first-'+index,purchase_event_time:t+2,purchase_type:'first',purchase_player_username:'player-'+index,purchase_agency_id:'184',valor:1000})),
 ...Array.from({length:38},(_,index)=>({...base,id:'repeat-'+index,external_id:'player-'+index%16,promo_code:'P-'+index%16,purchase_event_id:'repeat-'+index,purchase_event_time:t+3+index,purchase_type:'repeat',purchase_player_username:'player-'+index%16,purchase_agency_id:'184',purchase_bot_phone:'5491111111111',valor:1000})));
}
function Fixture(){
 const[channel,setChannel]=React.useState(params.has('atrio-selected')?'atrio':'whatsapp');
 const[filters,setFilters]=React.useState(false);
 const close=React.useCallback(()=>setFilters(false),[]);
 const draft={landing:'__all__',pixel:'__all__',gerencia:[],phone:'__all__',fromMetaAds:'__all__',sourcePlatform:'__all__',sex:'__all__',facebook:[],campaigns:[],adSets:[],ads:[]};
 const onChange=Object.fromEntries(Object.keys(draft).map(key=>[key,()=>{}]));
 return <><button type="button" onClick={()=>setFilters(true)}>Filtros de prueba</button>
 <StatsPanel conversions={rows} allConversions={rows} funnelContacts={[]} journeyStarts={params.has('no-visits')?[]:starts} premiumThreshold={200000} dateRange={null} currency="ARS" showAssistant={false} sourcePlatformFilter="landing" canViewAtrio={!params.has('no-atrio')} channel={channel} onChannelChange={setChannel}/>
 {filters&&<ConversionFiltersModal title="Filtros globales" draft={draft} options={{landings:[],pixels:[],gerencias:[],phones:[],sourcePlatforms:['landing','chatrace','whatsapp_cloud_api'],sexes:[],facebook:[],campaigns:[],adSets:[],ads:[]}} onChange={onChange} onApply={close} onClose={close} landingOriginOnly={channel==='atrio'&&!params.has('no-atrio')}/>}
 </>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
`},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env':'{}','process.env.NODE_ENV':'"production"'},plugins:[{name:'isolated-database',setup(b){
 b.onResolve({filter:/^@\/lib\/supabaseClient$/},args=>({path:args.path,namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},()=>({loader:'js',contents:'export const supabase={auth:{getSession:async()=>({data:{session:null}})}}'}));
}}]});
const css=(await require('postcss')([require('@tailwindcss/postcss')()]).process(await readFile('app/globals.css','utf8'),{from:path.resolve('app/globals.css')})).css;
const geo=await readFile('public/argentina-provinces.json','utf8');
const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><main style="padding:16px;min-width:0"><div id="root"></div></main><script src="/fixture.js"></script></body></html>`;
const results=[];
for(const [name,engine]of [['Chromium',playwright.chromium],['WebKit',playwright.webkit]].filter(([name])=>!process.env.STATS_ENGINE||process.env.STATS_ENGINE===name)){
 const browser=await engine.launch({headless:true});
 try{for(const width of process.env.STATS_WIDTH?[Number(process.env.STATS_WIDTH)]:[1280,1024,768,390,320]){
  console.log(name,width);
  const context=await browser.newContext({viewport:{width,height:900},hasTouch:width<600});
  try{
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    assert.equal(url.origin,'https://statistics.invalid','all requests stay in the isolated fixture');
    assert.equal(route.request().method(),'GET','statistics do not send tracking or mutate data');
    return route.fulfill({contentType:url.pathname==='/fixture.js'?'text/javascript':url.pathname.endsWith('.json')?'application/json':'text/html',body:url.pathname==='/fixture.js'?compiled.outputFiles[0].text:url.pathname.endsWith('.json')?geo:html});
   });
   await page.goto('https://statistics.invalid/');
   const panel=page.getByTestId('channel-statistics');
   await panel.getByRole('button',{name:'WhatsApp',exact:true}).waitFor();
   const total=label=>panel.locator(`[data-stat-label="${label}"] > p`).nth(1);
   assert.match(await total('Total cargado').innerText(),/1[.,]000/);
   assert.equal(await panel.locator('[data-stat-label="Crearon usuario"]').count(),0,'WhatsApp has no registration KPI');
   assert.ok(!(await panel.innerText()).includes('CompleteRegistration'));
   assert.equal(await page.getByText('Frecuencia de mensajes por cliente',{exact:true}).count(),0);
   const spend=page.getByLabel('Importe gastado (ARS)',{exact:true});
   await spend.fill('100');
   assert.ok(Number(await spend.evaluate(el=>getComputedStyle(el).fontWeight))>=700);
   assert.ok(Number(await page.locator('label[for="statistics-ad-spend"]').evaluate(el=>getComputedStyle(el).fontWeight))>=700);
   for(const channel of ['Atrio','WhatsApp','Atrio']){
    await panel.getByRole('button',{name:channel,exact:true}).click();
    assert.equal(await panel.getAttribute('data-channel'),channel.toLowerCase());
    const atrio=channel==='Atrio';
    assert.match(await total('Total cargado').innerText(),atrio?/2[.,]500/:/1[.,]000/);
    if(atrio){assert.equal((await total('Crearon usuario').innerText()).trim(),'Sin medición');assert.equal(await total('Crearon usuario').evaluate(el=>getComputedStyle(el).fontSize),'10px')}
    else assert.equal(await panel.locator('[data-stat-label="Crearon usuario"]').count(),0);
    assert.equal(await panel.locator('[data-stat-label="Mensajes recibidos"]').count(),atrio?0:1);
    assert.equal(await page.getByLabel('Importe gastado (ARS)',{exact:true}).inputValue(),atrio?'':'100','advertising spend remains separate per channel');
    assert.equal(await page.getByText('Frecuencia de mensajes por cliente',{exact:true}).count(),0);
    if(width>=1024)for(const id of ['statistics-summary','statistics-funnel']){
     const tops=await page.getByTestId(id).locator(':scope > div').evaluateAll(elements=>[...new Set(elements.map(el=>Math.round(el.getBoundingClientRect().top)))]);
     assert.equal(tops.length,1,id+' fits on one desktop row');
    }
   }
   await page.getByRole('button',{name:'Filtros de prueba',exact:true}).click();
   const origin=page.getByRole('button',{name:'Plataforma de origen',exact:true});
   assert.ok(await origin.isDisabled());assert.match(await origin.innerText(),/Landing/);
   await page.getByRole('button',{name:'Cerrar',exact:true}).last().click();
   await page.waitForTimeout(300);
   const overflow=await page.evaluate(()=>({viewport:innerWidth,doc:document.documentElement.scrollWidth,labels:[...document.querySelectorAll('[data-stat-label] > p,[data-testid="statistics-journey"] p')].filter(el=>{const r=el.getBoundingClientRect(),parent=el.parentElement.getBoundingClientRect();return r.width>0&&(el.scrollWidth>el.clientWidth+1||r.right>innerWidth+1||r.left<0||r.right>parent.right+1)}).map(el=>el.textContent),outside:[...document.querySelectorAll('div,section,svg')].filter(el=>{const r=el.getBoundingClientRect();return r.right>innerWidth+1&&getComputedStyle(el).opacity!=='0'}).slice(0,8).map(el=>({tag:el.tagName,css:el.getAttribute('class'),text:el.textContent?.slice(0,80),right:el.getBoundingClientRect().right}))}));
   await page.screenshot({path:path.join(directory,`${name}-${width}-atrio.png`)});
   if(overflow.doc>overflow.viewport+1)console.log(await page.evaluate(()=>[...document.querySelectorAll('*')].filter(el=>el.getBoundingClientRect().right>innerWidth+1).slice(0,20).map(el=>({tag:el.tagName,css:el.getAttribute('class'),right:el.getBoundingClientRect().right,opacity:getComputedStyle(el).opacity,text:el.textContent?.slice(0,65),overflow:getComputedStyle(el.parentElement).overflowX}))));
   assert.ok(overflow.doc<=overflow.viewport+1,JSON.stringify(overflow));
   assert.deepEqual(overflow.labels,[],JSON.stringify(overflow));
   assert.deepEqual(errors,[]);
   await page.goto('https://statistics.invalid/?no-atrio&atrio-selected&no-visits');
   await page.getByLabel('Importe gastado (ARS)',{exact:true}).waitFor();
   assert.equal(await panel.getAttribute('data-channel'),'whatsapp','hidden Atrio forces WhatsApp even with a stale choice');
   assert.equal(await page.getByRole('group',{name:'Canal de las estadísticas'}).count(),0);
   assert.equal(await panel.locator('[data-stat-label="Crearon usuario"]').count(),0);
   const missing=panel.locator('[data-stat-label="Visitas unicas"] > p').nth(1);
   assert.equal(await missing.evaluate(el=>getComputedStyle(el).fontSize),'10px');
   const journeyMissing=page.getByTestId('statistics-journey').getByText('Sin medición',{exact:true});
   assert.equal(await journeyMissing.evaluate(el=>getComputedStyle(el).fontSize),'9px');
   await page.getByRole('button',{name:'Filtros de prueba',exact:true}).click();
   await page.getByRole('button',{name:'Plataforma de origen',exact:true}).click();
   assert.deepEqual((await page.getByRole('option').allTextContents()).map(x=>x.trim().replace(/^•\s*/,'')),['Todas','Landing','Chatrace','WhatsApp Cloud API']);
   await page.goto('https://statistics.invalid/?players');
   await page.getByLabel('Importe gastado (ARS)',{exact:true}).waitFor();
   const journey=page.getByTestId('statistics-journey');
   const values=await journey.locator('p.text-lg').allTextContents();
   assert.deepEqual(values.slice(-2),['51','16']);
   assert.match(await journey.innerText(),/31\.4%/);
   assert.equal(await panel.locator('[data-stat-label="Crearon usuario"]').count(),0);
   await page.screenshot({path:path.join(directory,`${name}-${width}-players.png`)});
   await page.goto('https://statistics.invalid/?empty');
   await page.getByRole('button',{name:'Atrio',exact:true}).click();
   assert.match(await panel.innerText(),/No hay datos de Atrio/);
   await page.getByRole('button',{name:'WhatsApp',exact:true}).click();
   assert.match(await panel.innerText(),/No hay datos de WhatsApp/);
   assert.deepEqual(errors,[]);
   results.push({engine:name,width,channels:true,financialIsolation:true,missingCoverage:true,boldInput:true,contained:true,playerCounts:[51,16],rate:'31.4%',hiddenAtrio:true,originRestriction:true,errors});
  }finally{await context.close()}
 }}finally{await browser.close()}
}
await writeFile(path.join(directory,'results.json'),JSON.stringify(results,null,2));
console.log(JSON.stringify({directory,scenarios:results.length}));
