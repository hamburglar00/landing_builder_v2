import { writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { root } from './local-runtime.mjs';
import { validateManifest, assertSafeEnvironment, hash, APPROVED_MANIFEST_SHA256 } from './bootstrap-manifest.mjs';
import { createBootstrapDatabase } from './bootstrap-runtime.mjs';
import { canonical } from './compare-schema-metadata.mjs';
import {compatibilitySources,applyCompatibility,testSecurityAccess} from './bootstrap-compatibility.mjs';
import {alignNativePgNet,testNetAccess,netDiagnostic,netReferences} from './bootstrap-net.mjs';
assertSafeEnvironment();
const {manifest,entries,sources}=validateManifest();
const compatibility=compatibilitySources();
netReferences();
const folder=join(root,'docs/optimization/phase-0');
const report={phase:'0B',localOnly:true,remoteWrites:0,legacyCount:268,expectedTotal:entries.length,manifestSha256:APPROVED_MANIFEST_SHA256,sanitizedException:'20260427190000',runs:[],passed:false};
const save=()=>writeFileSync(join(folder,'bootstrap-validation.json'),JSON.stringify(report,null,2)+'\n');
try {
  for(let i=1;i<=2;i++) {
    const run={number:i,migrations:[],complete:false};report.runs.push(run);save();
    console.log(`Starting clean local reconstruction ${i}/2`);
    const db=await createBootstrapDatabase();run.bootstrapMs=db.bootstrapMs;run.target=db.target;
    try {
      run.provider=db.provider;
      run.pgNetInstallation=alignNativePgNet(db);
      if(!alignNativePgNet(db).alreadyExact)throw Error('Native pg_net alignment is not idempotent');
      run.pgNetIdempotence={passed:1,failed:0};
      db.sql('create schema if not exists supabase_migrations; create table if not exists supabase_migrations.schema_migrations(version text primary key,statements text[],name text);');
      for(const [entryIndex,entry] of entries.entries()) {
        if(entryIndex===268)run.compatibility=applyCompatibility(db,compatibility);
        const start=performance.now();const result={version:entry.version,file:entry.file,sha256:entry.sha256,executionOrder:entry.executionOrder,transaction:true};
        try {
          if(!db.verify())throw Error('Cron gate disabled unexpectedly');
          if(entry.requiredEmptyRelations) {
            result.emptyTableGates=[];
            for(const relation of entry.requiredEmptyRelations) {
              if(!/^public\.[a-z_]+$/.test(relation))throw Error('Invalid empty-table gate');
              const empty=db.sql(`select not exists (select 1 from ${relation})`).trim()==='t';
              result.emptyTableGates.push({relation,empty});
              if(!empty)throw Error('Dependency reorder requires empty local tables; existing data requires explicit review');
            }
          }
          db.sql(`BEGIN; SET LOCAL statement_timeout='45s'; SET LOCAL lock_timeout='5s'; SET LOCAL phase0.tracking_retry_url='http://127.0.0.1:1/phase0-disabled'; SET LOCAL phase0.tracking_retry_token='synthetic-local';\n${sources.get(entry.file)}\nINSERT INTO supabase_migrations.schema_migrations(version,name) VALUES ('${entry.version}','${entry.file.slice(entry.version.length+1,-4)}'); COMMIT;`);
          result.status='passed';
        } catch(error) {result.status='failed';result.error=error.message;result.sqlstate=error.sqlstate??null;throw error;}
        finally {result.durationMs=performance.now()-start;run.migrations.push(result);save();}
        if(run.migrations.length%25===0)console.log(`Reconstruction ${i}: ${run.migrations.length}/268 migrations`);
      }
      if(entries.length===268)run.compatibility=applyCompatibility(db,compatibility);
      const ledger=db.sql('select version from supabase_migrations.schema_migrations order by version').trim().split(/\r?\n/);
      if(JSON.stringify(ledger)!==JSON.stringify(entries.map(e=>e.version).sort()))throw Error('Local ledger does not prove all registered versions');
      // Do not execute jobs even after the historical definitions have been inspected.
      run.cronExecutionDisabled=db.verify();
      const query=readFileSync(join(root,'scripts/phase0/bootstrap-catalog.sql'),'utf8');
      const catalog=JSON.parse(db.sql(query).trim());
      const platform=JSON.parse(db.sql(readFileSync(join(root,'scripts/phase0/bootstrap-platform-catalog.sql'),'utf8')));
      writeFileSync(join(folder,`bootstrap-platform-${i}.json`),JSON.stringify(platform,null,2)+'\n');
      run.securityAccess=testSecurityAccess(db);
      run.netAccess=testNetAccess(db);
      writeFileSync(join(folder,`bootstrap-net-final-${i}.json`),JSON.stringify(netDiagnostic(db),null,2)+'\n');
      run.cronExecutionDisabled=db.verify();
      writeFileSync(join(folder,`bootstrap-catalog-${i}.json`),JSON.stringify(catalog,null,2)+'\n');
      run.fingerprint=hash(JSON.stringify(canonical(catalog)));run.complete=true;run.localLedgerCount=ledger.length;save();
      console.log(`Reconstruction ${i}: 268/268; fingerprint ${run.fingerprint}`);
    } finally {db.close();run.cleanup='only runner-owned resources removed';save();}
  }
  report.equalFingerprints=report.runs[0].fingerprint===report.runs[1].fingerprint;
  if(!report.equalFingerprints)throw Error('Clean reconstruction fingerprints differ');
  report.passed=true;
} catch(error) {report.error=error.message;process.exitCode=1;console.log(`Bootstrap failed safely: ${error.message}`);}
finally {save();}
