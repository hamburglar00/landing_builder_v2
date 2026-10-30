// Real Atrio bubbles inside the gateway iframe; all network traffic is local fixtures.
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const workspace = fileURLToPath(new URL("../../", import.meta.url));
const atrio = path.join(workspace, "internal-chat");
const requireBuilder = createRequire(new URL("../frontend/package.json", import.meta.url));
const requireAtrio = createRequire(path.join(atrio, "package.json"));
const { build } = requireBuilder("esbuild");
const { chromium, webkit } = requireBuilder(path.join(process.env.APPDATA, "npm/node_modules/playwright"));
const cssPath = path.join(atrio, "src/app/globals.css");
const chatCss = (await requireAtrio("postcss")([requireAtrio("@tailwindcss/postcss")({ base: atrio })])
  .process(await readFile(cssPath, "utf8"), { from: cssPath })).css;
const bundle = await build({ absWorkingDir: atrio, stdin: { resolveDir: atrio, loader: "tsx", contents: `
  import React from 'react'; import {createRoot} from 'react-dom/client';
  import {ChatTextMessageBubble} from './src/components/chat-text-message-bubble';
  function App(){return <main>{Array.from({length:100},(_,i)=><div data-chat-message-row key={i} style={{display:'flex',margin:'6px 12px',justifyContent:i%2?'flex-end':'flex-start'}}><ChatTextMessageBubble text={i%3?'*Mensaje* de prueba '+i:'*Credenciales:*\\nUsuario: prueba'+i+'\\nClave: fixture'} meta={<small>17:30</small>} bubbleClassName="bg-white text-black max-w-[88%] px-4 py-2.5 rounded-[18px] text-[13.5px] leading-5"/></div>)}</main>};
  createRoot(document.getElementById('root')).render(<App/>);
` }, bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' } });
const results = [];
for (const [engine, browserType] of [["Chromium", chromium], ["WebKit", webkit]]) {
  const browser = await browserType.launch({ headless: true });
  try {
    for (const repo of ["landing-autologuin", "ases-gateway", "ganamos-gateway", "multi-skin-gateway"]) {
      const [css, js] = await Promise.all(["gateway-client.css", "gateway-client.js"].map(file => readFile(path.join(workspace, repo, "public", file), "utf8")));
      for (const touch of [false, true]) {
        // Landscape touch deliberately exceeds 640px: the desktop fix must not change it.
        const page = await browser.newPage({ viewport: touch ? {width:844,height:390} : {width:1920,height:1080}, hasTouch: touch });
        let frameNavigations = 0;
        const errors = [];
        page.on("pageerror", error => errors.push(error.message));
        await page.route("https://fixture.test/**", route => {
          const url = new URL(route.request().url());
          if (url.pathname === "/gateway-client.js") return route.fulfill({contentType:"application/javascript",body:js});
          if (url.pathname.startsWith("/api/")) return route.fulfill({json:{ok:true}});
          return route.fulfill({contentType:"text/html",body:`<!doctype html><html><head><style>${css}</style></head><body><button id="provider" style="position:fixed;inset:0;background:#11001f" onclick="window.providerClicks=(window.providerClicks||0)+1">Casino</button><script src="/gateway-client.js" data-chat-url="https://chat.test/embed"></script></body></html>`});
        });
        await page.route("https://chat.test/**", route => {
          frameNavigations++;
          return route.fulfill({contentType:"text/html",body:`<!doctype html><html><head><style>${chatCss}</style></head><body style="margin:0;background:#efe7e1"><div id="root"></div><script>${bundle.outputFiles[0].text}</script><script>window.fixtureInstance=Math.random();window.sizeEvents=[];window.addEventListener('resize',()=>sizeEvents.push({width:innerWidth,height:innerHeight}));parent.postMessage({source:'atrio-widget',type:'atrio.widget.ready'},'https://fixture.test');</script></body></html>`});
        });
        await page.goto("https://fixture.test/");
        const shell = page.locator("#gateway-chat-shell");
        await shell.waitFor({state:"attached"});
        await page.evaluate(()=>{document.documentElement.dataset.gatewayPresentationReady="true";document.querySelector("#gateway-chat-button").click();});
        await page.waitForFunction(()=>document.querySelector("#gateway-chat-shell").dataset.motion==="open");
        const frame = page.frameLocator("#gateway-chat-shell iframe");
        await frame.locator("strong").first().waitFor();
        await page.waitForTimeout(100);
        const original = await frame.locator("body").evaluate(()=>({width:innerWidth,height:innerHeight,instance:window.fixtureInstance}));
        await frame.locator("body").evaluate(()=>{window.sizeEvents=[];});
        for (let cycle=0; cycle<2; cycle++) {
          await page.evaluate(()=>document.querySelector("#gateway-chat-backdrop").click());
          await page.waitForFunction(()=>document.querySelector("#gateway-chat-shell").dataset.motion==="closed");
          const closed=await shell.evaluate(element=>({width:element.offsetWidth,visibility:getComputedStyle(element).visibility,inert:element.inert,filter:getComputedStyle(document.querySelector("#gateway-chat-backdrop")).backdropFilter}));
          assert.equal(closed.visibility,"hidden"); assert.equal(closed.inert,true);
          if (touch) { assert.equal(closed.width,0); assert.ok(closed.filter.includes("blur(4px)")); }
          else { assert.ok(closed.width>0); assert.equal(closed.filter,"none"); }
          // Click the actual region occupied by the hidden desktop chat.
          const clicksBefore=await page.evaluate(()=>window.providerClicks||0);
          await page.mouse.click(touch?400:1800,touch?100:600);
          assert.equal(await page.evaluate(()=>window.providerClicks),clicksBefore+1);
          await page.evaluate(()=>document.querySelector("#gateway-chat-button").click());
          await page.waitForFunction(()=>document.querySelector("#gateway-chat-shell").dataset.motion==="open");
          await page.waitForTimeout(100);
          const current = await frame.locator("body").evaluate(()=>({width:innerWidth,height:innerHeight,instance:window.fixtureInstance,resizes:window.sizeEvents}));
          assert.equal(current.instance,original.instance);
          assert.equal(current.width,original.width); assert.equal(current.height,original.height);
          if (!touch) assert.deepEqual(current.resizes,[],"Desktop opening/closing must never resize all real Atrio bubbles");
        }
        assert.equal(frameNavigations,1); assert.deepEqual(errors,[]);
        results.push({engine,repo,touch,messages:100,cycles:2,stableDesktopViewport:!touch,touchLayoutPreserved:touch,hiddenChatPassesClicks:true,iframeReused:true});
        await page.close();
      }
    }
  } finally { await browser.close(); }
  console.log(JSON.stringify({engine,passed:results.filter(result=>result.engine===engine).length}));
}
const folder=new URL("../.vercel/validation-desktop-chat-layout/",import.meta.url);
await mkdir(folder,{recursive:true});
await writeFile(new URL("report.json",folder),JSON.stringify({results,fixtureOnly:true,productionWrites:0},null,2));
console.log(JSON.stringify({passed:results.length,gateways:4,engines:2}));
