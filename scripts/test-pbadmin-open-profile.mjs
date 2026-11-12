import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(path.join(root,'frontend/package.json'));
const ts=require('typescript');
class AccessError extends Error {constructor(message,status=409){super(message);this.status=status;}}
for(const [provider,file] of [
  ['builder',path.join(root,'frontend/lib/pbadmin/accounts.server.ts')],
  ['atrio',path.join(root,'../internal-chat/src/lib/pbadmin/accounts.server.ts')],
]) {
  if(!fs.existsSync(file))continue;
  const tree=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
  const fn=tree.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='assertLinkedProfile');
  assert.ok(fn,'Existing identity preflight is required');
  const compiled=ts.transpileModule(fn.getText(tree).replace(/^export\s+/,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
  const verify=new Function('AccessError',compiled+';return assertLinkedProfile;')(AccessError);
  const fixture=({missingAuth=false,missingProfile=false,role='client',admin='admin-a',authError=null,profileError=null}={})=>{
    const user={id:'existing-id',email:'native@example.test',password:'fixture-only-native-password'};
    const profile={role,admin_id:admin};
    const db={auth:{admin:{getUserById:async()=>({data:{user:missingAuth?null:user},error:authError??(missingAuth?{status:404}:null)}),createUser(){assert.fail('Opening must never create Auth users');}}},from(table){assert.equal(table,'profiles');return{select(){return this;},eq(){return this;},maybeSingle:async()=>({data:missingProfile?null:profile,error:profileError}),insert(){assert.fail('Opening must never create profiles');}};}};
    return{db,user,profile};
  };
  test(`${provider}: existing native profile is accepted without changing credentials`,async()=>{
    const f=fixture(),before=JSON.stringify({user:f.user,profile:f.profile});
    await verify(f.db,'existing-id','client');
    assert.equal(JSON.stringify({user:f.user,profile:f.profile}),before);
  });
  for(const scenario of [
    ['deleted Auth identity',{missingAuth:true},409],
    ['deleted profile',{missingProfile:true},409],
    ['wrong role',{role:'admin'},409],
    ['Auth unavailable',{authError:{status:503}},503],
    ['profile unavailable',{profileError:{code:'network_error'}},503],
  ])test(`${provider}: ${scenario[0]} fails closed`,async()=>{
    const f=fixture(scenario[1]);await assert.rejects(verify(f.db,'existing-id','client'),e=>e instanceof AccessError&&e.status===scenario[2]);
  });
  test(`${provider}: an advisor must retain the same administration`,async()=>{
    const f=fixture({role:'advisor'});await verify(f.db,'existing-id','advisor','admin-a');
    await assert.rejects(verify(f.db,'existing-id','advisor','admin-b'),e=>e instanceof AccessError&&e.status===409);
  });
}
