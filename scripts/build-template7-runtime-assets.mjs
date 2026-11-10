// Versioned scripts are public, config-free and retained across releases so a
// cached landing can still retrieve the exact program it was rendered with.
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(path.join(root,'frontend/package.json'));
const {build,transform}=require('esbuild');
// Minify the finished browser program, never the generator: it serializes
// functions and applies compatibility transforms before this step.
const minify = async source => (await transform(source, { minify: true, target: 'es2020', legalComments: 'none' })).code;
const bundle=await build({absWorkingDir:path.join(root,'frontend'),entryPoints:['components/public-landing/template7FastRuntime.ts'],bundle:true,write:false,platform:'node',format:'cjs',target:'es2020',jsx:'automatic',external:['react','react/jsx-runtime']});
const loaded={exports:{}};
new Function('module','exports','require',bundle.outputFiles[0].text)(loaded,loaded.exports,require);
const registry={};
const write=process.argv.includes('--write');
const output=path.join(root,'frontend/public/public-assets/template-entry');
if(write)await mkdir(output,{recursive:true});
for(const template of [7,8])for(const classic of [false,true]){
  const variant=`t${template}-${classic?'classic':'builder'}`;
  const source=await minify(loaded.exports.buildTemplate7FastRuntime('',{layout:{template}},classic?'function getOrCreateDeviceId(){return window.__TEMPLATE7_GET_DEVICE_ID__();}':'',false));
  const name=`${variant}-${createHash('sha256').update(source).digest('hex').slice(0,24)}.js`;
  registry[variant]={name,source};
  const file=path.join(output,name);
  if(write)await writeFile(file,source);else if(await readFile(file,'utf8')!==source)throw Error('Stale runtime asset: '+name);
}
const manifest=JSON.stringify(registry,null,2)+'\n';
const file=path.join(root,'frontend/components/public-landing/template7RuntimeAssets.generated.json');
if(write)await writeFile(file,manifest);else if(await readFile(file,'utf8')!==manifest)throw Error('Stale runtime registry; regenerate before release');
const names=JSON.stringify(Object.fromEntries(Object.entries(registry).map(([key,{name}])=>[key,{name}])),null,2)+'\n';
const namesFile=path.join(root,'frontend/components/public-landing/template7RuntimeNames.generated.json');
if(write)await writeFile(namesFile,names);else if(await readFile(namesFile,'utf8')!==names)throw Error('Stale runtime names; regenerate before release');

// Templates 1-6 also need a new URL whenever their program changes. A fixed
// immutable /landing-runtime-v6.js can otherwise survive many deployments.
// Keep this bundle separate so its exports cannot alter the T7/T8 programs.
const publicBundle=await build({absWorkingDir:path.join(root,'frontend'),entryPoints:['components/public-landing/PublicLandingRuntimeScript.tsx'],bundle:true,write:false,platform:'node',format:'cjs',target:'es2020',jsx:'automatic',external:['react','react/jsx-runtime']});
const publicLoaded={exports:{}};
new Function('module','exports','require',publicBundle.outputFiles[0].text)(publicLoaded,publicLoaded.exports,require);
const publicSource=await minify(publicLoaded.exports.buildPublicLandingRuntimeSource());
const publicName=`landing-${createHash('sha256').update(publicSource).digest('hex').slice(0,24)}.js`;
const publicFile=path.join(output,publicName);
const publicManifest=JSON.stringify({name:publicName},null,2)+'\n';
const publicManifestFile=path.join(root,'frontend/components/public-landing/publicLandingRuntimeAsset.generated.json');
if(write){
  await writeFile(publicFile,publicSource);
  await writeFile(publicManifestFile,publicManifest);
}else{
  if(await readFile(publicFile,'utf8')!==publicSource)throw Error('Stale public landing runtime asset: '+publicName);
  if(await readFile(publicManifestFile,'utf8')!==publicManifest)throw Error('Stale public landing runtime registry; regenerate before release');
}
const cssBundle=await build({absWorkingDir:path.join(root,'frontend'),entryPoints:['components/public-landing/publicLandingCss.ts'],bundle:true,write:false,platform:'node',format:'cjs',target:'es2020'});
const cssLoaded={exports:{}};
new Function('module','exports','require',cssBundle.outputFiles[0].text)(cssLoaded,cssLoaded.exports,require);
const cssSource=(await transform(cssLoaded.exports.PUBLIC_LANDING_CSS,{loader:'css',minify:true,legalComments:'none'})).code;
const cssName=`landing-${createHash('sha256').update(cssSource).digest('hex').slice(0,24)}.css`;
const cssFile=path.join(output,cssName);
const cssManifestFile=path.join(root,'frontend/components/public-landing/publicLandingStyleAsset.generated.json');
const cssManifest=JSON.stringify({name:cssName},null,2)+'\n';
if(write){await writeFile(cssFile,cssSource);await writeFile(cssManifestFile,cssManifest);}
else if(await readFile(cssFile,'utf8')!==cssSource||await readFile(cssManifestFile,'utf8')!==cssManifest)throw Error('Stale landing styles; regenerate before release');
console.log(`${write?'Generated':'Verified'} five content-addressed landing runtimes and styles; previous public assets retained.`);
