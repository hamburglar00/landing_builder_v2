// Actual editor components, isolated React state and local assets only.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const require=createRequire(import.meta.url),{build}=require('esbuild');
let playwright;try{playwright=require(path.join(process.env.APPDATA,'npm/node_modules/playwright'))}catch{playwright=require('playwright')}
const root=process.cwd();
const compiled=await build({absWorkingDir:root,stdin:{resolveDir:root,loader:'tsx',contents:`
  import React,{useState} from 'react';import{createRoot}from'react-dom/client';
  import{LandingTemplateSection}from'./components/landing/LandingEditorForm';
  import{CtaDestinationSection}from'./components/landing/CtaDestinationSection';
  import{LandingPreview}from'./components/landing/LandingPreview';
  import{DEFAULT_CONFIG}from'./lib/landing/mocks';
  function Fixture(){const[config,setConfig]=useState({...DEFAULT_CONFIG,template:'template7',titleLine1:'Título guardado T7'});return <div style={{display:'grid',gridTemplateColumns:'1fr 390px',gap:24,padding:24}}><section><LandingTemplateSection config={config} setConfig={setConfig}/><CtaDestinationSection config={config} setConfig={setConfig}/><pre id="fixture-config">{JSON.stringify(config)}</pre></section><LandingPreview config={config}/></div>}
  createRoot(document.getElementById('root')).render(<Fixture/>);
`},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env':'{}','process.env.NODE_ENV':'"production"'},plugins:[{name:'fixture-client',setup(b){
  b.onResolve({filter:/^@\/lib\/supabaseClient$/},()=>({path:'supabase',namespace:'fixture'}));
  b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const supabase = {};',loader:'js'}));
}}]});
const postcss=require('postcss'),css=(await postcss([require('@tailwindcss/postcss')()]).process(await readFile('app/globals.css','utf8'),{from:path.resolve('app/globals.css')})).css;
const html=`<!doctype html><html lang="es"><head><style>${css}</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>`;
const checks=[];
for(const [name,engine]of[['Chromium',playwright.chromium],['WebKit',playwright.webkit]]){
  const browser=await engine.launch({headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[];let writes=0;
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/*',async route=>{
      const req=route.request(),u=new URL(req.url());if(req.method()!=='GET'){writes++;return route.abort()}
      if(u.pathname==='/fixture.js')return route.fulfill({contentType:'text/javascript',body:compiled.outputFiles[0].text});
      if(/^\/public-assets\/template9\/[a-z_0-9]+\.webp$/.test(u.pathname))return route.fulfill({contentType:'image/webp',body:await readFile(path.resolve('public','.'+u.pathname))});
      return route.fulfill({contentType:'text/html',body:html});
    });
    await page.goto('https://editor.invalid/fixture');
    await page.locator('input[value="template9"]').check();
    const preview=page.frameLocator('iframe[title="Vista previa de Plantilla 9"]');
    assert.equal(await preview.locator('h1').innerText(),'Creá tu cuenta gratis');
    for(const [label,alt]of[['Rey de Ases','Rey de Ases'],['Ases del Norte','Ases del Norte'],['Ganamos NET','Ganamos NET'],['Multi Skin','Ganamos+']]){
      await page.locator('#template7-target-provider').click();await page.getByRole('option',{name:label,exact:true}).click();
      await preview.locator(`img[alt="${alt}"]`).waitFor();
      assert.equal(await preview.locator('h1').innerText(),'Creá tu cuenta gratis');
      checks.push({browser:name,platform:label});
    }
    // Skin is selected with the actual CustomSelect; preview must follow it.
    await page.getByRole('button',{name:'Ganamos+',exact:true}).click();
    assert.equal(await page.getByRole('option').count(),14);
    await page.getByRole('option',{name:'Bet30',exact:true}).click();
    await preview.locator('img[alt="Bet30"]').waitFor();
    const bet30=JSON.parse(await page.locator('#fixture-config').textContent());
    assert.equal(bet30.multiSkinCode,'bet30');assert.equal(bet30.ctaDestination,'atrio');
    assert.equal(bet30.templateConfigs.template7.titleLine1,'Título guardado T7');
    await page.locator('input[value="template7"]').check();
    assert.equal(JSON.parse(await page.locator('#fixture-config').textContent()).titleLine1,'Título guardado T7');
    await page.locator('input[value="template9"]').check();
    await preview.locator('img[alt="Bet30"]').waitFor();
    assert.equal(writes,0,'preview and template switching do not write or create an account');
    assert.deepEqual(errors,[]);
    checks.push({browser:name,platform:'Bet30',drafts:'independent',writes});
  }finally{await browser.close()}
}
await writeFile('../docs/validation/template9-20261103/editor-results.json',JSON.stringify({passed:checks.length,checks},null,2));
console.log(JSON.stringify({passed:checks.length}));
