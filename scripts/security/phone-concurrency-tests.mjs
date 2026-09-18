import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {phoneFixture,cleanupPhones,landing} from './phone-security-tests.mjs';

function concurrentSql(db,sql) {
  const {containerId}=db.localApiTarget();
  const child=spawn('docker',['exec','-i',containerId,'psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-Atq'],{windowsHide:true,stdio:['pipe','pipe','pipe']});
  let stdout='',stderr='';child.stdout.on('data',x=>{stdout+=x;});child.stderr.on('data',x=>{stderr+=x;});
  child.stdin.end(sql);
  return new Promise((resolve,reject)=>{child.on('error',()=>reject(Error('Local concurrency process unavailable')));child.on('close',code=>resolve({code,stdout,sqlstate:stderr.match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1]??null}));});
}
async function race(db,query,count=8) {
  const gate=concurrentSql(db,"SET application_name='phase1b3-phone-gate'; BEGIN; SELECT pg_advisory_xact_lock(730009); SELECT pg_sleep(45); COMMIT;");
  let ready=false;
  for(let i=0;i<30;i++){if(db.sql("SELECT count(*) FROM pg_locks WHERE locktype='advisory' AND objid=730009 AND granted").trim()==='1'){ready=true;break;}await delay(50);}
  assert.ok(ready,'concurrency gate acquired');
  const workers=Array.from({length:count},()=>concurrentSql(db,`BEGIN; SET LOCAL statement_timeout='40s'; SELECT pg_advisory_xact_lock_shared(730009); SET LOCAL ROLE service_role; ${query}; COMMIT;`));
  let waiting=0;
  for(let i=0;i<50;i++){waiting=Number(db.sql("SELECT count(*) FROM pg_locks WHERE locktype='advisory' AND objid=730009 AND NOT granted").trim());if(waiting===count)break;await delay(50);}
  db.sql("SELECT pg_cancel_backend(pid) FROM pg_stat_activity WHERE datname=current_database() AND application_name='phase1b3-phone-gate'");
  const results=await Promise.all(workers);await gate;
  assert.equal(waiting,count,'all contenders waited on the same barrier');
  assert.ok(results.every(x=>x.code===0),'all actual PostgreSQL workers succeeded');
  return results;
}
export async function phoneConcurrencyTests(db,check) {
  db.sql(phoneFixture);
  try {
    await check('concurrency eight assignments create eight reservations balanced 4/4',async()=>{
      await race(db,"SELECT public.get_phone_for_landing('phase1b3-synthetic',true)");
      assert.equal(db.sql('SELECT count(DISTINCT id) FROM public.landing_phone_assignment_reservations').trim(),'8');
      assert.equal(db.sql("SELECT string_agg(n::text,',' ORDER BY phone_id) FROM (SELECT phone_id,count(*) n FROM public.landing_phone_assignment_reservations GROUP BY phone_id) s").trim(),'4,4');
    });
    await check('concurrency warmup creates no extra reservations',async()=>{
      await race(db,"SELECT public.get_phone_for_landing('phase1b3-synthetic',false)");
      assert.equal(db.sql('SELECT count(*) FROM public.landing_phone_assignment_reservations').trim(),'8');
    });
    await check('concurrency confirmation preserves one reservation identity',async()=>{
      const id=db.sql('SELECT id FROM public.landing_phone_assignment_reservations WHERE phone_id=730101 LIMIT 1').trim();
      await race(db,`SELECT public.extend_landing_phone_assignment_reservation('${id}','${landing}',730101,'000001')`);
      assert.equal(db.sql(`SELECT status FROM public.landing_phone_assignment_reservations WHERE id='${id}'`).trim(),'clicked');
      assert.equal(db.sql('SELECT count(*) FROM public.landing_phone_assignment_reservations').trim(),'8');
    });
    await check('concurrency counters retain all sixteen increments',async()=>{
      const before=Number(db.sql('SELECT usage_count FROM public.gerencia_phones WHERE id=730101').trim());
      const scopeBefore=Number(db.sql('SELECT usage_count FROM public.phone_assignment_scope_metrics WHERE phone_id=730101').trim());
      await race(db,`SELECT public.increment_phone_assignment_scope_usage(730101,'landing','${landing}')`,16);
      assert.equal(Number(db.sql('SELECT usage_count FROM public.gerencia_phones WHERE id=730101').trim()),before+16);
      assert.equal(Number(db.sql('SELECT usage_count FROM public.phone_assignment_scope_metrics WHERE phone_id=730101').trim()),scopeBefore+16);
    });
  }finally{cleanupPhones(db);}
}
