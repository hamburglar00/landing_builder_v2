/* eslint-disable @typescript-eslint/no-explicit-any -- Synthetic HTTP/browser fixture records intentionally accept runtime JSON. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { renderPublicLandingHtml } from "../components/public-landing/renderPublicLandingHtml";
import { buildLandingConfig } from "../lib/landing/buildLandingConfig";
import { DEFAULT_CONFIG } from "../lib/landing/mocks";
import { normalizeTemplate8Cover } from "../lib/landing/template8";
import { handleTemplate7Destination } from "../lib/atrio/template7Destination.server";
import { handleTemplate7Prepare, decryptClaims } from "../lib/reyDeAses/preparation-issue.server";
import { handleTemplate7StartWithIdentity, type StartDependencies } from "../lib/reyDeAses/start.server";

// Real Chromium, HTTP handlers and isolated Postgres. Casino/Meta/gateway are stubs;
// no production account, message, tracking event or financial operation is sent.
async function main() {
const container = process.env.ATRIO_MANAGER_TEST_CONTAINER || "";
assert.match(container, /^atrio-manager-validation-[a-z0-9-]+$/);
const info = JSON.parse(execFileSync("docker", ["inspect", container], {encoding:"utf8",windowsHide:true}))[0];
assert.equal(info.HostConfig.NetworkMode,"none");
assert.equal(Object.keys(info.HostConfig.PortBindings || {}).length,0);
const sql = (query: string) => execFileSync("docker",["exec","-i",container,"psql","-U","supabase_admin","-d","validation","-Atq","-v","ON_ERROR_STOP=1"],{input:query,encoding:"utf8",windowsHide:true,stdio:["pipe","pipe","pipe"]}).trim();
const id = (n: number) => `a0000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const advisorIds = [id(3),id(4)];
const providers = ["rey_de_ases","ases_del_norte","ganamos_net"] as const;
const allowed = `'{${advisorIds.join(",")}}'::uuid[]`;
sql(`insert into advisor_manager_connections(id,advisor_id,manager_id,agency_id,target_provider,manager_type) values
 ('${id(521)}','${id(4)}',1521,1521,'ganamos_net','full_carga'),
 ('${id(522)}','${id(3)}',1522,1522,'ases_del_norte','mkt') on conflict(id) do nothing;`);
process.env.NEXT_PUBLIC_SUPABASE_URL="https://events.invalid";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY="synthetic-anon";
process.env.TEMPLATE7_PREPARATION_TOKEN_KEY="isolated-test-preparation-key-at-least-32-characters";
for (const [key, origin] of [["REY_GATEWAY_ORIGIN","https://rey.invalid"],["ASES_DEL_NORTE_GATEWAY_ORIGIN","https://ases.invalid"],["GANAMOS_NET_GATEWAY_ORIGIN","https://net.invalid"]]) process.env[key]=origin;
const renderClassicTemplate7InlineHtml = createRequire(path.resolve("package.json"))(path.resolve("../../landing-prueba-1/lib/template7/shared.cjs")).renderClassicTemplate7InlineHtml as typeof import("../components/public-landing/renderPublicLandingHtml").renderClassicTemplate7InlineHtml;
const classic = await import(pathToFileURL(path.resolve("../../landing-prueba-1/lib/reyDeAses/start.server.ts")).href);
let run: any;
const server = createServer(async (req,res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    const chunks: Buffer[]=[]; for await(const chunk of req) chunks.push(Buffer.from(chunk));
    const body=Buffer.concat(chunks).toString();
    const request=new Request(url,{method:req.method,headers:req.headers as HeadersInit,...(body?{body}:{})});
    let response: Response;
    if (url.pathname==="/api/client-identity/bootstrap") response=Response.json({ok:true},{headers:{"Set-Cookie":`lb_cid=${run.device}; Path=/; HttpOnly; SameSite=Lax`}});
    else if (url.pathname==="/api/template7/destination") {
      run.destination.push(JSON.parse(body));
      response=await handleTemplate7Destination(request,run.device,{
        context:async()=>({allowed:true,blocked:false,landing:run.landing,advisors:run.advisors}),
        resolve:async(input:any)=>JSON.parse(sql(`select select_builder_page_destination('${input.landing_id}','${input.target_provider}','${input.device_id}',${allowed},${input.reserve_only===true});`)),
        fallback:async()=>{throw Error("No legacy fallback for Template 8");},
      },run.engine==="classic");
    } else if(url.pathname==="/api/template7/prepare") {run.starts.push(JSON.parse(body));response=await handleTemplate7Prepare(request);}
    else if(url.pathname==="/api/template7/start") {run.starts.push(JSON.parse(body));response=await classic.handleTemplate7Start(request,run.deps);}
    else if(url.pathname==="/api/track") {run.events.push({path:url.pathname,body:JSON.parse(body).payload});response=Response.json({ok:true});}
    else if(url.pathname.endsWith(".js")) response=new Response("/* local static stub */",{headers:{"Content-Type":"text/javascript"}});
    else if(url.pathname.startsWith("/api/")) response=Response.json({ok:true});
    else response=new Response(run.html,{headers:{"Content-Type":"text/html; charset=utf-8"}});
    res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  } catch(error) {run.errors.push(String(error));res.writeHead(500);res.end("test handler failed");}
});
await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
const address=server.address() as {port:number};const origin=`http://127.0.0.1:${address.port}`;
const browser=await chromium.launch({headless:true});
const results: object[]=[];
const seed=Date.now()%100000000+10000;
try {
  for(const engine of ["constructor","classic"]) for(const selected of [1,2,3]) {
    const landingId=id(seed+results.length),device=id(seed+100+results.length);
    for(const [i,provider] of providers.entries()) sql(`select configure_builder_manager_pool('${landingId}','${provider}',${allowed},'fixed','usage_count','[{"connection_id":"${[id(6),id(522),id(521)][i]}","weight":1}]');`);
    const cover=normalizeTemplate8Cover({cardCount:3}); cover.cards=cover.cards.map((card,i)=>({...card,targetProvider:providers[i%3],text:providers[i%3]}));
    const raw={...DEFAULT_CONFIG,template:"template8" as const,ctaDestination:"atrio" as const,template8Cover:cover};
    const config=buildLandingConfig({id:landingId,name:"template8-e2e",comment:"Isolated E2E fixture",pixelId:"123456",postUrl:"https://events.invalid/conversions",landingTag:"TEST8",config:raw});
    const advisors=advisorIds.map((advisor,i)=>({id:id(800+i),atrio_id:advisor,slug:i?"beto":"ana",user_id:id(1),workspace_currency:"ARS"}));
    const landing={id:landingId,name:"template8-e2e",user_id:id(1),workspace_currency:"ARS",config:raw,landing_config:config};
    let casinoCreates=0;
    const deps: StartDependencies={
      db:{landing:async()=>landing,blocked:async()=>false,assignment:async(_,client)=>({landing_id:landingId,atrio_client_id:client,user_id:id(1)}),advisor:async client=>advisors.find(row=>row.id===client)!},
      api2Status:()=>null,gatewayStatus:()=>null,allowStart:async()=>true,
      resolvePlayer:async(input)=>JSON.parse(sql(`select row_to_json(r) from resolve_gateway_player_identity_v3('${input.advisor.advisorId}','${input.advisor.advisorSlug}','${device}','E2E visitor','landing_builder','${landingId}','template8-e2e','${input.advisor.atrioClientId}','TEST8-promo','${input.targetProvider}',null) r;`)),
      resolveAccount:async input=>{const existing=sql(`select coalesce(provider_username,'') from player_provider_accounts where player_id='${input.external_user_id}' and target_provider='${input.target_provider}';`);if(!existing)casinoCreates++;return {username:existing||"e2e-player",password:"fixture-only",platform:input.target_provider,created:!existing};},
      linkProviderAccount:async(_,player,account)=>{sql(`update player_provider_accounts set provider_username='e2e-player' where id='${player.player_provider_account_id}'; update players set landing_promo_code='TEST8-promo' where id='${player.player_id}';`);return {player_provider_account_id:player.player_provider_account_id,target_provider:account.platform,provider_username:account.username,provider_external_account_id:null};},
      createHandoff:async()=>({handoff_url:"https://final.invalid/prepare?t=fixture",expires_at:new Date(Date.now()+60000).toISOString(),binding_created:true}),
    };
    run={engine,device,landing,advisors,deps,destination:[],starts:[],events:[],errors:[],gatewayVisits:0};
    run.html=engine==="classic"?`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${renderClassicTemplate7InlineHtml({slug:landing.name,config:config as never},`function getOrCreateDeviceId(){return '${device}';}`)}</body></html>`:renderPublicLandingHtml({slug:landing.name,config:config as never});
    const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage();
    page.on("pageerror",(error: Error)=>run.errors.push(error.message));
    await context.route("**/*",async (route: any)=>{
      const url=new URL(route.request().url()); if(url.origin===origin)return route.continue();
      if(url.pathname==="/prepare" && url.searchParams.get("t")?.startsWith("p1.")) {
        const claims=decryptClaims(url.searchParams.get("t")!,process.env,Date.now());
        assert.equal(claims.payload.card_index,selected);
        const result=await handleTemplate7StartWithIdentity(new Request(origin+"/api/template7/start",{method:"POST",headers:{"Content-Type":"application/json",Origin:origin},body:JSON.stringify(claims.payload)}),deps,claims.identity);
        assert.equal(result.status,200,await result.text());run.gatewayVisits++;
        return route.fulfill({contentType:"text/html",body:"<p data-handoff-complete>Gateway handoff confirmed</p>"});
      }
      if(url.hostname==="final.invalid") {run.gatewayVisits++;return route.fulfill({contentType:"text/html",body:"<p data-handoff-complete>Gateway handoff confirmed</p>"});}
      if(route.request().postData()) {try{run.events.push({path:url.pathname,body:JSON.parse(route.request().postData()!)});}catch{}}
      return route.fulfill({contentType:route.request().resourceType()==="script"?"text/javascript":"application/json",body:route.request().resourceType()==="script"?"/* external service stub */":"{}"});
    });
    if (selected === 1) {
      const journeyHtml = run.html;
      for (const cardCount of [1,2,3,4,5,6]) {
        const visual = { ...config, content:{...config.content,template8:{...cover,cardCount,cards:cover.cards.slice(0,cardCount)}} };
        run.html=engine==="classic"?`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${renderClassicTemplate7InlineHtml({slug:landing.name,config:visual as never},`function getOrCreateDeviceId(){return '${device}';}`)}</body></html>`:renderPublicLandingHtml({slug:landing.name,config:visual as never});
        for (const size of [{width:320,height:568},{width:390,height:844},{width:1440,height:900}]) {
          await page.setViewportSize(size);await page.goto(origin+"/l/template8-e2e");
          assert.equal(await page.locator(".template6__card").count(),cardCount);
          const grid=await page.locator(".template6__grid").boundingBox();const last=await page.locator(".template6__card").last().boundingBox();
          assert.ok(grid && last);assert.ok(last.y+last.height<=size.height,`${engine} ${cardCount} cards overflow ${size.width}x${size.height}`);
          if(cardCount%2)assert.ok(Math.abs(last.x+last.width/2-grid.x-grid.width/2)<2,"odd final card stays centered");
          assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
          if(cardCount===6 && size.width===390){await mkdir("test-results/template8",{recursive:true});await page.screenshot({path:`test-results/template8/${engine}-six-cards.png`,fullPage:true});}
        }
      }
      run.html=journeyHtml;run.events=[];run.destination=[];
    }
    await page.goto(origin+"/l/template8-e2e?utm_campaign=e2e&facebook=campaign-owner");
    await page.waitForFunction(()=>Object.keys((window as any).__PUBLIC_LANDING_ATRIO_PROMISES||{}).length===3, null, {timeout:5000}).catch(async (error: Error)=>{console.error({errors:run.errors,destination:run.destination,state:await page.evaluate(()=>({cfg:(window as any).__PUBLIC_LANDING_RUNTIME_CONFIG__,promises:Object.keys((window as any).__PUBLIC_LANDING_ATRIO_PROMISES||{})}))});throw error;});
    await page.waitForTimeout(150);
    assert.equal(run.starts.length,0);assert.equal(run.gatewayVisits,0);assert.equal(casinoCreates,0);
    assert.equal(sql(`select count(*) from landing_manager_assignments where landing_id='${landingId}';`),"0");
    assert.equal(run.events.filter((e:any)=>e.path.includes("landing-card-click")||e.body.event_name==="Contact").length,0);
    for(const width of [320,390,820,1440]) {await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
    await page.setViewportSize({width:390,height:844});
    await page.locator(`[data-template8-card-index="${selected}"]`).click();
    await page.locator("[data-template7-name]").fill("E2E visitor");
    await page.locator(".template7__cta").click();
    await page.locator("[data-handoff-complete]").waitFor();
    assert.equal(casinoCreates,1);assert.equal(run.starts.length,1);assert.equal(run.starts[0].card_index,selected);
    assert.equal(run.starts[0].attribution.utm_campaign,"e2e");assert.equal(run.starts[0].attribution.target_provider,providers[selected-1]);
    assert.equal(run.events.filter((e:any)=>e.path.includes("landing-card-click")).length,1);
    assert.equal(run.events.filter((e:any)=>e.body.event_name==="Contact").length,1);
    assert.equal(sql(`select count(*) from landing_manager_assignments where landing_id='${landingId}';`),"1");
    // A recognized account must still wait for page selection, then resume without a name or duplicate creation.
    run.starts=[];run.events=[];run.gatewayVisits=0;
    await page.goto(origin+"/l/template8-e2e?utm_campaign=e2e-return");await page.waitForTimeout(350);
    assert.equal(run.starts.length,0);assert.equal(await page.locator("[data-template8-grid]").isVisible(),true);
    await page.locator(`[data-template8-card-index="${selected}"]`).click();
    await page.locator("[data-handoff-complete]").waitFor();
    assert.equal(casinoCreates,1);assert.equal(run.starts.length,1);assert.equal(run.starts[0].card_index,selected);
    assert.equal(run.starts[0].attribution.utm_campaign,"e2e-return");
    assert.deepEqual(run.errors,[]);results.push({engine,provider:providers[selected-1],newAccount:true,recovery:true,noPrewarmAssignments:true});
    await context.close();
  }
  console.log(JSON.stringify({passed:results.length*2,results},null,2));
} finally {await browser.close();await new Promise<void>(resolve=>server.close(()=>resolve()));}

}
main().catch(error=>{console.error(error);process.exitCode=1;});
