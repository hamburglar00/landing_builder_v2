import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createServer } from "node:http";
const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(new URL("../frontend/package.json", import.meta.url));
const { build } = require("esbuild");
let playwright;
try { playwright = require(path.join(process.env.APPDATA, "npm/node_modules/playwright")); }
catch { playwright = require("playwright"); }
const { chromium, webkit } = playwright;
const compiled = await build({ absWorkingDir: root, entryPoints: ["frontend/lib/landing/entryFunnel.client.ts"], bundle: true,
  write: false, platform: "node", format: "esm", target: "es2022", keepNames: true });
const helper = await import("data:text/javascript;base64," + Buffer.from(compiled.outputFiles[0].text).toString("base64"));
const factory = helper.buildEntryFunnelFactoryScript();
const landing = "b453a8c5-a91a-4511-ac22-28bcfa4ea97c";
let checks = 0;
for (const [name, engine] of [["Chromium", chromium], ["WebKit", webkit]]) {
  const browser = await engine.launch({ headless: true });
  let localServer;
  try {
    const page = await browser.newPage(); const batches = []; let failNext = false;
    const html = `<html><body><form data-template7-form><input data-template7-name required><button>Create</button></form></body></html>`;
    await page.route("**/*", async route => {
      if (new URL(route.request().url()).pathname === "/api/entry-funnel") {
        batches.push(JSON.parse(route.request().postData() || "{}"));
        const status = failNext ? 503 : 204; failNext = false;
        return route.fulfill({ status });
      }
      return route.fulfill({ contentType: "text/html", body: html });
    });
    await page.goto("https://landing.panelbotadmin.com/fixture");
    await page.evaluate(({ landing, factory }) => {
      window.__ENTRY_FUNNEL_EARLY__ = { started_at: Date.now() - 300, events: [
        { name: "page_visible", at: Date.now() - 200 }, { name: "name_started", at: Date.now() - 100 },
        { id: "f0000000-0000-4000-8000-000000000001", name: "cta_clicked", at: Date.now() - 70 },
        { id: "f0000000-0000-4000-8000-000000000002", name: "entry_error", at: Date.now() - 50, error_code: "network_error" },
      ] };
      const install = (0, eval)(factory);
      install({ landingId: landing, template: 7, targetProvider: "ganamos_net" });
    }, { landing, factory });
    await page.locator("[data-template7-name]").fill("Nombre Privado Parcial");
    await page.locator("[data-template7-name]").fill("Nombre Privado Completo");
    await page.evaluate(() => window.__entryFunnel.emit("entry_error", {error_stage:"wallet",error_code:"request_timeout",status:504,duration_ms:3000,message:"private-message",token:"private-token"}));
    await page.evaluate(() => window.__entryFunnel.flush());
    await page.waitForFunction(() => performance.getEntriesByType("resource").some(e=>e.name.includes("entry-funnel")));
    const events = batches.flatMap(b=>b.events);
    for (const stage of ["page_visible", "form_visible", "name_focus", "name_started", "name_valid"]) assert.equal(events.filter(e=>e.name===stage).length,1,stage);
    assert.equal(events.find(e=>e.name==="name_started").elapsed_ms,200);
    assert.equal(events.find(e=>e.name==="cta_clicked").id,"f0000000-0000-4000-8000-000000000001");
    assert.equal(events.find(e=>e.name==="entry_error").id,"f0000000-0000-4000-8000-000000000002");
    assert.equal(events.find(e=>e.name==="entry_error").error_code,"network_error");
    assert.deepEqual(events.filter(e=>e.error_stage==="wallet").map(({error_stage,error_code,status,duration_ms})=>({error_stage,error_code,status,duration_ms})),[{error_stage:"wallet",error_code:"request_timeout",status:504,duration_ms:3000}]);
    assert.doesNotMatch(JSON.stringify(batches),/Nombre|Privado|Parcial|Completo|password|fbclid|token/);
    const flow = await page.evaluate(() => window.__entryFunnel.flowId);
    checks++;
    await page.reload();
    await page.evaluate(({landing,factory}) => (0,eval)(factory)({landingId:landing,template:7}),{landing,factory});
    assert.equal(await page.evaluate(() => window.__entryFunnel.flowId),flow,"same tab resumes the diagnostic flow");
    checks++;
    batches.length = 0; failNext = true;
    await page.evaluate(() => {window.__entryFunnel.emit("cta_clicked");window.__entryFunnel.flush();});
    await page.waitForTimeout(2600);
    assert.ok(batches.length>=2,"retry after failed telemetry delivery");
    assert.deepEqual(batches[0].events.map(e=>e.id),batches[1].events.slice(0,batches[0].events.length).map(e=>e.id),"replay preserves original IDs even when new visibility events join the queue");
    checks++;

    // Gateway cookie is HttpOnly. Diagnostics must include it using same-origin credentials.
    let lastCookie = "";
    await page.unroute("**/*"); batches.length=0;
    // Use actual loopback HTTP for cookie transport. WebKit route interception does not expose it reliably.
    localServer = createServer(async (req,res)=>{
      if(req.url==="/api/entry-funnel"){
        const chunks=[];for await(const chunk of req)chunks.push(chunk);
        batches.push(JSON.parse(Buffer.concat(chunks).toString()));lastCookie=req.headers.cookie||"";
        res.writeHead(204);res.end();return;
      }
      res.writeHead(200,{"Content-Type":"text/html","Set-Cookie":"gateway_entry_funnel=encrypted-fixture; Path=/; HttpOnly; SameSite=Lax"});
      res.end("<html><body>Gateway</body></html>");
    });
    await new Promise(resolve=>localServer.listen(0,"127.0.0.1",resolve));
    await page.goto(`http://127.0.0.1:${localServer.address().port}/home`);
    const context={landing_id:landing,flow_id:flow,template:7,telemetry_origin:"https://landing.panelbotadmin.com",started_at:Date.now()-1000};
    const firstResponse = page.waitForResponse(response=>response.url().endsWith("/api/entry-funnel"));
    await page.evaluate(({factory,context})=>{
      const install=(0,eval)(factory);install({},context);window.__entryFunnel.emit("gateway_loaded");window.__entryFunnel.flush();
    },{factory,context});
    await firstResponse;
    assert.match(lastCookie,/gateway_entry_funnel=encrypted-fixture/);
    const next={...context,flow_id:"f0000000-0000-4000-8000-000000000009"};
    const nextResponse = page.waitForResponse(response=>response.url().endsWith("/api/entry-funnel"));
    await page.evaluate(({factory,context})=>{
      const old=window.__entryFunnel;const install=(0,eval)(factory);install({},context);
      old.emit("entry_error",{error_code:"unknown"});window.__entryFunnel.emit("chat_ready");window.__entryFunnel.flush();
    },{factory,context:next});
    await nextResponse;
    assert.equal(batches.at(-1).flow_id,next.flow_id);
    assert.deepEqual(batches.at(-1).events.map(e=>e.name),["chat_ready"]);
    assert.doesNotMatch(JSON.stringify(batches),/encrypted-fixture/);
    checks++;
    await page.close();
    console.log(name+": form/early typing, privacy, resume, stable retry and authenticated gateway diagnostics passed.");
  } finally { await browser.close(); if(localServer)await new Promise(resolve=>localServer.close(resolve)); }
}
console.log(`${checks} entry funnel browser scenarios passed; intercepted public requests and loopback-only cookie collector, no production tracking.`);
