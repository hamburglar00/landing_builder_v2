import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Executes the actual Edge entrypoint with a fake SDK and no network access.
// It characterizes orchestration, not SQL locks, concurrency, or the Deno runtime.
function handler(name: "landing-phone" | "phone-click", options: {
  result?: Record<string, unknown>; cache?: Record<string, unknown>; blocked?: boolean;
  ownerMissing?: boolean; ownerError?: boolean; missingEnv?: boolean; rpcError?: string; landingMode?: string;
  landingCriterion?: string; publishTarget?: string; rpcThrow?: string; waitUntil?: boolean;
} = {}) {
  const calls: {name:string;params:Record<string,unknown>}[] = [];
  const logs: string[] = [];
  const background: Promise<unknown>[] = [];
  let serve!: (request: Request) => Promise<Response>;
  const client = {
    from(table: string) {
      const query = {
        select: () => query, eq: () => query, limit: () => query,
        maybeSingle: async () => ({error:options.ownerError ? { message: "private owner error" } : null,data:
          table === "landings" ? (options.ownerMissing ? null : {id:"landing",name:"synthetic",user_id:"owner",publish_target:"constructor",gerencia_selection_mode:options.landingMode ?? "fair",gerencia_fair_criterion:options.landingCriterion ?? "usage_count"}) :
          table === "gerencia_phones" ? {id:1,phone:"000001",gerencia_id:2} :
          table === "landings_gerencias" ? {landing_id:"landing",gerencia_id:2} : {id:"owner"}}),
      }; return query;
    },
    async rpc(name:string,params:Record<string,unknown>) {
      calls.push({name,params});
      if (name === options.rpcThrow) throw Error("private SDK failure with sensitive URL");
      if (name === options.rpcError) return {data:null,error:{message:"synthetic error"}};
      if (name === "landing_phone_preflight") return options.ownerError
        ? {data:null,error:{message:"private owner error"}}
        : {data:options.ownerMissing ? {status:"not_found"} : options.blocked ? {status:"blocked"} :
          {status:"ok",ownerUserId:"owner",publishTarget:options.publishTarget ?? "constructor"},error:null};
      if (name === "get_cached_constructor_landing_phone") {
        const cache = options.cache;
        return {
          data: cache?.status === "ok"
            ? {...(cache.payload as Record<string, unknown>),cacheRefreshedAt:cache.refreshed_at}
            : null,
          error:null,
        };
      }
      if (name === "count_landing_controlled_click") return {data:true,error:null};
      return {data:options.result ?? {_status:"ok",phone:"000001",phoneId:1,gerencia:{id:2}},error:null};
    },
  };
  const source = readFileSync(new URL(`../../supabase/functions/${name}/index.ts`,import.meta.url),"utf8");
  const compiled = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  runInNewContext(compiled, {
    exports:{},require:(specifier:string) => {
      if (specifier === "./diagnostics.ts") {
        const module = { exports: {} };
        const helper = readFileSync(new URL("../../supabase/functions/landing-phone/diagnostics.ts", import.meta.url), "utf8");
        runInNewContext(ts.transpileModule(helper, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
          { exports: module.exports, performance, crypto, console: { log: (line: string) => logs.push(line), error: (line: string) => logs.push(line) } });
        return module.exports;
      }
      assert.equal(specifier,"https://esm.sh/@supabase/supabase-js@2");
      return {createClient:()=>client};
    },
    Deno:{env:{get:()=>options.missingEnv ? undefined : "synthetic"},serve:(fn:typeof serve)=>{serve=fn;}},
    Request,Response,URL,crypto,console:{error:()=>{}},
    ...(options.waitUntil ? {EdgeRuntime:{waitUntil:(pending:Promise<unknown>)=>background.push(pending)}} : {}),
  });
  return {serve,calls,logs,background};
}

test("background demand failures keep the diagnostic UUID and catch private SDK errors in waitUntil",async()=>{
 const id="11111111-1111-4111-8111-111111111111";
 for(const failure of ["rpcError","rpcThrow"] as const){
  const h=handler("landing-phone",{[failure]:"record_landing_phone_availability_demand",waitUntil:true});
  const response=await h.serve(new Request("https://example.invalid?name=synthetic",{headers:{"x-entry-request-id":id}}));
  await Promise.all(h.background);
  assert.equal(response.status,200);
  const record=JSON.parse(h.logs.find(line=>line.includes('"landing_phone_background_error"'))!);
  assert.equal(record.request_id,id);assert.equal(record.phase,failure==="rpcError"?"demand":"background");
  assert.doesNotMatch(JSON.stringify(h.logs),/private|sensitive|synthetic|000001/);
 }
});

test("phone diagnostics expose the combined preflight phase and keep reservation identity", async () => {
  const requestId = "11111111-1111-4111-8111-111111111111";
  const h = handler("landing-phone");
  const response = await h.serve(new Request("https://example.invalid?name=synthetic", { headers: { "x-entry-request-id": requestId } }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-entry-request-id"), requestId);
  assert.equal(response.headers.get("x-landing-phone-outcome"), "ok");
  assert.equal(response.headers.get("access-control-max-age"), null);
  for (const phase of ["preflight", "cache", "select", "total"]) assert.match(response.headers.get("server-timing")!, new RegExp(`phone-${phase};dur=[0-9.]+`));
  const record = JSON.parse(h.logs.find(line => line.includes('"landing_phone_request"'))!);
  assert.equal(record.request_id, requestId);
  assert.equal(record.source, "landing");
  assert.equal(record.cache, "miss");
  assert.equal(h.calls.filter(call => call.name === "landing_phone_preflight").length, 1);
  assert.equal(h.calls.some(call => call.name === "is_client_access_blocked"), false);
  assert.ok(!JSON.stringify(record).includes("synthetic"));
  assert.notEqual(h.calls.find(call => call.name === "record_landing_phone_availability_demand")?.params.p_request_id, requestId);
  const preflight = await h.serve(new Request("https://example.invalid", { method: "OPTIONS" }));
  assert.equal(preflight.headers.get("access-control-max-age"), "600");
  assert.match(preflight.headers.get("access-control-allow-headers")!, /x-entry-request-id/);
  assert.match(preflight.headers.get("access-control-expose-headers")!, /Server-Timing/);
  const invalid = await h.serve(new Request("https://example.invalid?name=synthetic", { headers: { "x-entry-request-id": "private@example.invalid" } }));
  assert.match(invalid.headers.get("x-entry-request-id")!, /^[a-f0-9-]{36}$/);
  assert.ok(!h.logs.join("").includes("private@"));
});

test("every non-preflight Edge return forbids caching, including POST, cache hit and all error paths", async () => {
  const cases: Array<{ options?: Parameters<typeof handler>[1]; init?: RequestInit; path?: string; status: number }> = [
    { status: 200 }, { init: { method: "POST", body: JSON.stringify({ name: "synthetic" }) }, status: 200 },
    { options: { cache: { status: "ok", refreshed_at: new Date().toISOString(), payload: { phone: "000001", phoneMode: "random" } } }, status: 200 },
    { path: "", status: 400 }, { init: { method: "DELETE" }, status: 405 },
    { options: { missingEnv: true }, status: 500 }, { options: { ownerError: true }, status: 500 },
    { options: { ownerMissing: true }, status: 404 }, { options: { blocked: true }, status: 403 },
    { options: { rpcError: "landing_phone_preflight" }, status: 500 }, { options: { rpcError: "get_phone_for_landing" }, status: 500 },
    { options: { result: { _status: "not_found" } }, status: 404 },
    { options: { result: { _status: "no_assignments" } }, status: 404 }, { options: { result: { _status: "no_phones" } }, status: 503 },
    { init: { method: "POST", body: JSON.stringify({ name: { private: "private@example.invalid" } }) }, status: 500 },
  ];
  for (const row of cases) {
    const h = handler("landing-phone", row.options);
    const response = await h.serve(new Request("https://example.invalid" + (row.path ?? "?name=synthetic"), row.init));
    assert.equal(response.status, row.status);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("access-control-max-age"), null);
    assert.ok(!h.logs.join("").includes("private"));
  }
});

test("Phase 0: landing-phone methods, missing name, blocked/missing owner", async () => {
  assert.equal((await handler("landing-phone").serve(new Request("https://example.invalid",{method:"OPTIONS"}))).status,200);
  assert.equal((await handler("landing-phone").serve(new Request("https://example.invalid",{method:"DELETE"}))).status,405);
  assert.equal((await handler("landing-phone").serve(new Request("https://example.invalid"))).status,400);
  assert.equal((await handler("landing-phone",{blocked:true}).serve(new Request("https://example.invalid?name=synthetic"))).status,403);
  assert.equal((await handler("landing-phone",{ownerMissing:true}).serve(new Request("https://example.invalid?name=synthetic"))).status,404);
});

test("preflight blocks selection before any reservation and preserves source", async () => {
  for (const source of [undefined, "chatrace", "warmup"]) {
    const suffix = source ? `&source=${source}` : "";
    const h = handler("landing-phone", { blocked: true });
    const response = await h.serve(new Request(`https://example.invalid?name=synthetic${suffix}`));
    assert.equal(response.status, 403);
    assert.equal(h.calls.filter(call => call.name === "landing_phone_preflight").length, 1);
    assert.equal(h.calls.find(call => call.name === "landing_phone_preflight")?.params.p_source, source ?? null);
    assert.equal(h.calls.some(call => call.name === "get_phone_for_landing" || call.name === "get_phone_for_chatrace_client"), false);
  }
});

test("chatrace keeps its selector and records scope usage for the checked owner", async () => {
  const h = handler("landing-phone");
  const response = await h.serve(new Request("https://example.invalid?name=synthetic&source=chatrace"));
  assert.equal(response.status, 200);
  assert.equal(h.calls.find(call => call.name === "landing_phone_preflight")?.params.p_source, "chatrace");
  assert.equal(h.calls.some(call => call.name === "get_cached_constructor_landing_phone"), false);
  assert.equal(h.calls.some(call => call.name === "get_phone_for_chatrace_client"), true);
  assert.equal(h.calls.find(call => call.name === "increment_phone_assignment_scope_usage")?.params.p_user_id, "owner");
});

test("classic skips constructor cache after preflight and keeps one selection", async () => {
  const h = handler("landing-phone", { publishTarget: "classic" });
  assert.equal((await h.serve(new Request("https://example.invalid?name=synthetic"))).status, 200);
  assert.equal(h.calls.some(call => call.name === "get_cached_constructor_landing_phone"), false);
  assert.equal(h.calls.filter(call => call.name === "get_phone_for_landing").length, 1);
  assert.equal(h.calls.find(call => call.name === "get_phone_for_landing")?.params.p_create_reservation, true);
});

test("Phase 0: assignment status maps to HTTP without fabricating a phone", async () => {
  for (const [status,http] of [["not_found",404],["no_assignments",404],["no_phones",503]] as const) {
    const h=handler("landing-phone",{result:{_status:status}});
    const response=await h.serve(new Request("https://example.invalid?name=synthetic"));
    assert.equal(response.status,http);
    assert.equal(response.headers.get("x-landing-phone-outcome"),status);
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
    assert.equal(h.calls.some(c=>c.name==="get_cached_constructor_landing_phone"),true);
    assert.equal(h.calls.some(c=>c.name==="get_phone_for_landing"),fair);
    if(fair) assert.equal(h.calls.find(c=>c.name==="get_phone_for_landing")?.params.p_create_reservation,true);
  }
});

test("quota-controlled assignments bypass constructor cache and reserve a fresh selection", async () => {
  const h=handler("landing-phone",{cache:{status:"ok",refreshed_at:new Date().toISOString(),payload:{phone:"000001",phoneMode:"random",gerenciaSelectionMode:"weighted_quota"}}});
  assert.equal((await h.serve(new Request("https://example.invalid?name=synthetic"))).status,200);
  assert.equal(h.calls.find(c=>c.name==="get_phone_for_landing")?.params.p_create_reservation,true);
});

test("Phase 0: phone-click validates input and preserves best-effort reservation semantics", async () => {
  const req=()=>new Request("https://example.invalid",{method:"POST",body:JSON.stringify({landingName:"synthetic",phoneId:1,phone:"000001",reservationId:"synthetic-reservation"})});
  assert.equal((await handler("phone-click").serve(new Request("https://example.invalid"))).status,405);
  assert.equal((await handler("phone-click").serve(new Request("https://example.invalid",{method:"POST",body:"{}"}))).status,400);
  const h=handler("phone-click",{landingMode:"weighted_random",rpcError:"extend_landing_phone_assignment_reservation"});
  assert.equal((await h.serve(req())).status,200);
  assert.equal(h.calls.filter(c=>c.name==="increment_phone_assignment_scope_usage").length,1);
  assert.equal(h.calls.find(c=>c.name==="extend_landing_phone_assignment_reservation")?.params.p_reservation_id,"synthetic-reservation");
  assert.equal((await handler("phone-click",{landingMode:"weighted_random",rpcError:"increment_phone_assignment_scope_usage"}).serve(req())).status,500);
});

test("fair counter and quota CTA clicks require a reservation and share the idempotent RPC", async () => {
  const reservationId="00000000-0000-4000-8000-000000000001";
  const req=(id?:string)=>new Request("https://example.invalid",{method:"POST",body:JSON.stringify({landingName:"synthetic",phoneId:1,phone:"000001",reservationId:id})});
  for (const landingMode of ["weighted_quota","fair"]) {
    assert.equal((await handler("phone-click",{landingMode}).serve(req())).status,400);
    const h=handler("phone-click",{landingMode});
    assert.equal((await h.serve(req(reservationId))).status,200);
    assert.equal(h.calls.find(c=>c.name==="count_landing_controlled_click")?.params.p_reservation_id,reservationId);
    assert.equal(h.calls.some(c=>c.name==="increment_phone_assignment_scope_usage"),false);
  }
  const fairMessages=handler("phone-click",{landingMode:"fair",landingCriterion:"messages_received"});
  assert.equal((await fairMessages.serve(req())).status,200);
  assert.equal(fairMessages.calls.some(c=>c.name==="increment_phone_assignment_scope_usage"),true);
});
