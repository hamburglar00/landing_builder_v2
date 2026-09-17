import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {root} from './local-runtime.mjs';
import {hash} from './bootstrap-manifest.mjs';
import {canonical} from './catalog-canonical.mjs';
const folder=join(root,'docs/optimization/phase-0');
export function netReferences(){
 const read=(name,sha)=>{const bytes=readFileSync(join(folder,name));if(hash(bytes)!==sha)throw Error('pg_net reference changed without review');return JSON.parse(bytes);};
 return {remote:read('bootstrap-net-diagnostic-remote.json','25f9cd7e65b777f6109101983cd01bf8f14129b3bef6c03a60407ab8b9735ffb'),initial:read('bootstrap-net-diagnostic-local.json','4e8fdccc75ce11717c66fc9a4a69574ed43112ff638ffd858ab9a12baf44456f').metadata};
}
export const netDiagnostic=db=>JSON.parse(db.sql(readFileSync(join(root,'scripts/phase0/bootstrap-net-diagnostic.sql'),'utf8')));
export function assertNetSecurity(local,remote){
 for(const field of ['installed','functions','relations','roles','event_triggers'])assert.deepEqual(canonical(local[field]),canonical(remote[field]),`pg_net ${field} differs`);
}
export function assertPackagedHook(local,reference){
 assert.deepEqual(canonical(local.provider_hooks),canonical(reference.provider_hooks),'Unreviewed provider hook');
 assert.deepEqual(canonical(local.event_triggers),canonical(reference.event_triggers),'Unreviewed provider event trigger');
}
export function alignNativePgNet(db){
 const {remote,initial}=netReferences();const before=netDiagnostic(db);
 assertPackagedHook(before,initial);
 // Idempotent: exact native installation needs no DDL, including after replay.
 try {assertNetSecurity(before,remote);return {applied:false,alreadyExact:true,version:remote.installed.version};}catch{}
 for(const field of ['installed','functions'])assert.deepEqual(canonical(before[field]),canonical(initial[field]),`Unexpected pre-install ${field}`);
 assert.equal(db.installNativePgNet().trim(),remote.installed.version);
 const after=netDiagnostic(db);assertNetSecurity(after,remote);assertPackagedHook(after,initial);
 assert.equal(db.sql('show event_triggers').trim(),'on');
 return {applied:true,version:after.installed.version,method:'Native DROP/CREATE EXTENSION on empty owned local database; transaction-local event_triggers=false; no extension file/function edits',remoteSecurityExact:true};
}
export function testNetAccess(db){
 const {remote,initial}=netReferences();const current=netDiagnostic(db);assertNetSecurity(current,remote);assertPackagedHook(current,initial);
 const checks=[];
 for(const role of remote.roles){
   assert.deepEqual(current.roles.find(r=>r.name===role.name),role);checks.push({role:role.name,check:'complete effective privileges match remote',status:'passed'});
   for(const fn of ['http_get','http_post'])for(const denied of [null,'queue','sequence','execute']){
     let observed,error=null;
     try {const lines=db.netProbe(role.name,fn,denied).trim().split(/\r?\n/);observed=JSON.parse(lines.at(-1));}catch(e){error=e;}
     if(denied){assert.equal(error?.sqlstate,'42501',`${role.name}/${fn}/${denied}: must not bypass denied privilege`);}
     else {if(error)throw error;assert.deepEqual(observed,{role:role.name,superuser:false,rows:1,invoker:role.name,sequenceMatches:true,responses:0});}
     checks.push({role:role.name,function:fn,case:denied?`denied-${denied}`:'allowed',status:'passed',sqlstate:error?.sqlstate??null,observed:observed??null,rolledBack:true});
   }
 }
 const residue=JSON.parse(db.sql("select jsonb_build_object('queue',(select count(*) from net.http_request_queue),'responses',(select count(*) from net._http_response),'probeColumn',exists(select from pg_attribute where attrelid='net.http_request_queue'::regclass and attname='phase0_invoker' and not attisdropped),'cron',current_setting('cron.launch_active_jobs'),'eventTriggers',current_setting('event_triggers'))"));
 assert.deepEqual(residue,{cron:'off',eventTriggers:'on',probeColumn:false,queue:0,responses:0});
 checks.push({check:'zero queued requests/responses; all probe DDL reverted; cron off; event triggers on',status:'passed'});
 assertNetSecurity(netDiagnostic(db),remote);
 return {passed:checks.length,failed:0,skipped:0,checks,residue,rolledBack:true,networkIsolationVerifiedOnEveryCall:true,remoteInvocations:0};
}
