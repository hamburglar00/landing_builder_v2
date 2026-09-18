// Diagnostic evidence only. Does not edit application, migrations, or existing tests/reports.
// Rebuilds two disposable databases; replays only the failing Auth deletion and role probes.
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import childProcess from 'node:child_process';
import {syncBuiltinESMExports} from 'node:module';
import assert from 'node:assert/strict';
import {root} from '../../../scripts/phase0/local-runtime.mjs';
import {hash,assertSafeEnvironment,validateManifest} from '../../../scripts/phase0/bootstrap-manifest.mjs';
import {createBootstrapDatabase} from '../../../scripts/phase0/bootstrap-runtime.mjs';
import {compatibilitySources,applyCompatibility} from '../../../scripts/phase0/bootstrap-compatibility.mjs';
import {alignNativePgNet} from '../../../scripts/phase0/bootstrap-net.mjs';
import {fixture,ids} from '../../../scripts/security/profile-security-tests.mjs';

assertSafeEnvironment();
const base='ba7b3d3f5e60eb0c2cb907a8c281d4462e15d4bb';
const folder=join(root,'docs/security/phase-1b1');
const initialReview=JSON.parse(readFileSync(join(folder,'review.json')));
const protectedFiles=[...initialReview.inventory.modified,...initialReview.inventory.new].sort();
assert.equal(protectedFiles.length,16);
const frozen=protectedFiles.map(file=>({file,sha256:hash(readFileSync(join(root,file)))}));
const envHash=hash(readFileSync(join(root,'.env')));
const {entries,sources}=validateManifest();
const compatibility=compatibilitySources();
const report={kind:'Auth deletion diagnostic; no remediation',base,protectedArtifacts:frozen,remoteOperations:0,runs:[],complete:false};
const save=()=>writeFileSync(join(folder,'auth-delete-diagnostic.json'),JSON.stringify(report,null,2)+'\n');
const originalSpawn=childProcess.spawnSync;
let cleanupTrace=null;
const sanitize=text=>String(text??'')
  .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[redacted-jwt]')
  .replace(/Bearer\s+[A-Za-z0-9._-]{16,}/gi,'Bearer [redacted]')
  .replace(/\b(?:sb_secret_|sb_publishable_)[A-Za-z0-9_-]+/g,'[redacted-key]')
  .replace(/[A-Z]:[\\/]Users[\\/][^\s"')]+/gi,'[local-path]');
// Observe cleanup command failures without changing behavior or exposing docker inspect env.
childProcess.spawnSync=function(cmd,args,options){
  const r=originalSpawn.call(this,cmd,args,options);
  if(cleanupTrace&&cmd==='docker'&&(args[0]==='rm'||(['volume','network'].includes(args[0])&&args[1]!=='inspect')))
    cleanupTrace.push({args,exit:r.status,error:sanitize(r.stderr).trim(),output:sanitize(r.stdout).trim()});
  return r;
};
syncBuiltinESMExports();
const docker=args=>{
  const r=childProcess.spawnSync('docker',args,{encoding:'utf8',windowsHide:true,timeout:30000});
  if(r.status!==0)throw Error('Docker metadata command failed');return r.stdout;
};
const gitBytes=path=>{
  const r=originalSpawn('git',['show',`${base}:${path}`],{cwd:root,maxBuffer:32*1024*1024,windowsHide:true});
  if(r.status!==0)throw Error('HEAD source unavailable');return r.stdout;
};
assert.equal(originalSpawn('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).stdout.trim(),base);
const normal=bytes=>bytes.toString().replace(/\r\n/g,'\n');
for(const e of entries.slice(0,268))assert.equal(normal(gitBytes('supabase/migrations/'+e.file)),normal(sources.get(e.file)));
report.historicalSourcesMatchHead={count:268,comparison:'byte content with CRLF normalized to LF only; validated original manifest hashes separately'};

function resources(){
  return Object.fromEntries([['containers',['ps','-aq']],['networks',['network','ls','-q']],['volumes',['volume','ls','-q']]].map(([k,args])=>[k,docker(args).trim().split(/\r?\n/).filter(Boolean).sort()]));
}
const overallBefore=resources();report.resourcesBefore=overallBefore;
const state=stage=>`SELECT jsonb_build_object('stage','${stage}','current_user',current_user,'session_user',session_user,'active_role',current_setting('role'),'claim_sub',current_setting('request.jwt.claim.sub',true),'claims',nullif(current_setting('request.jwt.claims',true),'')::jsonb);`;
const transaction=body=>`BEGIN; SET LOCAL statement_timeout='10s';\n${fixture}\n${body}\nROLLBACK;`;
const deleteSql=`DELETE FROM auth.users WHERE id='${ids.client}';`;
const absence=`SELECT jsonb_build_object('stage','after_delete','authAbsent',NOT EXISTS(SELECT FROM auth.users WHERE id='${ids.client}'),'profileAbsent',NOT EXISTS(SELECT FROM public.profiles WHERE id='${ids.client}'));`;

const catalogSql=`SELECT jsonb_build_object(
 'session',jsonb_build_object('current_user',current_user,'session_user',session_user,'role',current_setting('role')),
 'roles',(SELECT jsonb_agg(jsonb_build_object('name',rolname,'superuser',rolsuper,'bypassRls',rolbypassrls,'inherit',rolinherit,'login',rolcanlogin) ORDER BY rolname) FROM pg_roles WHERE rolname IN ('postgres','service_role','authenticated','supabase_auth_admin','supabase_admin')),
 'memberships',(SELECT jsonb_agg(jsonb_build_object('role',pg_get_userbyid(roleid),'member',pg_get_userbyid(member),'grantor',pg_get_userbyid(grantor),'admin',admin_option,'inherit',inherit_option,'set',set_option) ORDER BY roleid,member) FROM pg_auth_members WHERE roleid IN (SELECT oid FROM pg_roles WHERE rolname IN ('supabase_auth_admin','service_role','authenticated')) OR member=(SELECT oid FROM pg_roles WHERE rolname='postgres')),
 'canSetAuthAdmin',pg_has_role('postgres','supabase_auth_admin','SET'),
 'relations',(SELECT jsonb_agg(jsonb_build_object('table',c.oid::regclass::text,'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity,'acl',c.relacl) ORDER BY c.oid::regclass::text) FROM pg_class c WHERE c.oid IN ('auth.users'::regclass,'public.profiles'::regclass)),
 'effectivePrivileges',(SELECT jsonb_agg(jsonb_build_object('role',r,'table',t,'schemaUsage',has_schema_privilege(r,split_part(t,'.',1),'USAGE'),'select',has_table_privilege(r,t,'SELECT'),'delete',has_table_privilege(r,t,'DELETE')) ORDER BY r,t) FROM unnest(array['postgres','service_role','authenticated','supabase_auth_admin']) r CROSS JOIN unnest(array['auth.users','public.profiles']) t),
 'constraints',(SELECT jsonb_agg(jsonb_build_object('name',conname,'table',conrelid::regclass::text,'references',confrelid::regclass::text,'deleteAction',confdeltype,'definition',pg_get_constraintdef(oid)) ORDER BY conrelid::regclass::text,conname) FROM pg_constraint WHERE contype='f' AND (conrelid IN ('auth.users'::regclass,'public.profiles'::regclass) OR confrelid IN ('auth.users'::regclass,'public.profiles'::regclass))),
 'triggers',(SELECT jsonb_agg(jsonb_build_object('table',t.tgrelid::regclass::text,'name',t.tgname,'internal',t.tgisinternal,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid),'function',t.tgfoid::regprocedure::text,'functionOwner',pg_get_userbyid(p.proowner),'definer',p.prosecdef,'searchPath',p.proconfig,'source',CASE WHEN n.nspname='pg_catalog' THEN p.prosrc ELSE NULL END,'definitionMd5',md5(replace(pg_get_functiondef(p.oid),E'\\r',''))) ORDER BY t.tgrelid::regclass::text,t.tgname) FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace n ON n.oid=p.pronamespace WHERE t.tgrelid IN ('auth.users'::regclass,'public.profiles'::regclass)),
 'policies',(SELECT jsonb_agg(jsonb_build_object('schema',schemaname,'table',tablename,'name',policyname,'roles',roles,'command',cmd,'using',qual,'check',with_check) ORDER BY schemaname,tablename,policyname) FROM pg_policies WHERE (schemaname='auth' AND tablename='users') OR (schemaname='public' AND tablename='profiles'))
);`;

function probe(db,label,query,login='postgres'){
  const target=db.localApiTarget(); // Revalidate exact ownership, local daemon and internal network.
  assert.ok(['postgres','supabase_auth_admin'].includes(login));
  const result=childProcess.spawnSync('docker',['exec','-i',target.containerId,'psql','-X','-U',login,'-d','postgres','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-v','SHOW_CONTEXT=always','--echo-errors','-Atq'],{input:query,encoding:'utf8',windowsHide:true,timeout:20000,maxBuffer:1024*1024});
  const stdout=sanitize(result.stdout),stderr=sanitize(result.stderr);
  const traces=stdout.split(/\r?\n/).filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
  const rolledBack=db.sql(`SELECT NOT EXISTS(SELECT FROM auth.users WHERE id IN ('${ids.client}','${ids.other}','${ids.admin}'));`).trim()==='t';
  if(!rolledBack)throw Error('Diagnostic fixture persisted unexpectedly');
  const item={label,login,exit:result.status,sqlstate:stderr.match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1]??null,traces,stdout:stdout.trim(),stderr:stderr.trim(),fixtureRolledBack:rolledBack};
  console.log(JSON.stringify({probe:label,login,exit:item.exit,sqlstate:item.sqlstate,error:stderr.split(/\r?\n/).find(x=>x.includes('ERROR:'))??null}));
  return item;
}

try {
  for(const scenario of ['head-without-increment','current-with-increment']){
    const run={scenario,resourcesBefore:resources(),migrations:[],probes:[]};report.runs.push(run);save();
    let db;
    try {
      db=await createBootstrapDatabase();run.provider=db.provider;
      const target=db.localApiTarget();const own=JSON.parse(docker(['inspect',target.containerId]))[0];
      run.project=own.Name.replace('/supabase_db_','');
      run.postgresVersion=db.sql('SELECT version();').trim();
      run.initialIdentity=JSON.parse(db.sql(state('new_connection')));
      alignNativePgNet(db);
      db.sql('CREATE SCHEMA IF NOT EXISTS supabase_migrations; CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations(version text PRIMARY KEY,statements text[],name text);');
      const selected=scenario==='head-without-increment'?entries.slice(0,268):entries;
      for(const [i,e] of selected.entries()){
        if(i===268)run.compatibility=applyCompatibility(db,compatibility);
        if(!db.verify())throw Error('Cron gate changed');
        for(const relation of e.requiredEmptyRelations??[]){
          if(!/^public\.[a-z_]+$/.test(relation)||db.sql(`SELECT NOT EXISTS(SELECT FROM ${relation})`).trim()!=='t')throw Error('Historical empty-table gate failed');
        }
        db.sql(`BEGIN; SET LOCAL statement_timeout='45s'; SET LOCAL lock_timeout='5s'; SET LOCAL phase0.tracking_retry_url='http://127.0.0.1:1/phase0-disabled'; SET LOCAL phase0.tracking_retry_token='synthetic-local';\n${sources.get(e.file)}\nINSERT INTO supabase_migrations.schema_migrations(version,name) VALUES ('${e.version}','${e.file.slice(e.version.length+1,-4)}'); COMMIT;`);
        run.migrations.push({version:e.version,sha256:e.sha256});
        if((i+1)%50===0||i+1===selected.length)console.log(`${scenario}: ${i+1}/${selected.length}`);
        save();
      }
      if(selected.length===268)run.compatibility=applyCompatibility(db,compatibility);
      run.catalog=JSON.parse(db.sql(catalogSql));save();
      // First reproduce the exact failing body; --echo-errors reveals the failing statement.
      run.probes.push(probe(db,'exact failing test',transaction(`SET LOCAL ROLE supabase_auth_admin; ${deleteSql} RESET ROLE; SELECT NOT EXISTS(SELECT FROM public.profiles WHERE id='${ids.client}');`)));save();
      for(const role of ['supabase_auth_admin','postgres','service_role','authenticated']){
        const claims=role==='authenticated'?`SELECT set_config('request.jwt.claim.sub','${ids.client}',true); SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"${ids.client}"}',true);`:'';
        run.probes.push(probe(db,`instrumented deletion as ${role}`,transaction(`${claims} ${state('before_set_role')} SET LOCAL ROLE ${role}; ${state('before_delete')} ${deleteSql} RESET ROLE; ${state('after_reset_role')} ${absence}`)));save();
      }
      // Direct Auth login distinguishes inability to SET ROLE from actual Auth deletion permissions.
      const authFixture=`INSERT INTO auth.users(id,email,raw_app_meta_data,raw_user_meta_data) VALUES ('${ids.client}','profile-client@example.invalid','{"panelbot_admin_created":true,"panelbot_role":"client"}','{}');`;
      run.probes.push(probe(db,'direct Auth login deletion',`BEGIN; SET LOCAL statement_timeout='10s'; ${state('auth_login')} ${authFixture} ${state('before_delete')} ${deleteSql} SELECT jsonb_build_object('stage','after_delete','authAbsent',NOT EXISTS(SELECT FROM auth.users WHERE id='${ids.client}')); ROLLBACK;`,'supabase_auth_admin'));save();
      run.probes.push(probe(db,'role and claims reset on transaction end',`BEGIN; ${state('before_set')} SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"${ids.client}"}',true); ${state('as_authenticated')} RESET ROLE; ${state('after_reset_role')} ROLLBACK; ${state('after_rollback')}`));
      run.freshSessionAfterProbes=JSON.parse(db.sql(state('independent_runner_connection')));
      run.cronDisabled=db.verify();
      run.fixtureAndNetworkEmpty=db.sql(`SELECT NOT EXISTS(SELECT FROM auth.users WHERE id IN ('${ids.client}','${ids.other}','${ids.admin}')) AND NOT EXISTS(SELECT FROM net.http_request_queue) AND NOT EXISTS(SELECT FROM net._http_response);`).trim()==='t';
      save();
    }finally{
      run.cleanupCommands=[];cleanupTrace=run.cleanupCommands;
      try{if(db)db.close();run.close='returned successfully';}
      catch(error){run.close='threw';run.closeError=sanitize(error.message);run.closeStackLocations=[...(error.stack??'').matchAll(/(?:bootstrap-runtime|auth-delete-diagnostic)\.mjs:\d+:\d+/g)].map(m=>m[0]);}
      finally{cleanupTrace=null;}
      run.resourcesAfter=resources();run.resourceDelta=Object.fromEntries(Object.keys(run.resourcesBefore).map(k=>[k,{added:run.resourcesAfter[k].filter(x=>!run.resourcesBefore[k].includes(x)),removed:run.resourcesBefore[k].filter(x=>!run.resourcesAfter[k].includes(x))}]));
      try{assert.deepEqual(run.resourcesAfter,run.resourcesBefore);run.inventoryComparison='identical';}catch{run.inventoryComparison='different';}
      console.log(JSON.stringify({scenario,close:run.close,error:run.closeError??null,inventory:run.inventoryComparison,delta:run.resourceDelta}));save();
      if(run.close!=='returned successfully'||run.inventoryComparison!=='identical')report.cleanupNeedsExplanation=true;
    }
  }
  report.complete=true;
}catch(error){report.error=sanitize(error.message);process.exitCode=1;console.log(`Diagnostic stopped: ${report.error}`);}
finally{
  report.protectedFilesUnchanged=protectedFiles.every((file,i)=>hash(readFileSync(join(root,file)))===frozen[i].sha256);
  report.envUnchanged=hash(readFileSync(join(root,'.env')))===envHash;
  report.resourcesAfter=resources();
  childProcess.spawnSync=originalSpawn;syncBuiltinESMExports();save();
  console.log(JSON.stringify({complete:report.complete,protected16Unchanged:report.protectedFilesUnchanged,envUnchanged:report.envUnchanged}));
}
