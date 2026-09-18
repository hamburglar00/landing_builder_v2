// Isolated synthetic reconstruction and directed Inbox validation. No remote target.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {createInterface} from 'node:readline';
import {root} from '../phase0/local-runtime.mjs';
import {assertSafeEnvironment,validateManifest,hash} from '../phase0/bootstrap-manifest.mjs';
import {createBootstrapDatabase} from '../phase0/bootstrap-runtime.mjs';
import {compatibilitySources,applyCompatibility} from '../phase0/bootstrap-compatibility.mjs';
import {alignNativePgNet} from '../phase0/bootstrap-net.mjs';

assertSafeEnvironment();
const report={localOnly:true,complete:false,migrationsApplied:0,failures:[],checks:[],remoteWrites:0};
const save=()=>writeFileSync(join(root,'docs/optimization/inbox/tests.json'),JSON.stringify(report,null,2)+'\n');
const input=createInterface({input:process.stdin,terminal:false});
const iterator=input[Symbol.asyncIterator]();
const diagnostics={
  bindOwner:()=>{},snapshot:()=>{},
  record:({cmd,result,durationMs})=>{
    if(!result.error&&result.status===0)return null;
    const failure={tool:cmd.endsWith('docker')?'docker':'local CLI',exitCode:result.status,errorCode:result.error?.code??null,signal:result.signal??null,durationMs,sqlstate:result.stderr?.match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1]??null};
    report.commandFailures??=[];report.commandFailures.push(failure);save();return failure;
  },
};
let db,revision=0;
try {
  const manifest=validateManifest();assert.equal(manifest.entries.length,274);
  report.historicalMigrationsSha256=hash(JSON.stringify(manifest.entries.slice(0,273).map(x=>({file:x.file,sha256:x.sha256}))));
  db=await createBootstrapDatabase({diagnostics});report.provider=db.provider;report.nativeCompatibility=alignNativePgNet(db);
  db.sql('CREATE SCHEMA IF NOT EXISTS supabase_migrations; CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations(version text PRIMARY KEY,statements text[],name text);');
  for(const [index,entry]of manifest.entries.entries()) {
    if(index===268)report.compatibility=applyCompatibility(db,compatibilitySources());
    for(const relation of entry.requiredEmptyRelations??[]){assert(/^public\.[a-z_]+$/.test(relation));assert.equal(db.sql(`SELECT NOT EXISTS(SELECT FROM ${relation})`).trim(),'t');}
    db.sql(`BEGIN; SET LOCAL statement_timeout='45s'; SET LOCAL lock_timeout='5s'; SET LOCAL phase0.tracking_retry_url='http://127.0.0.1:1/inbox-disabled'; SET LOCAL phase0.tracking_retry_token='synthetic-local'; ${manifest.sources.get(entry.file)} INSERT INTO supabase_migrations.schema_migrations(version,name) VALUES('${entry.version}','${entry.file.slice(entry.version.length+1,-4)}'); COMMIT;`);
    report.migrationsApplied++;if(report.migrationsApplied%50===0||report.migrationsApplied===274){save();console.log(`Inbox reconstruction ${report.migrationsApplied}/274`);}
  }
  report.migrationSha256=manifest.entries[273].sha256;
  db.sql(readFileSync(join(root,'scripts/optimization/inbox-diagnostic-fixture.sql'),'utf8'));
  const previousMeasurements=join(root,'docs/optimization/inbox/sql-measurements.json');
  if(existsSync(previousMeasurements)){
    const previous=JSON.parse(readFileSync(previousMeasurements,'utf8'));
    for(const [file,digest]of Object.entries(previous.fixtureHashes))assert.equal(hash(readFileSync(join(root,file))),digest);
    report.todayMeasurements=previous.measurements;
  }
  console.log('LOCAL_INBOX_READY');
  let automatic=true;
  while(true) {
    const answer=automatic?{done:false,value:'{"operation":"test"}'}:await iterator.next();automatic=false;
    if(answer.done||answer.value==='exit')break;
    if(!answer.value.trim())continue;
    const command=JSON.parse(answer.value);
    try {
      if(command.operation==='sql'){assert.equal(typeof command.query,'string');console.log(JSON.stringify({ok:true,result:db.sql(command.query)}));}
      else if(command.operation==='test') {
        const tests=await import(`./inbox-tests.mjs?revision=${revision++}`);
        await tests.run(db,report,save);
        report.complete=true;console.log('INBOX_TESTS_PASSED');
      } else throw Error('Unknown local runner operation');
    } catch(error){report.complete=false;const failure={message:error.message,sqlstate:error.sqlstate??null,stage:command.operation};report.failures.push(failure);console.log(JSON.stringify({paused:true,...failure}));}
    save();
  }
}catch(error){report.complete=false;report.failures.push({message:error.message,sqlstate:error.sqlstate??null});process.exitCode=1;}
finally {input.close();if(db)try{report.cleanup=db.close();}catch{report.cleanup={failed:true};report.complete=false;process.exitCode=1;}save();console.log(JSON.stringify({complete:report.complete,migrationsApplied:report.migrationsApplied,failures:report.failures,cleanup:report.cleanup}));}
