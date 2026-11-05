// Actual editor components, isolated React state and local assets only.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
const require=createRequire(import.meta.url),{build}=require('esbuild');
let playwright;try{playwright=require(path.join(process.env.APPDATA,'npm/node_modules/playwright'))}catch{playwright=require('playwright')}
const root=process.cwd();
const directory=process.env.TEMPLATE9_ARTIFACT_DIR||path.resolve('../docs/validation/template9-20261103');
await mkdir(directory,{recursive:true});
const compiled=await build({absWorkingDir:root,stdin:{resolveDir:root,loader:'tsx',contents:`
  import React,{useState} from 'react';import{createRoot}from'react-dom/client';
  import{LandingTemplateSection}from'./components/landing/LandingEditorForm';
  import{CtaDestinationSection}from'./components/landing/CtaDestinationSection';
  import{LandingPreview}from'./components/landing/LandingPreview';
  import{LandingMarketCountryField}from'./components/landing/LandingMarketCountryField';
  import{DEFAULT_CONFIG}from'./lib/landing/mocks';
  function Fixture(){const[config,setConfig]=useState({...DEFAULT_CONFIG,template:'template7',titleLine1:'Título guardado T7',marketCountry:'PY'});const[workspace,setWorkspace]=useState('ARS');return <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) 390px',gap:24,padding:24}}><section><LandingMarketCountryField config={config} setConfig={setConfig} workspaceCurrency={workspace}/><button id="fixture-ars" onClick={()=>setWorkspace('ARS')}>Workspace ARS</button><button id="fixture-pyg" onClick={()=>setWorkspace('PYG')}>Workspace PYG</button><LandingTemplateSection config={config} setConfig={setConfig}/><CtaDestinationSection config={config} setConfig={setConfig}/><pre id="fixture-config" style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(config)}</pre><a id="fixture-gallery" href="#selected-landing" style={{display:'block',width:300,height:400,overflow:'hidden'}}><LandingPreview config={config} compact gallery/></a></section><div id="fixture-editor-preview"><LandingPreview config={config}/></div></div>}
  createRoot(document.getElementById('root')).render(<Fixture/>);
`},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env':'{}','process.env.NODE_ENV':'"production"'},plugins:[{name:'fixture-client',setup(b){
  b.onResolve({filter:/^@\/lib\/supabaseClient$/},()=>({path:'supabase',namespace:'fixture'}));
  b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const supabase = {};',loader:'js'}));
}}]});
const postcss=require('postcss'),css=(await postcss([require('@tailwindcss/postcss')()]).process(await readFile('app/globals.css','utf8'),{from:path.resolve('app/globals.css')})).css;
const html=`<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${css}</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>`;
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
    await page.waitForFunction(()=>JSON.parse(document.querySelector('#fixture-config').textContent).marketCountry==='AR');
    assert.equal(await page.getByText('País donde circulará la landing',{exact:true}).count(),0);
    await page.locator('#fixture-pyg').click();
    await page.waitForFunction(()=>JSON.parse(document.querySelector('#fixture-config').textContent).marketCountry==='PY');
    await page.locator('#fixture-ars').click();
    await page.waitForFunction(()=>JSON.parse(document.querySelector('#fixture-config').textContent).marketCountry==='AR');
    checks.push({browser:name,country:'hidden; follows ARS/PYG workspace'});
    await page.locator('input[value="template9"]').check();
    const preview=page.frameLocator('#fixture-editor-preview iframe');
    assert.equal(await preview.locator('h1').innerText(),'Creá tu cuenta gratis');
    for(const [label,alt]of[['Rey de Ases','Rey de Ases'],['Ases del Norte','Ases del Norte'],['Ganamos NET','Ganamos NET'],['Multi Skin','Ganamos+']]){
      await page.locator('#template7-target-provider').click();await page.getByRole('option',{name:label,exact:true}).click();
      await preview.locator(`img[alt="${alt}"]`).waitFor();
      assert.equal(await preview.locator('h1').innerText(),'Creá tu cuenta gratis');
      const gallery=page.frameLocator('#fixture-gallery iframe');
      await gallery.locator(`img[alt="${alt}"]`).waitFor();
      for(const [width,height]of [[300,400],[240,320],[180,240]]){
        await page.locator('#fixture-gallery').evaluate((el,[w,h])=>{el.style.width=w+'px';el.style.height=h+'px'},[width,height]);
        await page.waitForFunction(()=>{
          const container=document.querySelector('#fixture-gallery').getBoundingClientRect(),frame=document.querySelector('#fixture-gallery iframe').getBoundingClientRect();
          return frame.width<=container.width+1&&frame.height<=container.height+1;
        });
        const metrics=await gallery.locator('.template9').evaluate(root=>{
          const wrap=root.querySelector('.template9__wrap'),cta=root.querySelector('.template9__cta');
          return {width:root.clientWidth,height:root.clientHeight,rootOverflow:root.scrollHeight-root.clientHeight,wrapOverflow:wrap.scrollHeight-wrap.clientHeight,ctaBottom:cta.getBoundingClientRect().bottom};
        });
        assert.ok(metrics.rootOverflow<=1&&metrics.wrapOverflow<=1,`${name} ${label} gallery ${width}: ${JSON.stringify(metrics)}`);
        const bounds=await page.locator('#fixture-gallery iframe').boundingBox();
        const container=await page.locator('#fixture-gallery').boundingBox();
        assert.ok(bounds&&container&&bounds.width<=container.width+1&&bounds.height<=container.height+1, 'entire preview fits its tile');
        assert.equal(await gallery.locator('.template9__footer').isVisible(),false);
        assert.ok(Math.abs(bounds.width-container.width)<=1, 'gallery preview fills the tile width');
        assert.equal(await gallery.locator('.template9__cookies').isVisible(),false);
        assert.ok(await preview.locator('.template9__footer').isVisible());
        assert.ok(await preview.locator('.template9__cookies').isVisible());
        assert.ok(metrics.ctaBottom<=metrics.height, 'CTA is inside the complete virtual phone');
        checks.push({browser:name,platform:label,gallery:{width,height}});
      }
      await page.locator('#fixture-gallery').evaluate(el=>{el.style.width='300px';el.style.height='400px'});
      if(name==='Chromium')await page.locator('#fixture-gallery').screenshot({path:path.join(directory,`gallery-${alt.replaceAll(' ','-')}.png`)});
      await page.locator('#fixture-gallery').click();
      assert.equal(new URL(page.url()).hash,'#selected-landing','thumbnail opens its parent landing link');
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
await writeFile(path.join(directory,'editor-results.json'),JSON.stringify({passed:checks.length,checks},null,2));
console.log(JSON.stringify({passed:checks.length}));
