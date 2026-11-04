// Versioned scripts are public, config-free and retained across releases so a
// cached landing can still retrieve the exact program it was rendered with.
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(path.join(root,'frontend/package.json'));
const {build}=require('esbuild');
const bundle=await build({absWorkingDir:path.join(root,'frontend'),entryPoints:['components/public-landing/template7FastRuntime.ts'],bundle:true,write:false,platform:'node',format:'cjs',target:'es2020',jsx:'automatic',external:['react','react/jsx-runtime']});
const loaded={exports:{}};
new Function('module','exports','require',bundle.outputFiles[0].text)(loaded,loaded.exports,require);
const registry={};
const write=process.argv.includes('--write');
const output=path.join(root,'frontend/public/public-assets/template-entry');
if(write)await mkdir(output,{recursive:true});
for(const template of [7,8])for(const classic of [false,true]){
  const variant=`t${template}-${classic?'classic':'builder'}`;
  const source=loaded.exports.buildTemplate7FastRuntime('',{layout:{template}},classic?'function getOrCreateDeviceId(){return window.__TEMPLATE7_GET_DEVICE_ID__();}':'',false).replace(/^[\t ]+$/gm,'');
  const name=`${variant}-${createHash('sha256').update(source).digest('hex').slice(0,24)}.js`;
  registry[variant]={name,source};
  const file=path.join(output,name);
  if(write)await writeFile(file,source);else if(await readFile(file,'utf8')!==source)throw Error('Stale runtime asset: '+name);
}
const manifest=JSON.stringify(registry,null,2)+'\n';
const file=path.join(root,'frontend/components/public-landing/template7RuntimeAssets.generated.json');
if(write)await writeFile(file,manifest);else if(await readFile(file,'utf8')!==manifest)throw Error('Stale runtime registry; regenerate before release');

// Templates 1-6 also need a new URL whenever their program changes. A fixed
// immutable /landing-runtime-v6.js can otherwise survive many deployments.
// Keep this bundle separate so its exports cannot alter the T7/T8 programs.
const publicBundle=await build({absWorkingDir:path.join(root,'frontend'),entryPoints:['components/public-landing/PublicLandingRuntimeScript.tsx'],bundle:true,write:false,platform:'node',format:'cjs',target:'es2020',jsx:'automatic',external:['react','react/jsx-runtime']});
const publicLoaded={exports:{}};
new Function('module','exports','require',publicBundle.outputFiles[0].text)(publicLoaded,publicLoaded.exports,require);
const publicSource=publicLoaded.exports.buildPublicLandingRuntimeSource().replace(/^[\t ]+$/gm,'').trimEnd()+'\n';
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
console.log(`${write?'Generated':'Verified'} five content-addressed landing runtimes; previous public assets retained.`);
