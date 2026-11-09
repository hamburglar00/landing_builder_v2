import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { POST } from "../app/api/bots/workspace/route";
const owner="96000000-0000-4000-8000-000000000001";
const uuid=(n:number)=>`96000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const request=(body:object,origin="https://builder.fixture.invalid")=>new Request("https://builder.fixture.invalid/api/bots/workspace",{
  method:"POST",headers:{Origin:origin,Authorization:"Bearer synthetic-user-token","Content-Type":"application/json"},body:JSON.stringify(body),
});
function fixture(t:TestContext){
  process.env.NEXT_PUBLIC_SUPABASE_URL="https://database.fixture.invalid";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY="synthetic-public";
  process.env.INTERNAL_CHAT_ORIGIN="https://atrio.fixture.invalid";
  process.env.INTERNAL_CHAT_PLAYER_RESOLVE_KEY="synthetic-private-bridge-key";
  let canAtrio=true;
  let inactive=17;
  let cleanupFailure=false;
  let onBatch=()=>{};
  const calls:{url:URL;body:Record<string,unknown>;headers:Headers}[]=[];
  const clients=Array.from({length:253},(_,i)=>({id:uuid(i+10),atrio_id:uuid(i+1000),user_id:owner}));
  t.mock.method(globalThis,"fetch",async(input:RequestInfo|URL,init?:RequestInit)=>{
    const r=new Request(input,init),url=new URL(r.url),body=await r.text();
    calls.push({url,body:body?JSON.parse(body):{},headers:r.headers});
    if(url.pathname==="/auth/v1/user")return Response.json({id:owner,aud:"authenticated"});
    if(url.pathname==="/rest/v1/profiles")return Response.json({role:"client"});
    if(url.pathname==="/rest/v1/client_module_permissions")return Response.json({show_atrio:canAtrio});
    if(url.pathname==="/rest/v1/atrio_clients"){
      assert.equal(url.searchParams.get("workspace_currency"),"eq.ARS");assert.equal(url.searchParams.get("user_id"),`eq.${owner}`);
      const offset=Number(url.searchParams.get("offset")||0),limit=Number(url.searchParams.get("limit"));assert.equal(limit,100);
      return Response.json(clients.slice(offset,offset+limit));
    }
    if(url.pathname==="/api/gateway/manager-destinations/reset"){
      assert.equal(r.headers.get("authorization"),"Bearer synthetic-private-bridge-key");return Response.json({ok:true});
    }
    if(url.pathname==="/rest/v1/rpc/delete_inactive_workspace_phone_batch"){
      assert.equal(r.headers.get("authorization"),"Bearer synthetic-user-token");
      if(cleanupFailure)return Response.json({code:"57014",message:"synthetic timeout"},{status:500});
      const deleted=Math.min(inactive,25);inactive-=deleted;onBatch();return Response.json(deleted);
    }
    throw Error(`Unexpected synthetic request ${url.pathname}`);
  });
  return {calls,disable:()=>{canAtrio=false},inactive:(count:number)=>{inactive=count},failCleanup:()=>{cleanupFailure=true},onBatch:(callback:()=>void)=>{onBatch=callback}};
}
test("global operations reject foreign origin, missing session and caller-supplied ownership",async t=>{
  const f=fixture(t);
  assert.equal((await POST(request({action:"reset_atrio",workspace:"ARS",metric:"usage_count"},"https://foreign.invalid"))).status,403);
  const absent=request({});absent.headers.delete("authorization");assert.equal((await POST(absent)).status,401);
  assert.equal((await POST(request({action:"reset_atrio",workspace:"ARS",metric:"usage_count",targetUserId:uuid(4)}))).status,400);
  assert.equal(f.calls.length,0);
});
test("global Atrio reset resolves all pages of the caller workspace in bounded batches",async t=>{
  const f=fixture(t),response=await POST(request({action:"reset_atrio",workspace:"ARS",metric:"messages_received"}));
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{ok:true,completed:253});
  const resets=f.calls.filter(c=>c.url.origin==="https://atrio.fixture.invalid");
  assert.deepEqual(resets.map(c=>(c.body.advisor_ids as string[]).length),[100,100,53]);
  assert.ok(resets.every(c=>c.body.metric==="messages_received"));
});
test("disabled Atrio never contacts the bridge; inactive deletion keeps caller RLS and workspace",async t=>{
  const f=fixture(t);f.disable();
  assert.equal((await POST(request({action:"reset_atrio",workspace:"ARS",metric:"usage_count"}))).status,403);
  assert.equal(f.calls.some(c=>c.url.origin==="https://atrio.fixture.invalid"),false);
  const response=await POST(request({action:"delete_inactive",workspace:"PYG"}));
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{deleted:17});
  assert.deepEqual(f.calls.find(c=>c.url.pathname.endsWith("delete_inactive_workspace_phone_batch"))!.body,{p_workspace:"PYG"});
});

test("inactive cleanup completes all bounded batches without loading directory pages",async t=>{
  const f=fixture(t);f.inactive(120);
  const response=await POST(request({action:"delete_inactive",workspace:"ARS"}));
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{deleted:120});
  const batches=f.calls.filter(c=>c.url.pathname.endsWith("delete_inactive_workspace_phone_batch"));
  assert.equal(batches.length,5);assert.ok(batches.every(c=>c.body.p_workspace==="ARS"));
  assert.equal(f.calls.some(c=>c.url.pathname==="/rest/v1/gerencias"),false);
});

test("failed cleanup reports pending work instead of claiming success",async t=>{
  const f=fixture(t);f.failCleanup();
  const response=await POST(request({action:"delete_inactive",workspace:"ARS"}));
  assert.equal(response.status,503);assert.match((await response.json()).error,/completar los pendientes/);
});

test("slow cleanup returns bounded continuation and retries finish only the remaining phones",async t=>{
  const f=fixture(t);f.inactive(80);
  let now=Date.now();t.mock.method(Date,"now",()=>now);f.onBatch(()=>{now+=41000});
  const results=[];
  for(let i=0;i<4;i++){
    const response=await POST(request({action:"delete_inactive",workspace:"ARS"}));
    assert.equal(response.status,200);results.push(await response.json());
  }
  assert.deepEqual(results,[{deleted:25,pending:true},{deleted:25,pending:true},{deleted:25,pending:true},{deleted:5}]);
});
