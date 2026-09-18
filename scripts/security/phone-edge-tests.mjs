import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {runInNewContext} from 'node:vm';
import {join} from 'node:path';
import {root} from '../phase0/local-runtime.mjs';
import {phoneFixture,cleanupPhones,ids} from './phone-security-tests.mjs';

const require=createRequire(join(root,'frontend/package.json'));
const ts=require('typescript'),{createClient}=require('@supabase/supabase-js');
const syntheticCron='phase1b3-synthetic-cron';
const tokens=new Map([['synthetic-client',ids.client],['synthetic-other',ids.other],['synthetic-admin',ids.admin]]);

// Actual handlers and SDK queries; Auth and the vendor are synthetic transports.
// Database operations use actual PostgREST on the isolated reconstructed schema.
export function edgeHandler(name,api,{historical=false}={}) {
  const calls={auth:0,vendor:0,writes:0,unauthorizedNetwork:0};
  const client=createClient('http://phase1b3.invalid','synthetic-backend',{
    auth:{persistSession:false,autoRefreshToken:false},
    global:{fetch:async(input,init)=>{
      const url=new URL(String(input)),headers=new Headers(init?.headers);
      if(url.origin!=='http://phase1b3.invalid'){calls.unauthorizedNetwork++;throw Error('Network denied');}
      if(url.pathname==='/auth/v1/user') {
        calls.auth++;const id=tokens.get(headers.get('Authorization')?.replace(/^Bearer /,''));
        return new Response(JSON.stringify(id?{id,app_metadata:{},user_metadata:{role:'admin'},aud:'authenticated'}:{message:'Invalid synthetic session'}),{status:id?200:401,headers:{'Content-Type':'application/json'}});
      }
      if(!url.pathname.startsWith('/rest/v1/')){calls.unauthorizedNetwork++;throw Error('Network denied');}
      const method=init?.method??'GET';if(method!=='GET'&&method!=='HEAD')calls.writes++;
      const result=api.request('service_role',undefined,method,url.pathname.slice('/rest/v1/'.length)+url.search,init?.body?JSON.parse(init.body):undefined,headers.get('Prefer')??'return=representation');
      return new Response(result.status===204?null:JSON.stringify(result.body),{status:result.status,headers:{'Content-Type':'application/json'}});
    }},
  });
  const compile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const helper={exports:{}};
  runInNewContext(compile(readFileSync(join(root,'supabase/functions/_shared/phone-administration.ts'),'utf8')),{...helper,URL});
  let serve;
  const file=`supabase/functions/${name}/index.ts`;
  const source=historical?execFileSync('git',['show',`d7d57637032b02f93639481d8483b1800ad1bac3:${file}`],{cwd:root,encoding:'utf8',windowsHide:true}):readFileSync(join(root,file),'utf8');
  runInNewContext(compile(source),{
    exports:{},require:specifier=>{
      if(specifier==='https://esm.sh/@supabase/supabase-js@2')return {createClient:()=>client};
      if(specifier==='../_shared/phone-administration.ts')return helper.exports;
      throw Error('Unapproved handler dependency');
    },
    Deno:{serve:fn=>{serve=fn;},env:{get:key=>({SUPABASE_URL:'http://phase1b3.invalid',SERVICE_ROLE_KEY:'synthetic-backend',CRON_SECRET:syntheticCron,ASESADMIN_BASE_URL:'http://vendor.phase1b3.invalid'}[key])}},
    Request,Response,URL,Date,console:{error:()=>{}},
    fetch:async input=>{
      const url=new URL(String(input));
      assert.equal(url.origin,'http://vendor.phase1b3.invalid');
      assert.match(url.pathname,/^\/api\/v1\/agency\/730[123]\/random-contact$/);
      calls.vendor++;
      // The historical empty snapshot contract deactivates unavailable phones.
      return new Response(JSON.stringify({code:'no_managers_found'}),{status:404});
    },
  });
  return {serve,calls};
}

const request=(token,body,query='')=>new Request('http://edge.phase1b3.invalid/'+query,{method:'POST',headers:token?{Authorization:'Bearer '+token,'Content-Type':'application/json'}:{'Content-Type':'application/json'},body:JSON.stringify(body)});
const state=db=>JSON.parse(db.sql("SELECT jsonb_agg(jsonb_build_object('id',id,'gerencia_id',gerencia_id,'status',status,'usage_count',usage_count,'source_available',source_available,'comment',comment,'messagesReset',messages_reset_at IS NOT NULL) ORDER BY id) FROM public.gerencia_phones"));

export async function phoneEdgeTests(db,api,check) {
  for(const name of ['sync-phones','reset-phone-counters','reset-phone-messages']) {
    for(const token of [null,'synthetic-anon','synthetic-invalid'])await check(`Edge ${name} rejects ${token??'missing'} session before effects`,async()=>{
      db.sql(phoneFixture);try{const h=edgeHandler(name,api),before=state(db);const r=await h.serve(request(token,{user_id:ids.other,gerencia_id:7302}));assert.equal(r.status,401);assert.equal(h.calls.writes,0);assert.equal(h.calls.vendor,0);assert.deepEqual(state(db),before);}finally{cleanupPhones(db);}
    });
    for(const payload of [{user_id:ids.other},{gerencia_id:7302},{user_id:ids.other,gerencia_id:7301}])await check(`Edge ${name} denies forged owner ${JSON.stringify(Object.keys(payload))}`,async()=>{
      db.sql(phoneFixture);try{const h=edgeHandler(name,api),before=state(db);const r=await h.serve(request('synthetic-client',payload));assert.equal(r.status,403);assert.equal(h.calls.writes,0);assert.equal(h.calls.vendor,0);assert.deepEqual(state(db),before);}finally{cleanupPhones(db);}
    });
    await check(`Edge ${name} rejects user_id URL without effects`,async()=>{
      db.sql(phoneFixture);try{const h=edgeHandler(name,api);const r=await h.serve(request('synthetic-client',{gerencia_id:7301},'?user_id='+ids.other));assert.equal(r.status,400);assert.equal(h.calls.writes,0);assert.equal(h.calls.vendor,0);}finally{cleanupPhones(db);}
    });
    for(const [token,body,target] of [['synthetic-client',{gerencia_id:7301},7301],['synthetic-admin',{gerencia_id:7302},7302],['synthetic-admin',{user_id:ids.other},7302]])await check(`Edge ${name} authorized ${token} target ${target} via ${Object.keys(body).join(',')} preserves contract`,async()=>{
      const results=[];
      for(const historical of [true,false]) {
        db.sql(phoneFixture);
        try {
          const h=edgeHandler(name,api,{historical});
          const historicalBody={...body,user_id:target===7302?ids.other:ids.client};
          const response=await h.serve(request(token,historical?historicalBody:body));
          assert.equal(response.status,200);const value=await response.json();
          if(value.reset_at){assert.ok(Number.isFinite(Date.parse(value.reset_at)));delete value.reset_at;}
          assert.equal(value.success,true);assert.equal(h.calls.unauthorizedNetwork,0);
          results.push({response:value,phones:state(db),vendorCalls:h.calls.vendor});
        }finally{cleanupPhones(db);}
      }
      assert.deepEqual(results[1],results[0]);
    });
  }
  await check('Edge scheduled synchronization synthetic results equal historical handler',async()=>{
    const results=[];
    for(const historical of [true,false]){
      db.sql(phoneFixture);try{const h=edgeHandler('sync-phones',api,{historical});const r=await h.serve(request(null,{cron_secret:syntheticCron}));assert.equal(r.status,200);assert.equal(h.calls.auth,0);assert.equal(h.calls.vendor,3);results.push({response:await r.json(),phones:state(db)});}finally{cleanupPhones(db);}
    }
    assert.deepEqual(results[1],results[0]);
  });
}
