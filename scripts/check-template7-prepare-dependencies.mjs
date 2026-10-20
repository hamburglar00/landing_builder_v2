import assert from 'node:assert/strict';import{createRequire}from'node:module';import{fileURLToPath}from'node:url';
const req=createRequire(new URL('../frontend/package.json',import.meta.url)),{build}=req('esbuild');
const root=fileURLToPath(new URL('../frontend/',import.meta.url));
const result=await build({absWorkingDir:root,entryPoints:['app/api/template7/prepare/route.ts'],bundle:true,write:false,platform:'node',format:'esm',packages:'external',metafile:true,tsconfig:'tsconfig.json'});
const forbidden=Object.keys(result.metafile.inputs).filter(p=>/start\.server|preparation\.server|integrations\.server|rateLimit\.server|supabase/i.test(p));
assert.deepEqual(forbidden,[],'Issuing a transition token must not load account creation or DB clients');
assert.equal(result.metafile.outputs['route.js'].imports.some(i=>i.path.includes('supabase')),false);
console.log(JSON.stringify({passed:true,inputModules:Object.keys(result.metafile.inputs).length,outputBytes:result.outputFiles[0].contents.length,accountOrDatabaseModules:0}));
