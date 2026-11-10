// Real public renderer/editor preview, static DOM and blocked network. No tracking or account actions.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url)),frontend=path.join(root,'frontend');
const require=createRequire(path.join(frontend,'package.json'));
const {build}=require('esbuild'),{chromium,webkit}=require('playwright');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const postcss=require('postcss'),tailwind=require('@tailwindcss/postcss');
const output=path.join(root,'.vercel/cta-typography-20261110');await mkdir(output,{recursive:true});
const classicRoot=path.resolve(root,'../landing-prueba-1');
// Last production commits before this visual change; override to compare a different release.
const builderRef=process.env.CTA_BUILDER_BASELINE||'164ae84';
const classicRef=process.env.CTA_CLASSIC_BASELINE||'3509175';
const sourceCache=new Map();
function sourceAt(directory,ref,file){
 const key=`${directory}/${ref}/${file}`;
 if(!sourceCache.has(key))sourceCache.set(key,execFileSync('git',['show',`${ref}:${file}`],{cwd:directory,encoding:'utf8',maxBuffer:8*1024*1024}));
 return sourceCache.get(key);
}
const evaluateBundle=(source,loader=require)=>{const module={exports:{}};new Function('module','exports','require',source)(module,module.exports,loader);return module.exports;};
const classicRequire=createRequire(path.join(classicRoot,'package.json'));
const classicNow=classicRequire('./lib/template7/shared.cjs');
const classicBefore=evaluateBundle(sourceAt(classicRoot,classicRef,'lib/template7/shared.cjs'),classicRequire);
const kinds=['public','classic','preview'];
async function renderer(ref){
 const bundle=await build({absWorkingDir:frontend,stdin:{contents:`
 export {PUBLIC_LANDING_CSS} from './components/public-landing/publicLandingCss';
 export {renderPublicLandingHtml} from './components/public-landing/renderPublicLandingHtml';
 export {LandingPreview} from './components/landing/LandingPreview';
 export {DEFAULT_CONFIG} from './lib/landing/mocks';
 export {buildLandingConfig} from './lib/landing/buildLandingConfig';`,resolveDir:frontend,loader:'tsx'},
 bundle:true,write:false,platform:'node',format:'cjs',target:'es2020',jsx:'automatic',packages:'external',
 plugins:ref?[{name:'before-cta-change',setup(b){b.onLoad({filter:/[\\/]components[\\/](?:public-landing[\\/]publicLandingCss\.ts|landing[\\/]LandingPreview\.tsx)$/},args=>({contents:sourceAt(root,ref,path.relative(root,args.path).replaceAll('\\','/')),loader:'tsx'}));}}]:[]});
 const previewSource=ref?sourceAt(root,ref,'frontend/components/landing/LandingPreview.tsx'):readFileSync(path.join(frontend,'components/landing/LandingPreview.tsx'),'utf8');
 const previewFile=path.join(output,ref?'baseline-preview.tsx':'current-preview.tsx');await writeFile(previewFile,previewSource);
 const previewCss=(await postcss([tailwind()]).process(`@import "tailwindcss" source(none); @source "${previewFile.replaceAll('\\','/')}";`,
  {from:path.join(frontend,'cta-preview-test.css')})).css;
 return {...evaluateBundle(bundle.outputFiles[0].text),previewCss};
}
const current=await renderer(),previous=await renderer(builderRef);
const {DEFAULT_CONFIG,buildLandingConfig}=current;
const disableMotion='*,*::before,*::after{animation:none!important;transition:none!important}';
const viewports=[[320,568],[360,640],[390,844],[768,1024],[1280,800],[844,390]];
const baseline={};
const observations=[];
function theme(template,label){return {...structuredClone(DEFAULT_CONFIG),template:`template${template}`,ctaText:label||'Acceder',ctaFontSize:22,
  template6Cover:{...DEFAULT_CONFIG.template6Cover,grid:'2x3',showWhatsAppLogo:true,
    cards:Array.from({length:6},(_,i)=>({imageUrl:'',text:`Opcion ${i+1}`,ctaText:label||'Acceder'}))}};}
function documentHtml(template,kind,label,before=false){
 const {LandingPreview,previewCss,PUBLIC_LANDING_CSS,renderPublicLandingHtml}=before?previous:current;
 const config=theme(template,label);
 if(kind==='preview')return '<!doctype html><html><head><meta charset="utf-8"><style>'+previewCss+disableMotion+
  'html,body{margin:0}#fixture{width:min(360px,100vw);height:640px;margin:auto}</style></head><body><div id="fixture">'+
  renderToStaticMarkup(React.createElement(LandingPreview,{config,compact:true}))+'</div></body></html>';
 const published=buildLandingConfig({id:'fixture',name:'Asesor',comment:'',pixelId:'',postUrl:'https://fixture.invalid/conversions',landingTag:'',config});
 if(kind==='classic')return (before?classicBefore:classicNow).renderClassicPublicLandingHtml({slug:'fixture',config:published},'function getOrCreateDeviceId(){return "fixture";}')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'')
  .replace(/<link\b[^>]*rel="stylesheet"[^>]*>/gi,tag=>{
   const asset=tag.match(/\/public-assets\/template-entry\/(landing-[a-f0-9]+\.css)/)?.[1];
   return asset?'<style>'+(before?sourceAt(classicRoot,classicRef,`public/public-assets/template-entry/${asset}`):readFileSync(path.join(classicRoot,'public/public-assets/template-entry',asset),'utf8'))+'</style>':'';
  }).replace('</head>','<style>'+disableMotion+'</style></head>');
 return renderPublicLandingHtml({slug:'fixture',config:published}).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'')
  .replace(/<link\b[^>]*rel="stylesheet"[^>]*>/gi,'').replace('</head>','<style>'+PUBLIC_LANDING_CSS+disableMotion+'</style></head>');
}
async function inspect(page,template,kind,label){
 if(kind!=='preview'&&label&&template===5)await page.locator('[data-public-landing-cta-label]').evaluateAll((nodes,text)=>nodes.forEach(n=>n.textContent=text),label);
 return page.evaluate(({template,kind})=>{
  const nodes=kind!=='preview'?[...document.querySelectorAll(`.template${template===8?6:template}__cta`)]:template===6||template===8?
    [...document.querySelectorAll('#fixture span.min-w-0.truncate')].map(n=>n.parentElement):[...document.querySelectorAll('#fixture button')];
  return nodes.map(button=>{
   let span=button.querySelector('span');
   if(!span){span=document.createElement('span');for(const n of [...button.childNodes])if(n.nodeType===Node.TEXT_NODE)span.append(n);button.append(span);}
   const b=button.getBoundingClientRect(),s=span.getBoundingClientRect(),icon=button.querySelector('svg'),svg=icon?.getBoundingClientRect();
   const style=getComputedStyle(span),bs=getComputedStyle(button),iconStyle=icon?getComputedStyle(icon.querySelector('path:last-of-type')):null,
    rect=r=>r?{x:r.x,y:r.y,width:r.width,height:r.height}:null;
   return {button:rect(b),label:rect(s),icon:rect(svg),fontSize:parseFloat(style.fontSize),weight:Number(style.fontWeight),
     fontFamily:style.fontFamily,lineHeight:style.lineHeight,buttonScroll:button.scrollWidth,buttonClient:button.clientWidth,
     textClipped:span.scrollWidth>span.clientWidth+1,overflowX:style.overflowX,textOverflow:style.textOverflow,
     buttonMinHeight:bs.minHeight,text:span.textContent,iconStroke:iconStyle?.stroke,iconStrokeWidth:iconStyle?parseFloat(iconStyle.strokeWidth):null};
  });
 },{template,kind});
}
for(const [engine,type] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await type.launch({headless:true});
 try{
  const page=await browser.newPage();await page.route('**/*',route=>route.abort());
  for(const [width,height] of viewports)for(const template of [4,5,6,8])for(const kind of kinds){
   await page.setViewportSize({width,height});
   const key=`${engine}/${width}x${height}/t${template}/${kind}`;
   await page.setContent(documentHtml(template,kind,undefined,true),{waitUntil:'domcontentloaded'});
   const before=await inspect(page,template,kind);baseline[key]=before;
   await page.setContent(documentHtml(template,kind),{waitUntil:'domcontentloaded'});
   const data=await inspect(page,template,kind);
   assert.ok(data.length>0,key+' contains CTAs');
   assert.ok(before,key+' has baseline');assert.equal(data.length,before.length);
   for(let i=0;i<data.length;i++){
    const c=data[i],b=before[i];
    assert.ok(Math.abs(c.button.width-b.button.width)<.6,key+' keeps button width');
    assert.ok(Math.abs(c.button.height-b.button.height)<.6,key+' keeps button height');
    if(template===8){assert.equal(c.fontSize,b.fontSize,key+' unchanged T8 font');assert.equal(c.weight,b.weight,key+' unchanged T8 weight');}
    else {assert.ok(c.weight>=800,key+' bold label');assert.ok(c.fontSize>b.fontSize,key+' larger label');
     assert.ok(!c.textClipped,key+' default label stays readable');
     assert.ok(c.label.x>=c.button.x-1&&c.label.x+c.label.width<=c.button.x+c.button.width+1,key+' label stays inside');
     assert.ok(c.label.y>=c.button.y-1&&c.label.y+c.label.height<=c.button.y+c.button.height+1,key+' vertical label stays inside');
     assert.ok(c.buttonScroll<=c.buttonClient+1,key+' button has no horizontal overflow');
     if(c.icon){assert.ok(c.icon.width>b.icon.width,key+' larger WhatsApp icon');assert.equal(c.icon.width,template===6?24:32,key+' final icon size');
      assert.equal(c.iconStroke,'rgb(255, 255, 255)',key+' white reinforced outline');assert.ok(Math.abs(c.iconStrokeWidth-.6)<.01,key+' thicker outline');
      assert.ok(c.icon.y>=c.button.y-1&&c.icon.y+c.icon.height<=c.button.y+c.button.height+1,key+' icon stays inside');}
    }
   }
   observations.push({key,data});
   if(engine==='chromium'&&width===390&&kind==='public'&&template!==8)await page.screenshot({path:path.join(output,`template${template}-390.png`),fullPage:true});
  }
  for(const [width,height] of [[320,568],[390,844]])for(const template of [4,5,6])for(const kind of kinds)for(const label of ['Pedi tu usuario y habla con tu asesor ahora mismo','W'.repeat(180)]){
   await page.setViewportSize({width,height});await page.setContent(documentHtml(template,kind,label),{waitUntil:'domcontentloaded'});
   if(kind==='preview'&&template===5)await page.locator('#fixture button').evaluate((b,text)=>{
    const span=b.querySelector('span');if(span)span.textContent=text;
   },label);
   const data=await inspect(page,template,kind,label),key=`${engine}/${width}x${height}/t${template}/${kind}/long`;
   for(const c of data){const old=baseline[`${engine}/${width}x${height}/t${template}/${kind}`][0];
    assert.ok(Math.abs(c.button.width-old.button.width)<.6&&Math.abs(c.button.height-old.button.height)<.6,key+' long label preserves button size');
    assert.ok(c.buttonScroll<=c.buttonClient+1,key+' long label never overflows button');
    assert.ok(c.label.x>=c.button.x-1&&c.label.x+c.label.width<=c.button.x+c.button.width+1,key+' long label stays inside');
    assert.ok(!c.textClipped||c.overflowX==='hidden'&&c.textOverflow==='ellipsis',key+' oversized text has safe ellipsis');
   }
   observations.push({key,data});
  }
 }finally{await browser.close();}
}
await writeFile(path.join(output,'baseline.json'),JSON.stringify(baseline,null,2));
await writeFile(path.join(output,'results.json'),JSON.stringify(observations,null,2));
console.log(JSON.stringify({cases:observations.length,baselines:{builderRef,classicRef},browsers:['chromium','webkit'],network:'blocked',buttonDimensions:'unchanged',artifacts:output},null,2));
