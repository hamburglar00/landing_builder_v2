import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {gzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const root=fileURLToPath(new URL('../',import.meta.url));
const frontend=path.join(root,'frontend');
const baselineRef=process.env.ENTRY_BASELINE||'598f531cbfc8cf8447ca6e1cf69eb41b62ee1eef';
const require=createRequire(path.join(frontend,'package.json'));
const {build}=require('esbuild');
Object.assign(process.env,{NEXT_PUBLIC_SUPABASE_URL:'https://fixture.supabase.co',NEXT_PUBLIC_SUPABASE_ANON_KEY:'public-fixture',INTERNAL_CHAT_ORIGIN:'https://chat.invalid',GANAMOS_NET_GATEWAY_ORIGIN:'https://net.invalid'});
async function load(baseline){
 const result=await build({absWorkingDir:frontend,stdin:{contents:'export {renderPublicLandingHtml,renderClassicTemplate7InlineHtml} from "./components/public-landing/renderPublicLandingHtml";',resolveDir:frontend,loader:'ts'},bundle:true,write:false,platform:'node',format:'cjs',target:'es2020',jsx:'automatic',packages:'external',plugins:baseline?[{name:'committed-baseline',setup(plugin){plugin.onLoad({filter:/\.[cm]?[jt]sx?$/},args=>{if(!args.path.startsWith(frontend)||args.path.includes('node_modules'))return;const relative=path.relative(root,args.path).replaceAll('\\','/');return {contents:execFileSync('git',['show',baselineRef+':'+relative],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}),loader:args.path.endsWith('tsx')?'tsx':'ts'};})}}]:[]});
 const mod={exports:{}};new Function('module','exports','require',result.outputFiles[0].text)(mod,mod.exports,require);return mod.exports;
}
const baseline=await load(true),current=await load(false);
const result=[];
for(const template of [1,2,3,4,5,7,8])for(const classic of template>=7?[false,true]:[false]){
 const config={id:'a0000000-0000-4000-8000-000000000001',schemaVersion:1,updatedAt:'',comment:'',name:'Fixture',layout:{template,ctaPosition:'bottom'},tracking:{pixelId:'123456789',postUrl:'https://events.invalid/conversions',landingTag:'TEST',target_provider:'ganamos_net'},content:{logoUrl:'',title:['Creá tu cuenta'],subtitle:['Ingresá tu nombre'],ctaText:'CREAR USUARIO',template8:{cardCount:2,backgroundImageUrl:'',headerText:'Elegí',footerText:'',cards:[{imageUrl:'',text:'Plus',ctaText:'Elegir',targetProvider:'multi_skin',multiSkinCode:'ganamos_plus'},{imageUrl:'',text:'Bet30',ctaText:'Elegir',targetProvider:'multi_skin',multiSkinCode:'bet30'}]}}};
 const render=mod=>classic?mod.renderClassicTemplate7InlineHtml({slug:'fixture',config},'function getOrCreateDeviceId(){return "a0000000-0000-4000-8000-000000000009";}'):mod.renderPublicLandingHtml({slug:'fixture',config});
 const before=render(baseline),after=render(current);
 const measure=html=>({html_bytes:Buffer.byteLength(html),html_gzip_bytes:gzipSync(html).length,inline_js_bytes:[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].reduce((sum,match)=>sum+Buffer.byteLength(match[1]),0)});
 const presentation=html=>html.replace(/<script(?:\s[^>]*)?>[\s\S]*?<\/script>/g,'');
 result.push({template,engine:classic?'classic':'builder',before:measure(before),after:measure(after),html_unchanged:template<=5?before===after:undefined,presentation_unchanged:template<=5?presentation(before)===presentation(after):undefined});
}
const assets=JSON.parse(fs.readFileSync(path.join(frontend,'components/public-landing/template7RuntimeAssets.generated.json'),'utf8'));
const cacheable_assets=Object.entries(assets).map(([variant,asset])=>({variant,name:asset.name,js_bytes:Buffer.byteLength(asset.source),js_gzip_bytes:gzipSync(asset.source).length}));
console.log(JSON.stringify({baseline:execFileSync('git',['rev-parse',baselineRef],{cwd:root,encoding:'utf8'}).trim(),kind:'same-fixture-generated-html-not-network-or-CPA',results:result,cacheable_assets},null,2));
