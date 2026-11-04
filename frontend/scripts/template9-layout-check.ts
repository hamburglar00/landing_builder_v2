// Real CSS and renderer, local assets, no tracking/account/provider requests.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import * as localPlaywright from 'playwright';
import {renderTemplate9View,TEMPLATE9_UI_SCRIPT} from '../components/public-landing/template9View';
import {TEMPLATE9_CSS} from '../components/public-landing/template9Css';
import {PUBLIC_LANDING_CSS} from '../components/public-landing/publicLandingCss';
import {DEFAULT_CONFIG} from '../lib/landing/mocks';
import {switchLandingTemplate} from '../lib/landing/templateVariants';
import {buildLandingConfig} from '../lib/landing/buildLandingConfig';
import type {TargetProvider} from '../lib/landing/types';

const directory=process.env.TEMPLATE9_ARTIFACT_DIR || path.resolve('../docs/validation/template9-layout-20261104');
let playwright=localPlaywright;
try{playwright=createRequire(path.resolve('package.json'))(path.join(process.env.APPDATA||'','npm/node_modules/playwright'))}catch{}
async function main(){
await mkdir(directory,{recursive:true});
const sizes=[{width:320,height:568},{width:360,height:640},{width:375,height:667},{width:390,height:664},{width:390,height:844},{width:430,height:932},{width:844,height:390}];
const checks:unknown[]=[];
for(const [name,engine]of [['Chromium',playwright.chromium],['WebKit',playwright.webkit]] as const){
  const browser=await engine.launch({headless:true});
  try{
    const context=await browser.newContext();
    try{
      await context.addInitScript(()=>localStorage.removeItem('template9:cookie-notice:v1'));
      const page=await context.newPage();
      let html='';
      await page.route('**/*',async route=>{
        const u=new URL(route.request().url());
        if(u.origin!=='https://layout.invalid'||route.request().method()!=='GET')throw Error('Unexpected network request');
        if(/^\/public-assets\/template9\/[a-z_0-9]+\.webp$/.test(u.pathname))return route.fulfill({contentType:'image/webp',body:await readFile(path.resolve('public','.'+u.pathname))});
        return route.fulfill({contentType:'text/html',body:html});
      });
      for(const provider of ['rey_de_ases','ases_del_norte','ganamos_net','multi_skin'] as TargetProvider[])for(const whatsapp of [false,true])for(const viewport of sizes){
        const label=`${name} ${provider} ${viewport.width}x${viewport.height} whatsapp=${whatsapp}`;
        await page.setViewportSize(viewport);
        const config=buildLandingConfig({id:'a0000000-0000-4000-8000-000000000001',name:'layout',comment:'',pixelId:'',postUrl:'',landingTag:'',config:{...switchLandingTemplate(DEFAULT_CONFIG,'template9'),targetProvider:provider,template7WhatsappEnabled:whatsapp}});
        html=`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${PUBLIC_LANDING_CSS}${TEMPLATE9_CSS}</style></head><body>${renderTemplate9View({...config,layout:{...config.layout,ctaPosition:'bottom'}})}${TEMPLATE9_UI_SCRIPT}</body></html>`;
        await page.goto('https://layout.invalid/fixture');
        await page.locator('.template9__card').evaluate(el=>el.getAnimations().forEach(a=>a.finish()));
        await page.locator('.template9__logo').evaluate((img:HTMLImageElement)=>img.decode());
        const metrics=await page.evaluate(()=>{
          const root=document.querySelector<HTMLElement>('.template9')!,wrap=document.querySelector<HTMLElement>('.template9__wrap')!,footer=document.querySelector('.template9__footer')!,notice=document.querySelector('.template9__cookies')!,cta=document.querySelector('.template9__cta')!;
          return {rootOverflowX:root.scrollWidth-root.clientWidth,wrapOverflowX:wrap.scrollWidth-wrap.clientWidth,wrapOverflowY:wrap.scrollHeight-wrap.clientHeight,documentOverflowY:document.documentElement.scrollHeight-innerHeight,footerBottom:footer.getBoundingClientRect().bottom,noticeTop:notice.getBoundingClientRect().top,ctaTop:cta.getBoundingClientRect().top,ctaBottom:cta.getBoundingClientRect().bottom,ctaColor:getComputedStyle(cta).color};
        });
        assert.ok(metrics.rootOverflowX<=1&&metrics.wrapOverflowX<=1,`${label}: horizontal overflow ${JSON.stringify(metrics)}`);
        assert.ok(metrics.wrapOverflowY<=1&&metrics.documentOverflowY<=1,`${label}: vertical overflow ${JSON.stringify(metrics)}`);
        assert.ok(metrics.footerBottom<=metrics.noticeTop+1,`${label}: cookie overlap ${JSON.stringify(metrics)}`);
        assert.ok(metrics.ctaTop>=0&&metrics.ctaBottom<=viewport.height,`${label}: CTA outside viewport`);
        if(provider==='rey_de_ases'||provider==='ases_del_norte')assert.equal(metrics.ctaColor,'rgb(18, 18, 18)',`${label}: readable metal button`);
        if(name==='Chromium'&&!whatsapp&&viewport.width===390&&viewport.height===844)await page.screenshot({path:path.join(directory,`${provider}-390.png`)});
        if(name==='Chromium'&&whatsapp&&viewport.width===320)await page.screenshot({path:path.join(directory,`${provider}-320-phone.png`)});
        await page.locator('[data-template9-cookie-dismiss]').click();
        assert.equal(await page.locator('[data-template9-cookie-notice]').isVisible(),false);
        assert.ok(await page.locator('.template9__wrap').evaluate(el=>el.scrollHeight-el.clientHeight<=1),`${label}: overflow after dismissal`);
        if(viewport.width===390&&viewport.height===844){
          await page.locator('[data-template7-name]').focus();await page.setViewportSize({width:390,height:360});
          await page.locator('.template9__cta').scrollIntoViewIfNeeded();
          const box=await page.locator('.template9__cta').boundingBox();assert.ok(box&&box.y>=0&&box.y+box.height<=360,`${label}: keyboard recovery`);
        }
        checks.push({browser:name,provider,whatsapp,viewport,metrics});
      }
    }finally{await context.close()}
  }finally{await browser.close()}
}
await writeFile(path.join(directory,'layout-results.json'),JSON.stringify({passed:checks.length,checks},null,2));
console.log(JSON.stringify({passed:checks.length,directory}));
}
main().catch(error=>{console.error(error);process.exitCode=1});
