import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(new URL("../frontend/package.json", import.meta.url));
const { build } = require("esbuild");
let browsers;
try { browsers = require(path.join(process.env.APPDATA, "npm/node_modules/playwright")); } catch { browsers = require("playwright"); }
const workspace = fileURLToPath(new URL("../../", import.meta.url));
const assets = [];
for (const repo of ["landing-autologuin", "ases-gateway", "ganamos-gateway", "multi-skin-gateway"]) {
  const cwd = path.join(workspace, repo);
  const bundle = await build({absWorkingDir:cwd,stdin:{resolveDir:cwd,loader:"ts",contents:'export {renderPreparationPage} from "./src/lib/preparation-page";'},bundle:true,write:false,platform:"node",format:"cjs"});
  const mod = {exports:{}};new Function("module","exports",bundle.outputFiles[0].text)(mod,mod.exports);
  const theme={title:repo,logo:"/fixture.svg",logoAlt:repo,background:"#121212",accent:"#f5c518",accentText:"#111",text:"#fff",muted:"#ddd",panel:"#222",panelBorder:"#666",spinnerTrack:"#333",shadow:"none"};
  assets.push({repo,render:token=>mod.exports.renderPreparationPage(token,theme)});
}

const checks=[];
for (const [engine,type] of [["Chromium",browsers.chromium],["WebKit",browsers.webkit]]) {
  const browser=await type.launch({headless:true});
  try {
    for (const {repo,render} of assets) for (const scenario of ["normal","expired","mismatch-recovered","mismatch-permanent","unrelated-active","cookie-changed","cookie-repaired","cookie-blocked","classic","classic-expired"]) {
      const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[],calls=[];
      page.setDefaultTimeout(6000);
      page.on("pageerror",error=>errors.push(error.message));
      let starts=0,renewals=0,confirmations=0;
      // Only shorten the configured display wait; do not mask recovery deadlines.
      await page.addInitScript(()=>{const timer=window.setTimeout;window.setTimeout=(fn,ms,...args)=>timer(fn,ms>1000&&ms<61000&&ms!==45000&&ms!==15000?100:ms,...args)});
      await page.route("https://fixture.test/**",async route=>{
        const request=route.request(),url=new URL(request.url()),pathname=url.pathname;
        calls.push(pathname);
        if(pathname==="/prepare")return route.fulfill({contentType:"text/html",body:render(scenario.startsWith("classic")?"classic-handoff":"p1.fixture")});
        if(pathname==="/fixture.svg")return route.fulfill({contentType:"image/svg+xml",body:'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80"/>'});
        if(pathname==="/api/preparations/complete")return route.fulfill({json:{username:"belucolla123456",continuation_token:"c1.original",entry_token:"ge1.expected",handoff_url:"https://fixture.test/start?t=original"}});
        if(pathname==="/api/preparations/finalize"){
          renewals++;
          assert.deepEqual(request.postDataJSON(),{continuation_token:"c1.original",entry_token:"ge1.expected",renew_handoff:true});
          return route.fulfill({json:{handoff_url:"https://fixture.test/start?t=renewed",entry_token:"ge1.renewed"}});
        }
        if(pathname==="/start"){
          starts++;
          if(scenario==="classic-expired"||(scenario==="expired"&&starts===1))return route.fulfill({status:410,body:"expired"});
          const wrong=scenario==="mismatch-permanent"||(scenario==="mismatch-recovered"&&starts===1);
          if(!scenario.startsWith("classic")){
            const expected=starts===1?"ge1.expected":"ge1.renewed";
            assert.equal(request.headers()["x-gateway-entry"],expected);
            assert.equal(request.headers().authorization,"Gateway-Entry "+expected);
          }
          return route.fulfill({json:{username:wrong?"benja684826":"belucolla123456",password:wrong?"wrong-fixture-secret":"fixture-secret",recovery_token:"gr1.fixture",redirect_url:"https://fixture.test/home",entry_confirmation:"ge1.confirmation",entry_id:"same-entry",entry_wait:{enabled:scenario==="cookie-changed",seconds:2}}});
        }
        if(pathname==="/api/session/recover"){
          confirmations++;
          assert.equal(request.postDataJSON().entry_confirmation,"ge1.confirmation");
          if(scenario==="cookie-repaired"||scenario==="cookie-blocked"){
            if(confirmations%2===1){
              assert.equal(request.postDataJSON().recovery_token,"gr1.fixture");
              return route.fulfill({json:{active:true,entry_repaired:true,entry_confirmed:false,entry_id:"same-entry"}});
            }
            assert.equal(request.postDataJSON().recovery_token,null);
            if(scenario==="cookie-blocked")return route.fulfill({status:409,json:{active:false,error:"entry_mismatch"}});
          }
          if(scenario==="unrelated-active")return route.fulfill({json:{active:true}});
          if(scenario==="cookie-changed"&&confirmations===1)return route.fulfill({status:409,json:{active:false,error:"entry_mismatch"}});
          return route.fulfill({json:{active:true,entry_confirmed:true,entry_id:"same-entry"}});
        }
        if(pathname==="/home")return route.fulfill({contentType:"text/html",body:"<main>belucolla123456</main>"});
        throw Error("Unexpected fixture request: "+pathname);
      });
      await page.goto("https://fixture.test/prepare");
      const failed=["mismatch-permanent","unrelated-active","cookie-blocked","classic-expired"].includes(scenario);
      if(failed){
        await page.locator('main[data-view="error"]').waitFor();
        assert.equal(new URL(page.url()).pathname,"/prepare");
        assert.equal(await page.locator("#password").innerText()==="wrong-fixture-secret",false);
      }else{
        await page.waitForURL("https://fixture.test/home");
        assert.equal(await page.locator("main").innerText(),"belucolla123456");
      }
      assert.equal(renewals,["expired","mismatch-recovered","mismatch-permanent","unrelated-active","cookie-changed","cookie-blocked"].includes(scenario)?1:0);
      assert.equal(calls.filter(path=>path==="/api/preparations/complete").length,scenario.startsWith("classic")?0:1);
      assert.deepEqual(errors,[]);
      checks.push({engine,repo,scenario,result:"passed",starts,renewals,confirmations});
      await page.close();
    }
  } finally {await browser.close();}
}
const artifact=new URL("../.vercel/validation-entry-identity/",import.meta.url);
await mkdir(artifact,{recursive:true});await writeFile(new URL("results.json",artifact),JSON.stringify(checks,null,2));
console.log(`${checks.length} browser entry identity checks passed across four gateways in Chromium and WebKit. No live accounts or provider operations used.`);
