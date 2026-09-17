import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {root} from './local-runtime.mjs';
import {createHash} from 'node:crypto';

import {canonical} from './catalog-canonical.mjs';
export {canonical};
const identity=(category,x)=>{
  if(category==='grants'||category==='default_grants')return [x.kind,x.schema,x.name,x.arguments,x.owner,x.grantee,x.grantor,x.privilege].map(v=>v??'').join('|');
  return [x.schema,x.table,x.name,x.arguments].map(v=>v??'').join('|');
};
export function structuralDiff(local,remote,{ignoreColumnOrder=false}={}) {
  const prepare=x=>canonical(ignoreColumnOrder&&x.columns?{...x,columns:[...x.columns].sort((a,b)=>a.name.localeCompare(b.name))}:x);
  const differences=[];
  for(const category of [...new Set([...Object.keys(local),...Object.keys(remote)])].sort()){
    const a=new Map((local[category]??[]).map(x=>[identity(category,x),prepare(x)]));
    const b=new Map((remote[category]??[]).map(x=>[identity(category,x),prepare(x)]));
    for(const object of [...new Set([...a.keys(),...b.keys()])].sort()){
      if(JSON.stringify(a.get(object))!==JSON.stringify(b.get(object)))differences.push({category,object,local:a.get(object)??null,remote:b.get(object)??null,justification:null,status:'unresolved'});
    }
  }
  return differences;
}
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
export function compareCatalogs(local,remote,exceptions) {
  const raw=structuralDiff(local,remote),semantic=structuralDiff(local,remote,{ignoreColumnOrder:true});
  const normalized=[];const pending=[];
  for(const d of raw)if(!semantic.some(x=>x.category===d.category&&x.object===d.object))normalized.push({...d,status:'normalized_with_evidence',justification:'Physical column order only; every named column attribute and every other relation property matches.'});
  for(const d of semantic) {
    const accepted=exceptions.find(e=>e.category===d.category&&e.object===d.object&&same(e.local,d.local)&&same(e.remote,d.remote));
    if(accepted)normalized.push({...d,status:'normalized_with_evidence',justification:accepted.evidence});
    else pending.push({...d,status:'pending'});
  }
  return {status:pending.length?'pending':normalized.length?'normalized_with_evidence':'identical',rawDifferences:raw.length,normalized,pending,unresolved:pending.length};
}
export function platformExceptions() {
  const bytes=readFileSync(join(root,'supabase/bootstrap/platform-exceptions.json'));
  if(createHash('sha256').update(bytes).digest('hex')!=='78a6b93c3a2d84e422e5a8741add6881da8ffa630cbb11aeb7df604aae163dae')throw Error('Platform exception manifest changed without review');
  return JSON.parse(bytes).entries;
}
export function verifyPlatformEvidence(local,remote) {
  // Names, signatures, definitions, owner and ACL remain compared despite extnamespace normalization.
  if(!same(local.pg_net_members,remote.pg_net_members))throw Error('pg_net functional or security metadata differs');
  if(remote.graphql_event_members.length!==0||local.graphql_event_members.length!==2||local.graphql_event_members.some(x=>x.extension!=='pg_graphql'||!['graphql_watch_ddl','graphql_watch_drop'].includes(x.name)))throw Error('GraphQL extension membership evidence changed');
  return {pgNetFunctionsIdentical:local.pg_net_members.length,graphqlTriggerMembershipVerified:true};
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  if(process.argv.length!==2)throw Error('No target arguments accepted');
  const dir=join(root,'docs/optimization/phase-0');
  const run=JSON.parse(readFileSync(join(dir,'bootstrap-validation.json'),'utf8'));
  let report;
  if(!run.passed || !existsSync(join(dir,'bootstrap-catalog-1.json'))) {
    report={status:'blocked',fullComparisonPerformed:false,reason:'No complete reconstructed local schema; partial execution cannot certify structural parity.',remoteSnapshotAvailable:existsSync(join(dir,'bootstrap-remote-catalog.json')),differences:null,normalization:'Secrets/configuration values are never fetched by the catalog query. A scheduler command hash is provenance, not a substitute for review of a changed command.'};
  }else{
    const local=JSON.parse(readFileSync(join(dir,'bootstrap-catalog-1.json'))),remote=JSON.parse(readFileSync(join(dir,'bootstrap-remote-catalog.json')));
    const lp=JSON.parse(readFileSync(join(dir,'bootstrap-platform-1.json'))),rp=JSON.parse(readFileSync(join(dir,'bootstrap-platform-remote.json')));
    const lp2=JSON.parse(readFileSync(join(dir,'bootstrap-platform-2.json')));
    const {netReferences,assertNetSecurity,assertPackagedHook}=await import('./bootstrap-net.mjs');
    const netReference=netReferences();
    const netLocal=[1,2].map(i=>JSON.parse(readFileSync(join(dir,`bootstrap-net-final-${i}.json`))));
    const netDifferences=structuralDiff({extension_functions:lp.pg_net_members},{extension_functions:rp.pg_net_members});
    const graphVerified=rp.graphql_event_members.length===0&&lp.graphql_event_members.length===2&&lp.graphql_event_members.every(x=>x.extension==='pg_graphql'&&['graphql_watch_ddl','graphql_watch_drop'].includes(x.name));
    const accepted=platformExceptions().filter(e=>e.object.includes('pg_net')?netDifferences.length===0:graphVerified);
    report={...compareCatalogs(local,remote,accepted),fullComparisonPerformed:true,platform:{pgNetFunctionsIdentical:netDifferences.length===0,graphqlTriggerMembershipVerified:graphVerified},securityReferenceVerified:run.runs.every(r=>r.compatibility?.referenceMatched)};
    report.pending.push(...netDifferences.map(d=>({...d,status:'pending',justification:'Extension function definitions or ACLs differ; namespace normalization cannot hide this.'})));
    for(const [i,metadata] of netLocal.entries()){
      try {assertNetSecurity(metadata,netReference.remote);assertPackagedHook(metadata,netReference.initial);}
      catch {report.pending.push({category:'pg_net_security',object:`reconstruction ${i+1}`,status:'pending',justification:'Full pg_net security/reference or exact reviewed provider hook differs'});}
    }
    const hookDifference={category:'provider_hooks',object:'extensions.grant_pg_net_access()',local:netLocal[0].provider_hooks,remote:netReference.remote.provider_hooks};
    if(!report.pending.some(x=>x.category==='pg_net_security'))report.normalized.push({...hookDifference,status:'normalized_with_evidence',justification:'Exact CLI 2.75.0 hook is retained. Its unconditional CREATE EXTENSION overrides are avoided only during native 0.19.5 installation on an empty isolated database with SET LOCAL event_triggers=false. Trigger is restored immediately. All 12 installed functions and all effective privileges of the five roles match remote after all 268 migrations. Future extension lifecycle changes must rerun this comparison; this is not a generic extension exclusion.'});
    report.platform.pgNetSecurityAndRolePrivilegesExact=!report.pending.some(x=>x.category==='pg_net_security');
    report.platform.repeatable=same(lp,lp2);
    if(!report.platform.repeatable)report.pending.push({category:'repeatability',object:'platform metadata',status:'pending',justification:'The two local platform catalogs differ'});
    report.compositeFingerprints=[1,2].map(i=>createHash('sha256').update(JSON.stringify(canonical({catalog:JSON.parse(readFileSync(join(dir,`bootstrap-catalog-${i}.json`))),platform:i===1?lp:lp2,net:netLocal[i-1]}))).digest('hex'));
    if(report.compositeFingerprints[0]!==report.compositeFingerprints[1])report.pending.push({category:'repeatability',object:'full pg_net security composite',status:'pending'});
    if(!graphVerified)report.pending.push({category:'platform_evidence',object:'pg_graphql membership',status:'pending',justification:'Exact extension membership not accredited'});
    report.unresolved=report.pending.length;
    report.additionalPlatformDifferences=netDifferences.length+1;
    report.totalDifferences=report.rawDifferences+report.additionalPlatformDifferences;
    if(report.unresolved)report.status='pending';
    if(!report.securityReferenceVerified)throw Error('Local security reference was not verified');
  }
  writeFileSync(join(dir,'bootstrap-schema-diff.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({status:report.status,fullComparisonPerformed:report.fullComparisonPerformed,unresolved:report.unresolved??null}));
  if(['blocked','pending'].includes(report.status))process.exitCode=1;
}
