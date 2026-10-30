// Real renderers and browser engines, local assets and synthetic HTTP only.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const workspace=fileURLToPath(new URL('../../',import.meta.url));
const root=path.join(workspace,'multi-skin-gateway'),frontend=path.join(workspace,'landing-builder/frontend');
const require=createRequire(path.join(frontend,'package.json')),{build}=require('esbuild');
const {chromium,webkit}=require(path.join(process.env.APPDATA,'npm/node_modules/playwright'));
const output=path.join(root,'.vercel/skin-branding-20261030');await mkdir(output,{recursive:true});
async function bundle(cwd,contents){
  const result=await build({absWorkingDir:cwd,stdin:{contents,loader:'ts',resolveDir:cwd},bundle:true,write:false,platform:'node',format:'cjs',external:['react','react/jsx-runtime','react-dom/server','next/*']});
  const module={exports:{}};new Function('require','module','exports',result.outputFiles[0].text)(createRequire(path.join(cwd,'package.json')),module,module.exports);return module.exports;
}
const api=await bundle(root,`export {MULTI_SKIN_CODES,MULTI_SKIN_CATALOG} from './src/lib/multi-skin-catalog';export {getMultiSkinBrand} from './src/lib/skin-branding';export {skinPreparationTheme} from './src/lib/skin-presentation';export {renderPreparationPage} from './src/lib/preparation-page';export {renderGatewayEntryTransition,GATEWAY_ENTRY_TRANSITION_RUNTIME} from './src/lib/gateway-entry-transition';`);
for(const key of ['MULTI_SKIN_GATEWAY_ORIGIN','GANAMOS_PLUS_GATEWAY_ORIGIN','REY_GATEWAY_ORIGIN','GANAMOS_NET_GATEWAY_ORIGIN','ASES_DEL_NORTE_GATEWAY_ORIGIN'])process.env[key]='https://fixture.test';
const builder=await bundle(frontend,`export {renderPublicLandingHtml} from './components/public-landing/renderPublicLandingHtml';export {buildLandingConfig} from './lib/landing/buildLandingConfig';export {DEFAULT_CONFIG} from './lib/landing/mocks';`);
const rgb=hex=>'rgb('+[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)).join(', ')+')';
const checks=[];
for(const [engine,type] of [['Chromium',chromium],['WebKit',webkit]]){
  const browser=await type.launch({headless:true});
  try{
    for(const viewport of [{width:390,height:844},{width:1366,height:768}]){
      const context=await browser.newContext({viewport}),page=await context.newPage();let mode='prepare',code='bet30';
      const errors=[];page.on('pageerror',error=>errors.push(error.message));
      await context.route('**/*',async route=>{
        const url=new URL(route.request().url()),pathname=url.pathname;
        if(url.origin!=='https://fixture.test')return route.abort();
        if(pathname==='/api/preparations/complete')return route.fulfill({json:{username:'fixtureplayer',continuation_token:'c1.fixture',entry_token:'ge1.fixture',handoff_url:'https://fixture.test/start?t=fixture'}});
        if(pathname==='/start')return route.fulfill({json:{username:'fixtureplayer',password:'fixture-password',entry_confirmation:'ge1.confirmed',entry_id:'fixture-entry',redirect_url:'https://fixture.test/home',entry_wait:{enabled:true,seconds:60}}});
        if(pathname==='/api/template7/destination')return route.fulfill({json:{atrioClientId:'22222222-2222-4222-8222-222222222222',atrioId:'33333333-3333-4333-8333-333333333333',atrioSlug:'fixture',preparationReady:false}});
        if(pathname==='/api/client-identity/bootstrap')return route.fulfill({headers:{'Set-Cookie':'lb_cid=44444444-4444-4444-8444-444444444444; Path=/; HttpOnly; SameSite=Lax'},json:{ok:true}});
        if(pathname.startsWith('/api/'))return route.fulfill({json:{ok:true}});
        if(/\.(?:avif|webp|png)$/.test(pathname)){
          for(const repo of ['multi-skin-gateway','landing-autologuin','ases-gateway','ganamos-gateway']){
            try{return await route.fulfill({body:await readFile(path.join(workspace,repo,'public',pathname)),contentType:pathname.endsWith('.avif')?'image/avif':pathname.endsWith('.webp')?'image/webp':'image/png'});}catch{}
          }
          throw Error('Missing local image: '+pathname);
        }
        if(pathname.endsWith('.js'))return route.fulfill({contentType:'text/javascript',body:'/* local fixture */'});
        let body;
        const brand=api.getMultiSkinBrand(code);
        if(mode==='prepare')body=api.renderPreparationPage('p1.fixture',api.skinPreparationTheme(code));
        else if(mode==='overlay')body=`<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#000000"></head><body>${api.renderGatewayEntryTransition('multi_skin',{active:true,stage:'creating',brand})}<script>${api.GATEWAY_ENTRY_TRANSITION_RUNTIME};window.transition=createGatewayEntryTransition(document.getElementById('gateway-entry-transition'));transition.start('creating');</script></body></html>`;
        else body=mode;
        return route.fulfill({contentType:'text/html',body});
      });
      for(code of api.MULTI_SKIN_CODES){
        const brand=api.getMultiSkinBrand(code);
        mode='prepare';await page.goto('https://fixture.test/prepare');
        await page.waitForFunction(()=>{const img=document.querySelector('img.logo');return img?.complete&&img.naturalWidth>0});
        assert.equal(await page.locator('html').evaluate(el=>getComputedStyle(el).backgroundColor),rgb(brand.background));
        assert.equal(await page.locator('img.logo').getAttribute('src'),brand.logo.replace(/\.avif$/,'.webp'));
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
        if(viewport.width===390&&engine==='Chromium')await page.screenshot({path:path.join(output,code+'-prepare.png')});
        mode='overlay';await page.goto('https://fixture.test/overlay');
        await page.waitForFunction(()=>{const img=document.querySelector('[data-entry-logo]');return img?.complete&&img.naturalWidth>0});
        for(const selector of ['html','body','#gateway-entry-transition'])assert.equal(await page.locator(selector).evaluate(el=>getComputedStyle(el).backgroundColor),rgb(brand.background));
        assert.equal(await page.locator('[data-entry-title]').evaluate(el=>getComputedStyle(el).color),rgb(brand.accent));
        assert.equal(await page.locator('meta[name="theme-color"]').getAttribute('content'),brand.background);
        if(viewport.width===390&&engine==='Chromium')await page.screenshot({path:path.join(output,code+'-overlay.png')});
        await page.evaluate(()=>window.transition.finish());
        assert.equal(await page.locator('meta[name="theme-color"]').getAttribute('content'),'#000000');
        checks.push({engine,viewport,skin:code,localLogo:true,preparePalette:true,overlayPalette:true,restoration:true});
      }
      // Change cards before starting an account: picture source and canvas follow the selected skin.
      const cover={cardCount:3,backgroundImageUrl:'',headerText:'Choose',footerText:'',cards:['bet30','gran_poseidon','fortu_bet'].map(skin=>({imageUrl:'',text:skin,ctaText:'',targetProvider:'multi_skin',multiSkinCode:skin}))};
      const config=builder.buildLandingConfig({id:'11111111-1111-4111-8111-111111111111',name:'brand-test',comment:'',pixelId:'',postUrl:'',landingTag:'TEST',config:{...builder.DEFAULT_CONFIG,template:'template8',ctaDestination:'atrio',template8Cover:cover}});
      mode=builder.renderPublicLandingHtml({slug:'brand-test',config});await page.goto('https://fixture.test/landing');
      for(const [index,skin] of ['bet30','gran_poseidon','fortu_bet'].entries()){
        await page.locator(`[data-template8-card-index="${index+1}"]`).click();
        const brand=api.getMultiSkinBrand(skin),overlay=page.locator('#gateway-entry-transition');
        assert.equal(await overlay.getAttribute('data-palette'),brand.background);
        assert.equal(await overlay.locator('[data-entry-logo]').getAttribute('data-src'),'https://fixture.test'+brand.logo.replace('.avif','.webp'));
        const picture=overlay.locator('[data-entry-source]');
        if(await picture.count())assert.equal(await picture.getAttribute('data-srcset'),'https://fixture.test'+brand.logo);
        assert.equal(await overlay.evaluate(el=>el.style.getPropertyValue('--entry-accent')),brand.accent);
        await page.locator('[data-template8-back]').click();
      }
      assert.deepEqual(errors,[]);
      checks.push({engine,viewport,template8SkinSwitch:true,pictureSource:true,palette:true});
      await context.close();
    }
  }finally{await browser.close()}
  console.log(engine+': '+checks.filter(v=>v.engine===engine).length+' checks passed');
}
await writeFile(path.join(output,'report.json'),JSON.stringify({network:'synthetic browser responses only',productionWrites:0,checks},null,2));
// A reviewable contact sheet uses the official local images and their real palette.
const cards=api.MULTI_SKIN_CODES.map(code=>{const b=api.getMultiSkinBrand(code);return `<article style="background:${b.background};border-color:${b.primary}66"><img src="${b.logo.replace('.avif','.webp')}" alt="${b.name}"><strong style="color:${b.accent}">${b.name}</strong><div><span style="background:${b.background}"></span><span style="background:${b.primary}"></span><span style="background:${b.secondary}"></span></div></article>`}).join('');
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1200,height:1000},deviceScaleFactor:1});
 await page.route('**/*',async route=>{const pathname=new URL(route.request().url()).pathname;if(pathname==='/')return route.fulfill({contentType:'text/html',body:`<html><head><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#07090e;color:white;font-family:system-ui}main{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}article{height:205px;border:1px solid;border-radius:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:18px}img{width:90%;height:85px;object-fit:contain}strong{font-size:16px}article div{display:flex;gap:8px}span{display:block;width:24px;height:24px;border:1px solid #ffffff44;border-radius:50%}</style></head><body><main>${cards}</main></body></html>`});return route.fulfill({body:await readFile(path.join(root,'public',pathname)),contentType:'image/webp'})});
 await page.goto('https://fixture.test/');await page.waitForFunction(()=>[...document.images].every(img=>img.complete&&img.naturalWidth>0));
 await page.screenshot({path:path.join(root,'docs/validation/skin-brand-preview-20261030.png'),fullPage:true});
}finally{await browser.close()}
console.log(JSON.stringify({checks:checks.length,productionWrites:0,preview:'multi-skin-gateway/docs/validation/skin-brand-preview-20261030.png'}));
