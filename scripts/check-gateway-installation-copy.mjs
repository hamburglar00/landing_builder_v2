import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import{createRequire}from'node:module';
import vm from 'node:vm';
const require=createRequire(new URL('../../internal-chat/package.json',import.meta.url));
const ts=require('typescript');let count=0;
const sql=await readFile(new URL('../../internal-chat/supabase/migrations/20261009024817_refine_ios_installation_copy.sql',import.meta.url),'utf8');
const sections=sql.split('instruction_content := case resolved_platform')[1].split('end;')[0];
function sqlCopy(platform){const block=platform==='ios'?sections.split("when 'ios' then")[1].split("when 'android'")[0]:platform==='android'?sections.split("when 'android' then")[1].split('else')[0]:sections.split('else')[1];return[...block.matchAll(/'((?:[^']|'')*)'|chr\(10\)/g)].map(m=>m[0]==='chr(10)'?'\n':m[1].replaceAll("''","'")).join('')}
for(const repo of ['landing-autologuin','ases-gateway','ganamos-gateway','multi-skin-gateway']){
 const sdk=await readFile(new URL(`../../${repo}/public/gateway-app-sdk.js`,import.meta.url),'utf8');
 const window={addEventListener(){},matchMedia:()=>({matches:false})};vm.runInNewContext(sdk,{window,navigator:{userAgent:'fixture'},setTimeout});
 const source=await readFile(new URL(`../../${repo}/public/gateway-client.js`,import.meta.url),'utf8'),ast=ts.createSourceFile('client.js',source,ts.ScriptTarget.Latest,true);let fn;
 function visit(node){if(ts.isFunctionDeclaration(node)&&node.name?.text==='showInstallNotice')fn=node;ts.forEachChild(node,visit)}visit(ast);assert.ok(fn);
 for(const platform of ['ios','android','desktop']){
  const body=window.GatewayApp.installationInstructions(platform);assert.equal(body,sqlCopy(platform));
  const notices=[];const bindings={appFeaturesInitialized:true,standalone:false,app:{...window.GatewayApp,canInstall:()=>false},invitationStorageKey:invitation=>invitation.id,storageGet:()=>null,localStorage:{},platform:()=>platform,createNotice:value=>notices.push(value),notice:{dataset:{}}};
  const code=ts.transpileModule(fn.getText(ast)+';return showInstallNotice',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
  const show=new Function(...Object.keys(bindings),code)(...Object.values(bindings));
  await show(false);await show(true,{id:'invitation-fixture',title:'INSTALAR',body});
  assert.equal(notices.length,2);for(const field of ['title','body','hint','primaryLabel'])assert.equal(notices[0][field],notices[1][field]);
  assert.ok(!notices[0].body.includes('de forma rapida y segura'));count++;
 }
}
console.log(JSON.stringify({passed:count,providers:4,platforms:3,sameAsInvitation:true}));
