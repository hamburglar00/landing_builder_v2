import assert from "node:assert/strict";
import test from "node:test";
import { Script } from "node:vm";
import { readFile } from "node:fs/promises";
import { buildTemplate7ResourceWarmup } from "../components/public-landing/template7ResourceWarmup";

test("resource warmup waits for form intent and mounts static chat assets once", () => {
  const script = buildTemplate7ResourceWarmup("https://casino.test", "https://chat.test").match(/<script[^>]*>([\s\S]*)<\/script>/)![1];
  const listeners:Record<string,(event:unknown)=>void>={}, requests: string[] = [], elements: Record<string, unknown>[] = [];
  const context = {
    window: {}, URL,
    fetch: (url: string) => { requests.push(url); return Promise.resolve(); },
    document: { head: { appendChild(el: Record<string, unknown>) { elements.push(el); } }, body: { appendChild(el: Record<string, unknown>) { elements.push(el); } },
      createElement(tag: string) { return { tag, style: {}, setAttribute() {} }; },
      addEventListener(name:string,listener:(event:unknown)=>void){listeners[name]=listener;} },
  };
  new Script(script).runInNewContext(context);assert.equal(requests.length, 0);
  const event={target:{closest:()=>({})}};
  listeners.focusin(event);listeners.input(event);
  assert.deepEqual(requests, ["https://casino.test/api/preparations/warm"]);
  assert.equal(elements.filter(el => el.tag === "iframe").length, 1);
  assert.equal(elements.find(el => el.tag === "iframe")?.src, "https://chat.test/embed/warm");
  assert.ok(!requests.some(url => /players|start|resolve/.test(url)));
  assert.ok(!elements.some(el => String(el.href).includes("gateway-app-sdk")), "optional app SDK must not compete with entry assets");
});

test("session reentry suppresses static warmup and untrusted origins are ignored", () => {
  assert.equal(buildTemplate7ResourceWarmup("javascript:alert(1)", "https://user:password@chat.test"), "");
  const script = buildTemplate7ResourceWarmup("https://casino.test", "https://chat.test").match(/<script[^>]*>([\s\S]*)<\/script>/)![1];
  new Script(script).runInNewContext({ window: { __TEMPLATE7_REENTRY_PENDING__: true }, document: {addEventListener(_name:string,listener:(event:unknown)=>void){listener({target:{closest:()=>({})}})}}, fetch: () => { throw Error("must not warm during reentry"); } });
});

test("the real entry modules have no shared-account configuration, demo renderer or testing routes", async () => {
  const start = await readFile(new URL("../lib/reyDeAses/start.server.ts", import.meta.url), "utf8");
  const integration = await readFile(new URL("../lib/reyDeAses/integrations.server.ts", import.meta.url), "utf8");
  assert.doesNotMatch(start, /demoConfig|TEMPLATE7_DEMO_|readDemo|testingBypass/);
  assert.doesNotMatch(integration, /TESTING_API_KEY|\/api\/testing\/|TEMPLATE7_DEMO_/);
  assert.match(integration, /creation_mode: "create_only"/);
});
