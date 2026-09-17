// Independent synthetic database tests. These fixtures are never used by bootstrap.
import {strict as assert} from 'node:assert';
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {localDatabase,root,read,command} from './local-runtime.mjs';
import {assertSafeEnvironment,hash} from './bootstrap-manifest.mjs';
assertSafeEnvironment();
const file='supabase/migrations/20260325201000_add_internal_id_to_conversions.sql';
const original=command('git',['show','HEAD:'+file]);
const corrected=read(file);
const report={localOnly:true,fixturesIndependentOfBootstrap:true,originalSource:'git HEAD migration before authorized correction',originalFileSha256:hash(original),correctedFileSha256:hash(corrected),cases:[],passed:0,failed:0};
const db=await localDatabase();
try {
  for(const scenario of [
    {name:'empty table',ids:[]},
    {name:'one row',ids:[7]},
    {name:'non-consecutive IDs',ids:[2,9,31]},
    {name:'sequence behind MAX',ids:[4,19],position:2},
    {name:'sequence ahead of MAX retains historical max synchronization',ids:[4,19],position:100},
    {name:'empty sequence with non-default minimum',ids:[],minimum:37},
  ]) {
    const outcomes=[];
    for(const [variant,source] of [['historical',original],['corrected',corrected]]) {
      db.sql(`drop table if exists public.conversions; drop sequence if exists public.conversions_internal_id_seq;
        create sequence public.conversions_internal_id_seq minvalue ${scenario.minimum??1};
        create table public.conversions(id uuid primary key default gen_random_uuid(),created_at timestamptz default now(),internal_id bigint);
        ${scenario.ids.length?'insert into public.conversions(internal_id) values '+scenario.ids.map(n=>'('+n+')').join(',')+';':''}
        ${scenario.position?`select setval('public.conversions_internal_id_seq',${scenario.position},true);`:''}`);
      const minimum=Number(db.sql("select seqmin from pg_sequence where seqrelid='public.conversions_internal_id_seq'::regclass").trim());
      const before=db.sql("select coalesce(jsonb_agg(jsonb_build_object('id',id,'internal_id',internal_id) order by id),'[]') from public.conversions").trim();
      let failedAsExpected=false;
      try {db.sql('BEGIN;\n'+source+'\nCOMMIT;');}
      catch(error){if(variant==='historical' && !scenario.ids.length && /value 0 is out of bounds/.test(error.message))failedAsExpected=true;else throw error;}
      const after=db.sql("select coalesce(jsonb_agg(jsonb_build_object('id',id,'internal_id',internal_id) order by id),'[]') from public.conversions").trim();
      assert.equal(after,before,'Existing rows must be byte-equivalent in both variants');
      if(failedAsExpected){outcomes.push({variant,expectedFailure:'setval(0) outside sequence range',rowsUnchanged:true});continue;}
      const called=db.sql('select is_called from public.conversions_internal_id_seq').trim()==='t';
      assert.equal(called,scenario.ids.length>0);
      const expected=scenario.ids.length?Math.max(...scenario.ids)+1:minimum;
      const next=Number(db.sql("select nextval('public.conversions_internal_id_seq')").trim());assert.equal(next,expected);
      outcomes.push({variant,minimum,rowsUnchanged:true,isCalledBeforeNextval:called,nextval:next,expected});
    }
    if(scenario.ids.length)assert.equal(outcomes[0].nextval,outcomes[1].nextval);
    report.cases.push({name:scenario.name,status:'passed',rowCount:scenario.ids.length,populatedEquivalence:scenario.ids.length?true:null,outcomes});report.passed++;
    console.log('PASS: '+scenario.name);
  }
} catch(error){report.failed++;process.exitCode=1;console.log('Sequence contract failed; no raw SQL retained');}
finally{db.close();writeFileSync(join(root,'docs/optimization/phase-0/bootstrap-sequence-contracts.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({passed:report.passed,failed:report.failed}));
