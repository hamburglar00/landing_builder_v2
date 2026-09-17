import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Executes the actual Edge entrypoint with a fake SDK and no network access.
// It characterizes orchestration, not SQL locks, concurrency, or the Deno runtime.
function handler(name: "landing-phone" | "phone-click", options: {
  result?: Record<string, unknown>; cache?: Record<string, unknown>; blocked?: boolean;
  ownerMissing?: boolean; rpcError?: string;
} = {}) {
  const calls: {name:string;params:Record<string,unknown>}[] = [];
  let serve!: (request: Request) => Promise<Response>;
  const client = {
    from(table: string) {
      const query = {
        select: () => query, eq: () => query, limit: () => query,
        maybeSingle: async () => ({error:null,data:
          table === "landings" ? (options.ownerMissing ? null : {id:"landing",name:"synthetic",user_id:"owner",publish_target:"constructor"}) :
          table === "landing_phone_cache" ? options.cache ?? null :
          table === "gerencia_phones" ? {id:1,phone:"000001",gerencia_id:2} :
          table === "landings_gerencias" ? {landing_id:"landing",gerencia_id:2} : {id:"owner"}}),
      }; return query;
    },
    async rpc(name:string,params:Record<string,unknown>) {
      calls.push({name,params});
      if (name === options.rpcError) return {data:null,error:{message:"synthetic error"}};
      if (name === "is_client_access_blocked") return {data:options.blocked ?? false,error:null};
      return {data:options.result ?? {_status:"ok",phone:"000001",phoneId:1,gerencia:{id:2}},error:null};
    },
  };
  const source = readFileSync(new URL(`../../supabase/functions/${name}/index.ts`,import.meta.url),"utf8");
  const compiled = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  runInNewContext(compiled, {
    exports:{},require:(specifier:string) => {
      assert.equal(specifier,"https://esm.sh/@supabase/supabase-js@2");
      return {createClient:()=>client};
    },
    Deno:{env:{get:()=>"synthetic"},serve:(fn:typeof serve)=>{serve=fn;}},
    Request,Response,URL,crypto,console:{error:()=>{}},
  });
  return {serve,calls};
}

test("Phase 0: landing-phone methods, missing name, blocked/missing owner", async () => {
  assert.equal((await handler("landing-phone").serve(new Request("https://example.invalid",{method:"OPTIONS"}))).status,200);
  assert.equal((await handler("landing-phone").serve(new Request("https://example.invalid",{method:"DELETE"}))).status,405);
  assert.equal((await handler("landing-phone").serve(new Request("https://example.invalid"))).status,400);
  assert.equal((await handler("landing-phone",{blocked:true}).serve(new Request("https://example.invalid?name=synthetic"))).status,403);
  assert.equal((await handler("landing-phone",{ownerMissing:true}).serve(new Request("https://example.invalid?name=synthetic"))).status,404);
});

test("Phase 0: assignment status maps to HTTP without fabricating a phone", async () => {
  for (const [status,http] of [["not_found",404],["no_assignments",404],["no_phones",503]] as const) {
    const h=handler("landing-phone",{result:{_status:status}});
    const response=await h.serve(new Request("https://example.invalid?name=synthetic"));
    assert.equal(response.status,http);
    assert.equal((await response.json()).phone,undefined);
  }
  assert.equal((await handler("landing-phone",{rpcError:"get_phone_for_landing"}).serve(new Request("https://example.invalid?name=synthetic"))).status,500);
});

test("Phase 0: warmup suppresses reservation and demand recording", async () => {
  const h=handler("landing-phone");
  const response=await h.serve(new Request("https://example.invalid?name=synthetic&source=warmup"));
  assert.equal(response.status,200);
  assert.equal(response.headers.get("cache-control"),"no-store");
  assert.equal((await response.json())._status,undefined);
  assert.equal(h.calls.find(c=>c.name==="get_phone_for_landing")?.params.p_create_reservation,false);
  assert.equal(h.calls.some(c=>c.name==="record_landing_phone_availability_demand"),false);
});

test("Phase 0: fair cache must be bypassed; ordinary fresh cache can be reused", async () => {
  for(const fair of [false,true]) {
    const h=handler("landing-phone",{cache:{status:"ok",refreshed_at:new Date().toISOString(),payload:{phone:"000001",phoneMode:fair?"fair":"random"}}});
    assert.equal((await h.serve(new Request("https://example.invalid?name=synthetic"))).status,200);
    assert.equal(h.calls.some(c=>c.name==="get_phone_for_landing"),fair);
    if(fair) assert.equal(h.calls.find(c=>c.name==="get_phone_for_landing")?.params.p_create_reservation,true);
  }
});

test("Phase 0: phone-click validates input and preserves best-effort reservation semantics", async () => {
  const req=()=>new Request("https://example.invalid",{method:"POST",body:JSON.stringify({landingName:"synthetic",phoneId:1,phone:"000001",reservationId:"synthetic-reservation"})});
  assert.equal((await handler("phone-click").serve(new Request("https://example.invalid"))).status,405);
  assert.equal((await handler("phone-click").serve(new Request("https://example.invalid",{method:"POST",body:"{}"}))).status,400);
  const h=handler("phone-click",{rpcError:"extend_landing_phone_assignment_reservation"});
  assert.equal((await h.serve(req())).status,200);
  assert.equal(h.calls.filter(c=>c.name==="increment_phone_assignment_scope_usage").length,1);
  assert.equal(h.calls.find(c=>c.name==="extend_landing_phone_assignment_reservation")?.params.p_reservation_id,"synthetic-reservation");
  assert.equal((await handler("phone-click",{rpcError:"increment_phone_assignment_scope_usage"}).serve(req())).status,500);
});
