// Browser-owned APIs and HTTP are fixtures. No real subscriptions or messages.
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {createRequire} from "node:module";
import path from "node:path";
const require=createRequire(new URL("../frontend/package.json",import.meta.url));
const {chromium,webkit}=require(path.join(process.env.APPDATA,"npm/node_modules/playwright"));
let passed=0;
for(const [engine,type] of [["Chromium",chromium],["WebKit",webkit]]){
  const browser=await type.launch({headless:true});
  try { for(const repo of ["landing-autologuin","ases-gateway","ganamos-gateway","multi-skin-gateway"]){
    const root=new URL(`../../${repo}/public/`,import.meta.url);
    const client=await readFile(new URL("gateway-client.js",root),"utf8"),sdk=await readFile(new URL("gateway-app-sdk.js",root),"utf8"),css=await readFile(new URL("gateway-client.css",root),"utf8");
    const context=await browser.newContext({viewport:{width:390,height:844},userAgent:"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile Safari/604.1"});
    const page=await context.newPage(),errors=[];page.on("pageerror",error=>errors.push(error.message));
    try {
      await page.addInitScript(()=>{
        localStorage.setItem("gateway:push-notice:dismissed","1");
        window.permissionCalls=0;
        const match=window.matchMedia.bind(window);
        window.matchMedia=query=>query.includes("display-mode")?{matches:true,addEventListener(){},removeEventListener(){}}:match(query);
        Object.defineProperty(window,"Notification",{configurable:true,value:{get permission(){return localStorage.getItem("fixture:permission")||"default";},requestPermission(){window.permissionCalls++;localStorage.setItem("fixture:permission","granted");return Promise.resolve("granted");}}});
        Object.defineProperty(window,"PushManager",{configurable:true,value:class{}});
        const subscription={toJSON:()=>({endpoint:"https://push.fixture.invalid/device",keys:{p256dh:"synthetic",auth:"synthetic"}})};
        const worker={pushManager:{getSubscription:async()=>localStorage.getItem("fixture:subscription")?subscription:null,subscribe:async()=>{localStorage.setItem("fixture:subscription","1");return subscription;}}};
        Object.defineProperty(navigator,"serviceWorker",{configurable:true,value:{register:async()=>worker,ready:Promise.resolve(worker)}});
      });
      await context.route("**/*",async route=>{
        const url=new URL(route.request().url());if(url.origin!=="https://notifications.fixture.test")return route.abort();
        if(url.pathname==="/gateway-client.js")return route.fulfill({contentType:"text/javascript; charset=utf-8",body:client});
        if(url.pathname==="/gateway-app-sdk.js")return route.fulfill({contentType:"text/javascript; charset=utf-8",body:sdk});
        if(url.pathname==="/api/push-subscriptions"){
          if(await page.evaluate(()=>localStorage.getItem("fixture:reject")==="1"))return route.fulfill({status:503,json:{error:"synthetic"}});
          await page.evaluate(()=>localStorage.setItem("fixture:saved","1"));return route.fulfill({json:{ok:true}});
        }
        if(url.pathname==="/home")return route.fulfill({contentType:"text/html; charset=utf-8",body:`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><main>Fixture home</main><script src="/gateway-client.js" data-vapid-key="AQID"></script></body></html>`});
        return route.fulfill({json:{ok:true,active:false}});
      });
      await page.goto("https://notifications.fixture.test/home");
      await page.getByRole("dialog").waitFor();assert.equal(await page.evaluate(()=>window.permissionCalls),0);
      await page.getByRole("button",{name:"Ahora no",exact:true}).click();
      await page.reload();await page.getByRole("dialog").waitFor();
      assert.equal(await page.evaluate(()=>window.permissionCalls),0,"A saved dismissal does not prevent the next app opening");
      await page.evaluate(()=>localStorage.setItem("fixture:reject","1"));
      await page.getByRole("button",{name:/Activar notificaciones/}).click();
      await page.getByRole("button",{name:"Reintentar",exact:true}).waitFor();
      assert.equal(await page.evaluate(()=>localStorage.getItem("fixture:saved")),null,"Permission and a local subscription alone are insufficient");
      await page.evaluate(()=>localStorage.removeItem("fixture:reject"));
      await page.getByRole("button",{name:"Reintentar",exact:true}).click();
      await page.getByRole("dialog").waitFor({state:"detached"});assert.equal(await page.evaluate(()=>window.permissionCalls),1);
      await page.reload();await page.waitForFunction(()=>Boolean(window.GatewayApp));await page.waitForTimeout(1800);
      assert.equal(await page.getByRole("dialog").count(),0,"Confirmed active notifications stop automatic prompts");
      assert.equal(await page.evaluate(()=>window.permissionCalls),0);assert.deepEqual(errors,[]);
      console.log(`PASS ${engine} ${repo}: per-opening prompt, explicit consent, failed save and confirmed subscription`);passed++;
    } finally {await context.close();}
  }} finally {await browser.close();}
}
console.log(JSON.stringify({passed,realSubscriptions:0}));
