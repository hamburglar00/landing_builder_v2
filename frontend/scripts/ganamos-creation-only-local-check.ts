import assert from "node:assert/strict";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { FlowFixture, ids, secrets } from "./template7-local-flow/fixture";
import { loadApi2 } from "./template7-local-flow/source-loader";

async function main() {
const index = process.argv.indexOf("--api2-repo");
assert.ok(index >= 0 && process.argv[index + 1]);
const root = path.resolve(process.argv[index + 1]);
const previousFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new Error("External requests forbidden in this test"); };
const globalState = globalThis as unknown as Record<string, unknown>;
try {
  const api2 = await loadApi2(root);
  const checks: string[] = [];
  async function scenario(mode: undefined | "complete" | "create_only", dedicated = false, invalidKey = false, mismatchedAdvisor = false) {
    const fixture = new FlowFixture();
    globalState.__TEMPLATE7_LOCAL_FLOW__ = fixture;
    fixture.managerService.getAtrioOperationalContext = async () => ({agency:{id:17,platform:2},credentials:{username:"local-manager",password:"local-password",platform:2}});
    const calls: string[] = [];
    const controller = Object.assign(new api2.LocalPlayerController(), {
      managerService: fixture.managerService, playerService: fixture.playerService, credentialService: fixture.credentialService,
      ganamosApiClient: {
        createPlayerOnly: async () => { calls.push("create_only"); return true; },
        createPlayerComplete: async () => { calls.push("complete"); return true; },
      },
    });
    const payload = {external_user_id:"local-player",name:"Local Player",advisor_id:mismatchedAdvisor?"other-advisor":ids.advisor,agency_id:17,...(mode?{creation_mode:mode}:{})};
    let status = 0, body: Record<string, unknown> = {};
    const context = {
      request: {all:()=>payload,input:(key:string)=>(payload as Record<string, unknown>)[key],param:(key:string)=>key==="manager_id"?"1035":undefined,
        header:(key:string)=>key==="apikey"?(invalidKey?"invalid":secrets.apiKey):key==="apisecret"?secrets.apiSecret:undefined},
      response: {header(){return this;},status(code:number){status=code;return this;},send(value:Record<string,unknown>){body=value;return this;}},
    };
    const invoke = () => new api2.LocalApiKeyMiddleware().handle(context, () => dedicated ? controller.apiExternalPlayerCreateOnly(context) : controller.apiExternalPlayerCreate(context));
    await invoke();
    if (invalidKey || mismatchedAdvisor) {
      assert.equal(status, invalidKey ? 401 : 403);assert.deepEqual(calls,[]);assert.equal(fixture.apiPlayers.size,0);return;
    }
    assert.equal(status,201);assert.equal(body.success,true);assert.equal(body.platform,2);assert.deepEqual(calls,[dedicated||mode==="create_only"?"create_only":"complete"]);
    await invoke();assert.equal(status,200);assert.equal(calls.length,1);assert.equal(fixture.apiPlayers.size,1);assert.equal(fixture.credentials.size,1);
  }
  await scenario(undefined);checks.push("Existing endpoint defaults to the complete flow and replay creates no extra account");
  await scenario("complete");checks.push("Explicit complete mode preserves existing clients");
  await scenario("create_only");checks.push("Template 7 mode selects only creation, keeping persistent identity and credential replay");
  await scenario("complete",true);checks.push("Dedicated create-only endpoint selects creation-only even when complete was submitted");
  await scenario("create_only",false,true);checks.push("Invalid API credentials cannot reach either creation path");
  await scenario("create_only",false,false,true);checks.push("A different advisor cannot create an account under the manager");
  const routes=await readFile(path.join(root,"start/routes/api_bot.routes.ts"),"utf8");
  assert.match(routes,/players\/create-only[\s\S]{0,220}apiExternalPlayerCreateOnly[\s\S]{0,140}validate_bot_api_keys_middleware/);
  checks.push("Dedicated API route retains the existing API key middleware");
  console.log(JSON.stringify({checks,passed:checks.length,api2Deployed:false,externalRequests:0,productionDatabaseWrites:0},null,2));
} finally {
  globalThis.fetch=previousFetch;delete globalState.__TEMPLATE7_LOCAL_FLOW__;
}
}
main().catch(error => {console.error(error instanceof Error ? error.message : "Local contract check failed");process.exitCode=1;});
