import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium } from "playwright";

test("the conversion table renders immediately and scopes late gateway evidence to its active read", async t => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const { outputFiles } = await build({
    absWorkingDir: root, write: false, bundle: true, tsconfig: "tsconfig.json", define: { "process.env.NODE_ENV": '"production"' },
    plugins: [{ name: "local-session", setup(plugin) {
      plugin.onResolve({ filter: /supabaseClient$/ }, () => ({ path: "session", namespace: "fixture" }));
      plugin.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: "export const supabase={auth:window.auth};" }));
    } }],
    stdin: { resolveDir: root, contents: `
      import React from "react";
      import { createRoot } from "react-dom/client";
      import { useGatewayEntryRows } from "./lib/atrio/useGatewayEntryRows";
      function Screen({model}) {
        const {rows,pending}=useGatewayEntryRows(model.rows,model.read,model.viewer,model.range,"ARS",model.visible);
        return React.createElement("output", {"data-pending":String(pending)},
          rows.map(row=>row.id+":"+(row.gateway_entry_event_id || "base")+":"+row.email).join(","));
      }
      const app=createRoot(document.body.appendChild(document.createElement("main")));
      window.display=()=>app.render(React.createElement(Screen,{model:{...window.model}}));
      window.load=(id, day=1)=>{
        const range={start:new Date(2026,10,day),end:new Date(2026,10,day,23)};
        const rows=[{id, currency:"ARS", email:"original", landing_id:"landing", atrio_id:"advisor", promo_code:id,
          contact_event_id:id, contact_payload_raw:JSON.stringify({source_platform:"landing",cta_destination:"atrio"})}];
        window.model={rows, range, viewer:window.viewer, visible:true, read:{rows, range, viewerId:window.viewer}};
        window.display();
      };
    ` },
  });
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto("about:blank");
  await page.evaluate(() => {
    window.viewer = "first";
    window.requests = [];
    const session = () => ({ access_token: "fixture", user: { id: window.viewer } });
    window.auth = {
      getSession: async () => ({ data: { session: session() } }),
      onAuthStateChange(fn) {
        window.authChanged = () => fn("SIGNED_IN", session());
        fn("INITIAL_SESSION", session());
        return { data: { subscription: { unsubscribe() {} } } };
      },
    };
    // Deliberately resolve aborted requests, as when a response was queued before cancellation.
    window.fetch = (_url, options) => new Promise(resolve => {
      const ids = JSON.parse(options.body);
      window.requests.push({
        ids, signal: options.signal, finish: label => resolve(Response.json({
          measured: ids, entries: ids.map(id => ({ conversion_id:id, message_id:label, event_time:123 })),
        })),
      });
    });
  });
  await page.addScriptTag({ content: outputFiles[0].text });
  await page.evaluate(() => window.load("old"));
  await page.waitForFunction(() => window.requests.length === 1);
  assert.equal(await page.locator("output").innerText(), "old:base:original");
  await page.evaluate(() => window.load("current", 2));
  await page.waitForFunction(() => window.requests.length === 2 && window.requests[0].signal.aborted);
  await page.evaluate(() => { window.requests[0].finish("stale"); window.requests[1].finish("confirmed"); });
  await page.waitForFunction(() => document.querySelector("output").textContent === "current:confirmed:original");
  await page.evaluate(() => {
    window.model.rows=window.model.rows.map(row => ({...row,email:"edited"}));
    window.model.visible=false; window.display();
  });
  await page.waitForFunction(() => document.querySelector("output").textContent.endsWith(":edited"));
  await page.evaluate(() => { window.model.visible=true; window.display(); });
  assert.equal(await page.locator("output").innerText(), "current:confirmed:edited");
  assert.equal(await page.evaluate(() => window.requests.length), 2);

  await page.evaluate(() => window.load("current", 2)); // explicit refresh with the same IDs
  await page.waitForFunction(() => window.requests.length === 3);
  await page.evaluate(() => { window.viewer="second"; window.authChanged(); });
  await page.waitForFunction(() => window.requests[2].signal.aborted);
  await page.evaluate(() => { window.requests[2].finish("other-session"); window.load("second-user", 2); });
  await page.waitForFunction(() => window.requests.length === 4);
  assert.equal(await page.locator("output").innerText(), "second-user:base:original");
  await page.evaluate(() => window.requests[3].finish("own"));
  await page.waitForFunction(() => document.querySelector("output").textContent === "second-user:own:original");
});
