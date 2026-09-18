import assert from 'node:assert/strict';
import {phoneFixture,cleanupPhones,ids} from './phone-security-tests.mjs';

// Only allowlisted fields of the fixture created by this test can enter evidence.
const state=db=>JSON.parse(db.sql(`SELECT coalesce(jsonb_agg(jsonb_build_object(
  'id',p.id,'gerencia_id',p.gerencia_id,'owner',g.user_id,'phone',p.phone,
  'comment',p.comment,'kind',p.kind,'status',p.status,'source_available',p.source_available,
  'assignment_role',p.assignment_role,'last_seen_at',p.last_seen_at) ORDER BY p.id),'[]')
  FROM public.gerencia_phones p JOIN public.gerencias g ON g.id=p.gerencia_id
  WHERE p.gerencia_id=7301 AND p.phone='000004'`));
const sanitized=value=>typeof value==='string'?value
  .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[redacted-token]')
  .replace(/(?:sb_secret_|sbp_)[A-Za-z0-9_-]+/g,'[redacted-key]')
  .replace(/[A-Z]:[\\/]Users[\\/][^\s]+/gi,'[redacted-path]'):null;

export function diagnoseOwnUpsert(db,api,record) {
  db.sql(phoneFixture);
  const row={gerencia_id:7301,phone:'000004',status:'active',source_available:true,kind:'carga',assignment_role:'acquisition',comment:'synthetic',last_seen_at:'2000-01-01T00:00:00Z'};
  const perform=(operation,method,endpoint,body,expectedStatus,verify)=>{
    const before=state(db),prefer='resolution=merge-duplicates,return=representation';
    const result=api.observedRequest('authenticated',ids.client,method,endpoint,body,prefer);
    const after=state(db);
    const evidence={operation,method,endpoint,status:result.status,
      postgrest:{code:sanitized(result.body?.code),message:sanitized(result.body?.message)},
      requestHeaders:{'Content-Type':'application/json',Prefer:prefer},responseHeaders:result.headers,
      identity:result.identity,identityMethod:'SECURITY INVOKER test-only RPC with the exact same ephemeral JWT as this request; token never recorded',
      before,after,assertions:[],passed:false};
    const equal=(label,actual,expected)=>{
      evidence.assertions.push({label,expected,actual,passed:actual===expected});
      assert.equal(actual,expected,label);
    };
    try {
      equal('HTTP status for '+operation,result.status,expectedStatus);
      assert.equal(result.identity.role,'authenticated');assert.equal(result.identity.authUid,ids.client);
      verify(result,after,equal,before);evidence.passed=true;
    } catch(error) {
      evidence.failingAssertion=evidence.assertions.find(x=>!x.passed)??{label:'response/row identity invariant',code:error.code??null};
      error.diagnostic=evidence;throw error;
    } finally {record(evidence);}
  };
  try {
    perform('insert','POST','gerencia_phones?on_conflict=gerencia_id,phone',row,201,(r,after,equal)=>{
      equal('one row inserted',after.length,1);equal('owner derives from own gerencia',after[0].owner,ids.client);equal('response matches synthetic phone',r.body[0].phone,'000004');
    });
    perform('upsert','POST','gerencia_phones?on_conflict=gerencia_id,phone',{...row,comment:'synthetic-upsert'},200,(r,after,equal,before)=>{
      equal('same row identity',after[0].id,before[0].id);equal('one row remains',after.length,1);equal('upsert updates allowed field',after[0].comment,'synthetic-upsert');equal('owner unchanged',after[0].owner,ids.client);equal('response row is updated row',r.body[0].id,after[0].id);
    });
    perform('update','PATCH','gerencia_phones?gerencia_id=eq.7301&phone=eq.000004',{comment:'edited'},200,(r,after,equal)=>equal('own edit persisted',after[0].comment,'edited'));
    perform('delete','DELETE','gerencia_phones?gerencia_id=eq.7301&phone=eq.000004',undefined,200,(r,after,equal)=>{equal('one own row deleted',r.body.length,1);equal('row removed',after.length,0);});
  }finally{cleanupPhones(db);}
}
