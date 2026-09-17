// Independent local reproduction of the new empty-database blocker. No historical SQL is changed.
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {localDatabase,root} from './local-runtime.mjs';
import {assertSafeEnvironment} from './bootstrap-manifest.mjs';
assertSafeEnvironment();
const report={localOnly:true,kind:'empty-sequence-boundary',historicalVersion:'20260325201000',reproduced:false};
const db=await localDatabase();
try {
  db.sql('create sequence public.phase0_range_probe;');
  report.minimum=Number(db.sql("select seqmin from pg_sequence where seqrelid='public.phase0_range_probe'::regclass").trim());
  try {db.sql("select setval('public.phase0_range_probe',0,true);");}
  catch(error){report.reproduced=/value 0 is out of bounds/.test(error.message);}
  if(!report.reproduced||report.minimum!==1)throw Error('Expected empty-sequence failure was not reproduced');
  report.requestedValue=0;report.syntheticRowsInserted=0;report.historicalFilesModified=0;
} finally {db.close();writeFileSync(join(root,'docs/optimization/phase-0/bootstrap-empty-sequence.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report));
