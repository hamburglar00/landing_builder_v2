import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import ts from "typescript";

function client(session: {access_token: string} | null, error: Error | null = null) {
  const exports: {phoneAdministrationHeaders?: () => Promise<Record<string,string>>} = {};
  const code=ts.transpileModule(readFileSync(new URL("../lib/phones/administrationClient.ts",import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  runInNewContext(code,{exports,process:{env:{NEXT_PUBLIC_SUPABASE_ANON_KEY:"synthetic-public-key"}},require:(name:string)=>{
    assert.equal(name,"@/lib/supabaseClient");
    return {supabase:{auth:{getSession:async()=>({data:{session},error})}}};
  }});
  assert.ok(exports.phoneAdministrationHeaders);
  return exports.phoneAdministrationHeaders;
}

test("phone administration transports the user token, not the public application key",async()=>{
  const headers=await client({access_token:"synthetic-user-session"})();
  assert.equal(headers.Authorization,"Bearer synthetic-user-session");
  assert.equal(headers.apikey,"synthetic-public-key");
  assert.equal(headers["Content-Type"],"application/json");
});

test("phone administration refuses missing or failed browser session",async()=>{
  await assert.rejects(client(null),/sesion valida/);
  await assert.rejects(client({access_token:"synthetic-user-session"},new Error("synthetic")),/sesion valida/);
});

test("phone screens use authenticated headers and leave public assignment on its existing backend",()=>{
  const screen=readFileSync(new URL("../components/telefonos/TelefonosPageContent.tsx",import.meta.url),"utf8");
  const operations=screen.slice(screen.indexOf("const handleSync ="),screen.indexOf("const handleAutoResetToggle"));
  assert.equal((operations.match(/headers: await phoneAdministrationHeaders\(\)/g)??[]).length,3);
  assert.ok(!operations.includes("user_id: userId"));
  const publicClient=readFileSync(new URL("../components/public-landing/getLandingPhone.ts",import.meta.url),"utf8");
  assert.ok(publicClient.includes("/functions/v1/landing-phone"));
  assert.ok(!publicClient.includes("SERVICE_ROLE"));
});
