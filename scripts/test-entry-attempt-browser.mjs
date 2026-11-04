// Production serialized installer in real browsers; HTTP is isolated before navigation.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { withTestBrowser } from "../../internal-chat/tests/helpers/browser-session.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(new URL("../frontend/package.json", import.meta.url));
const { build } = require("esbuild");
const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE_PATH || path.join(process.env.APPDATA,"npm/node_modules/playwright"));
const compiled = await build({absWorkingDir:root,entryPoints:["frontend/lib/landing/entryFunnel.client.ts"],bundle:true,write:false,platform:"node",format:"esm",target:"es2022",keepNames:true});
const helper = await import("data:text/javascript;base64,"+Buffer.from(compiled.outputFiles[0].text).toString("base64"));
const factory = helper.buildEntryFunnelFactoryScript();
const landing = "f0000000-0000-4000-8000-000000000001";
let scenarios = 0;
for (const engine of [chromium,webkit]) await withTestBrowser(engine,async browser => {
  for (const template of [7,8,9]) {
    const context = await browser.newContext();
    try {
      const page = await context.newPage(), batches = [], errors = [];
      page.on("pageerror",error=>errors.push(error.message));
      await context.route("**/*",route=>new URL(route.request().url()).pathname === "/api/entry-funnel"
        ? (batches.push(route.request().postDataJSON()),route.fulfill({status:204}))
        : route.fulfill({contentType:"text/html",body:'<form data-template7-form><input data-template7-name required></form>'}));
      await page.goto("https://landing.panelbotadmin.com/fixture");
      await page.evaluate(({factory,landing,template})=>{
        (0,eval)(factory)({landingId:landing,template,targetProvider:"ganamos_net"});
        const api=window.__entryFunnel;
        api.emit("cta_clicked");window.first=api.context();
        api.timings('t7-account;dur=1200;desc="created", t7-context;dur=70, atrio_provider_create;dur=1000, secret;desc="private"');
        api.emit("entry_retry",{error_stage:"login",status:503});
        api.emit("stage_timing",{phase:"provider_login",duration_ms:400});
        for(const phase of ['casino_ttfb','casino_download','casino_navigation'])api.emit('stage_timing',{phase,duration_ms:80});
        api.emit("chat_usable");api.emit("chat_usable");window.afterRetry=api.context();
        api.emit("cta_clicked");window.second=api.context();
        api.timings('t7-account;dur=15;desc="recovered"');api.emit("chat_usable");
        api.emit("stage_timing",{phase:"secret-url",duration_ms:20});api.emit("stage_timing",{phase:"provider_login",duration_ms:-1});api.flush();
      },{factory,landing,template});
      await page.waitForFunction(()=>performance.getEntriesByType("resource").some(e=>e.name.includes("entry-funnel")));
      await page.evaluate(()=>window.__entryFunnel.flush());await page.waitForTimeout(120);
      const state=await page.evaluate(()=>({first:window.first,after:window.afterRetry,second:window.second,context:window.__entryFunnel.context()}));
      assert.equal(state.first.attempt_id,state.after.attempt_id,"retry retains attempt");
      assert.notEqual(state.first.attempt_id,state.second.attempt_id,"new CTA starts an attempt");
      assert.equal(state.second.attempt_number,2);assert.equal(state.context.account_kind,"existing");
      const events=batches.flatMap(batch=>batch.events);
      assert.equal(events.filter(e=>e.name==="chat_usable").length,2,"once per attempt");
      assert.equal(events.filter(e=>e.name==="entry_retry").length,1);
      assert.equal(events.find(e=>e.phase==="provider_create").account_kind,"new");
      assert.ok(events.find(e=>e.phase==="landing_navigation").duration_ms>=0);
      for(const phase of ['casino_ttfb','casino_download','casino_navigation'])assert.equal(events.find(e=>e.phase===phase)?.duration_ms,80,'browser accepts '+phase);
      assert.doesNotMatch(JSON.stringify(events),/private|secret-url|password|token/);
      assert.deepEqual(errors,[]);scenarios++;
      const supplied={...state.context,account_kind:"new"};
      await page.evaluate(({factory,supplied})=>(0,eval)(factory)({},supplied),{factory,supplied});
      assert.equal(await page.evaluate(()=>window.__entryFunnel.context().account_kind),"new","same-flow signed metadata is adopted");
    } finally {await context.close();}
  }
});
console.log(`Entry attempts: ${scenarios} Chromium/WebKit scenarios passed (T7/T8/T9, navigation, retries, account kind and privacy).`);
