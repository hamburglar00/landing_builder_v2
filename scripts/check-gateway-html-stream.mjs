// Real proxy/session/rewriter/client with synthetic upstream and widget; no external business requests.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(new URL("../frontend/package.json", import.meta.url));
const { build } = require("esbuild");
const { chromium, webkit } = require(path.join(process.env.APPDATA, "npm/node_modules/playwright"));
const artifact = fileURLToPath(new URL("../.vercel/validation-gateway-html-stream/", import.meta.url));
await mkdir(artifact, { recursive: true });
const key = "ab".repeat(32), player = "11111111-1111-4111-8111-111111111111", account = "22222222-2222-4222-8222-222222222222";
Object.assign(process.env, { VERCEL_ENV: "development", SESSION_ENCRYPTION_KEY: key, INTERNAL_CHAT_GATEWAY_SECRET: "fixture-secret-".repeat(4), UPSTREAM_RELAY_ORIGIN: "https://relay.example", UPSTREAM_RELAY_API_KEY: "fixture-relay-".repeat(4) });
const cases = [
  ["landing-autologuin", "proxyToRey", "rewriteReyHtml", "rey_de_ases"],
  ["ases-gateway", "proxyToAses", "rewriteAsesHtml", "ases_del_norte"],
  ["ganamos-gateway", "proxyToGanamos", "rewriteGanamosHtml", "ganamos_net"],
  ["multi-skin-gateway", "proxyToMultiSkin", "rewriteMultiSkinHtml", "multi_skin"],
];
const summaries = [];
for (const [repo, proxyName, rewriteName, provider] of cases) {
  const dir = path.join(root, repo), localRequire = createRequire(path.join(dir, "package.json"));
  const compiled = await build({ absWorkingDir: dir, tsconfig: path.join(dir, "tsconfig.json"),
    stdin: { resolveDir: dir, loader: "ts", contents: `export {${proxyName} as proxy} from './src/lib/proxy';export * from './src/lib/gateway-session';export {${rewriteName} as rewrite} from './src/lib/html-rewriter';export {getGatewayConfig} from './src/lib/config';${provider === "rey_de_ases" ? "" : "export * from './src/lib/skin-registry';"}` },
    bundle: true, write: false, platform: "node", format: "cjs", external: ["next/server", "zod", "postgres"],
    plugins: [{ name: "isolated-storage", setup(b) {
      b.onResolve({ filter: /^@\/lib\/database$/ }, () => ({ path: "database", namespace: "fixture" }));
      b.onResolve({ filter: /^@\/lib\/player-binding$/ }, () => ({ path: "binding", namespace: "fixture" }));
      b.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ contents: args.path === "database" ? 'export function getDatabase(){throw Error("Database blocked in fixture")}' : `export async function loadGatewayPlayerBinding(){return {id:'fixture-binding',advisorSlug:'fixture',externalUserId:'${player}',playerProviderAccountId:'${account}',targetProvider:'rey_de_ases'}};export async function loadGatewayPlayerLogin(){return null};export async function loadGatewayProviderCredentials(){return null};export async function decryptStoredGatewayPlayerLogin(){return null};` }));
    } }],
  });
  const module = { exports: {} }; new Function("require", "module", "exports", compiled.outputFiles[0].text)(localRequire, module, module.exports);
  const app = module.exports, { NextRequest } = localRequire("next/server");
  const identity = { advisorSlug: "fixture", playerId: player, playerProviderAccountId: account, targetProvider: provider };
  const session = provider === "rey_de_ases" ? app.createGatewaySession("session=upstream-test", Date.now(), undefined, "fixture-binding") : app.createGatewaySession({ username: "fixture-user", password: "fixture-secret", identity, ...(provider === "multi_skin" ? { skinCode: "ganamos_plus", accessToken: "fixture-upstream-token", user: { id: 1 } } : { upstreamCookies: "session=upstream-test" }) });
  const token = app.encryptGatewaySession(session, key), cookie = `${app.GATEWAY_SESSION_COOKIE}=${token}`;
  const head = '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><script>const host = location.hostname; window.providerExample="<body>";</script></head><body data-example=">">';
  const authentication = '<span id="Saldo" hidden>fixture-user</span>';
  const native = provider === "ases_del_norte" ? '<script>window.__lc={};window.__lc.license=1;var retired="cdn.livechatinc.com/tracking.js";</script>' : provider === "ganamos_net" ? '<script>var retired="https://embed.tawk.to/fixture";</script><link rel="manifest" href="/native.json">' : "";
  const tail = `<main id="provider-page">Casino 🎲</main><script>window.providerTail=true;</script>${native}</body></html>`;
  let upstream, calls = [], fullOutput = "", currentOrigin = "", headersEmitted = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), method: init?.method || "GET", headers: Object.fromEntries(new Headers(init?.headers)) });
    assert.equal(init?.method || "GET", "GET", "a slow document never logs in or creates an account");
    const stream = new ReadableStream({ start(controller) { upstream = controller; const bytes = new TextEncoder().encode(head + authentication); for (let i = 0; i < bytes.length; i += 7) controller.enqueue(bytes.slice(i, i + 7)); } });
    return new Response(stream, { headers: { "content-type": "text/html", ...(provider === "multi_skin" ? {} : { "set-cookie": "session=updated-upstream; Path=/" }) } });
  };
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, currentOrigin);
      if (url.pathname.startsWith("/embed")) {
        const payload = JSON.parse(Buffer.from(url.searchParams.get("token").split(".")[1], "base64url").toString());
        assert.equal(payload.playerId, player); assert.equal(payload.playerProviderAccountId, account); assert.equal(payload.advisorSlug, "fixture"); assert.equal(payload.parentOrigin, currentOrigin);
        response.setHeader("content-type", "text/html"); return response.end(`<!doctype html><html><body><p id="state">Hidden preload</p><input aria-label="Mensaje"><script>window.visibleEntries=0;addEventListener('message',event=>{if(event.source!==parent||event.origin!==location.origin||event.data.type!=='gateway.chat.visibility'||event.data.open!==true||window.visibleEntries)return;requestAnimationFrame(()=>requestAnimationFrame(()=>{window.visibleEntries++;document.getElementById('state').textContent='Chat listo';parent.postMessage({source:'atrio-widget',type:'atrio.widget.usable',visibleEntry:true},location.origin)}))});parent.postMessage({source:'atrio-widget',type:'atrio.widget.ready',visibleEntry:true},location.origin);</script></body></html>`);
      }
      if (url.pathname === "/gateway-client.js" || url.pathname === "/gateway-client.css") { response.setHeader("content-type", url.pathname.endsWith("js") ? "text/javascript" : "text/css"); return response.end(await readFile(path.join(dir, "public", url.pathname.slice(1)))); }
      if (url.pathname.startsWith("/api/")) { response.setHeader("content-type", "application/json"); return response.end(JSON.stringify({ active: true, ok: true })); }
      if (!url.pathname.startsWith("/fixture-document")) { response.statusCode = 204; return response.end(); }
      const result = await app.proxy(new NextRequest(url, { headers: { accept: "text/html", cookie: request.headers.cookie || "" } }));
      response.writeHead(result.status, Object.fromEntries(result.headers)); response.flushHeaders(); headersEmitted = true;
      const reader = result.body.getReader(); fullOutput = "";
      while (true) { const chunk = await reader.read(); if (chunk.done) break; fullOutput += new TextDecoder().decode(chunk.value); response.write(chunk.value); }
      response.end();
    } catch (error) { response.statusCode = 500; response.end(String(error)); }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve)); currentOrigin = `http://localhost:${server.address().port}`;
  process.env.INTERNAL_CHAT_EMBED_URL = currentOrigin + "/embed";
  try {
    for (const [engine, type] of [["Chromium", chromium], ["WebKit", webkit]]) {
      const browser = await type.launch({ headless: true });
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      await context.addCookies([{ name: app.GATEWAY_SESSION_COOKIE, value: token, url: currentOrigin }]);
      const page = await context.newPage(), errors = [], network = []; calls = []; upstream = undefined; headersEmitted = false;
      page.on("pageerror", error => errors.push(error.message));
      page.on("request", request => network.push(new URL(request.url()).pathname));
      await context.route("**/*", route => new URL(route.request().url()).origin === currentOrigin ? route.continue() : route.abort());
      try {
        const navigation = page.goto(currentOrigin + "/fixture-document?gateway_chat=open", { waitUntil: "commit" });
        const early = provider !== "ases_del_norte";
        if (!early) {
          while (!upstream) await new Promise(resolve => setTimeout(resolve, 20));
          await new Promise(resolve => setTimeout(resolve, 150));
          assert.equal(headersEmitted, false, "Ases must inspect the whole document before exposing any HTML or token");
          assert.equal(network.some(url => url.startsWith("/embed")), false);
          upstream.enqueue(new TextEncoder().encode(tail)); upstream.close();
        }
        await navigation;
        try { await page.frameLocator("#gateway-chat-shell iframe").getByText("Chat listo", { exact: true }).waitFor({ timeout: 10000 }); }
        catch (error) { await writeFile(path.join(artifact, `${repo}-failed.html`), await page.content()); console.log(JSON.stringify({ repo, engine, errors, network, calls: calls.map(call => ({ url: call.url, method: call.method })), body: await page.locator('body').innerText(), initialized: await page.evaluate(()=>window.__REY_GATEWAY_CLIENT__), frameCount: page.frames().length })); throw error; }
        if (early) {
          assert.equal(await page.evaluate(() => document.readyState), "loading");
          assert.equal(await page.evaluate(() => window.providerTail), undefined);
        }
        assert.equal(calls.length, 1);
        assert.equal(calls[0].url.includes("gateway_chat"), false);
        if (provider === "multi_skin") assert.ok(calls[0].headers["x-gateway-relay-authorization"]);
        else assert.equal(calls[0].headers.cookie, "session=upstream-test");
        assert.equal(await page.locator("#gateway-entry-transition").isHidden(), true);
        const iframe = page.locator("#gateway-chat-shell iframe"), chatUrl = await iframe.getAttribute("src");
        assert.ok(chatUrl);
        if (engine === "Chromium") await page.screenshot({ path: path.join(artifact, `${repo}-early-chat.png`) });
        if (early) { upstream.enqueue(new TextEncoder().encode(tail)); upstream.close(); }
        await page.waitForLoadState("load"); assert.equal(await page.evaluate(() => window.providerTail), true);
        assert.equal(await page.locator("#provider-page").textContent(), "Casino 🎲");
        const config = app.getGatewayConfig(); const options = { appId: config.gatewayAppId, displayName: config.gatewayDisplayName, chatEmbedUrl: chatUrl, vapidPublicKey: config.gatewayVapidPublicKey, initialChatOpen: true, streamingEntry: early };
        let expected;
        if (provider === "rey_de_ases") expected = app.rewrite(head + authentication + tail, { gatewayClient: options }).html;
        else if (provider === "multi_skin") { const skin = app.getSkinConfig("ganamos_plus"); expected = app.rewrite(head + authentication + tail, { ...options, displayName: skin.displayName, skin, accessToken: session.accessToken, user: session.user }); }
        else { const providerConfig = app.getProviderConfig(); expected = app.rewrite(head + authentication + tail, { ...options, displayName: providerConfig.displayName, provider: providerConfig }); }
        assert.equal(fullOutput, expected, "combined stream equals the complete provider rewrite");
        assert.deepEqual(errors, []);
        summaries.push({ repo, engine, chatVisibleBeforeCasinoEof: early, completeAuthenticationInspection: !early, exactRewrite: true, upstreamRequests: calls.length, externalBusinessRequests: 0 });
        console.log(`${repo} ${engine}: authenticated chat ${early ? 'visible while document loading' : 'after complete provider authentication inspection'}; full rewrite identical`);
      } finally { await context.close(); await browser.close(); }
    }
    if (provider === "ases_del_norte") {
      const requests = [];
      globalThis.fetch = async (input, init) => {
        requests.push({ url: String(input), method: init?.method || 'GET' });
        if (requests.length === 1) {
          const chunks = [head + authentication, '<form id="login">Expired session</form>', tail];
          return new Response(new ReadableStream({ pull(controller) { const chunk = chunks.shift(); if (chunk === undefined) return controller.close(); controller.enqueue(new TextEncoder().encode(chunk)); } }), { headers: { 'content-type': 'text/html' } });
        }
        if (requests.length === 2) {
          assert.equal(init.method, 'POST');
          assert.equal(init.body.get('username'), 'fixture-user');
          assert.equal(init.body.get('password'), 'fixture-secret');
          return new Response(head + authentication + tail, { headers: { 'content-type': 'text/html', 'set-cookie': 'PHPSESSID=renewed-fixture; Path=/' } });
        }
        assert.equal(requests.length, 3);
        assert.equal(new Headers(init.headers).get('cookie'), 'PHPSESSID=renewed-fixture');
        return new Response(head + authentication + tail, { headers: { 'content-type': 'text/html' } });
      };
      const renewed = await app.proxy(new NextRequest(currentOrigin + '/fixture-document?gateway_chat=open', { headers: { accept: 'text/html', cookie } }));
      assert.equal(renewed.status, 200);
      assert.equal((await renewed.text()).includes('Expired session'), false);
      assert.equal(requests.length, 3, 'a login form after Saldo still renews the exact existing account');
      const restored = app.decryptGatewaySession(renewed.cookies.get(app.GATEWAY_SESSION_COOKIE).value, key);
      assert.equal(restored.username, session.username);
      assert.deepEqual(restored.identity, session.identity);
      console.log('Ases late login form: exact account renewed before chat exposure');
    }
    if (provider === "rey_de_ases") {
      globalThis.fetch = async () => new Response('<html><head></head><body>Unexpected provider</body></html>', { headers: { 'content-type': 'text/html' } });
      const rejected = await app.proxy(new NextRequest(currentOrigin + '/fixture-document?gateway_chat=open', { headers: { accept: 'text/html', cookie } }));
      assert.equal(rejected.status, 502);
      assert.equal((await rejected.text()).includes('data-chat-url'), false);
      console.log('Rey missing brand proof: rejected before chat exposure');
    }
    // Invalid encrypted cookies fail before contacting the provider or exposing a chat token.
    calls = [];
    globalThis.fetch = async (input, init) => {
      calls.push({ url: String(input), method: init?.method || "GET" });
      throw new Error("An invalid gateway cookie must never contact the upstream");
    };
    const denied = await app.proxy(new NextRequest(currentOrigin + "/fixture-document", { headers: { accept: "text/html", cookie: `${app.GATEWAY_SESSION_COOKIE}=tampered` } }));
    assert.equal(denied.status, 401); assert.equal(calls.length, 0); assert.equal((await denied.text()).includes("data-chat-url"), false);
  } finally { globalThis.fetch = originalFetch; server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
await writeFile(path.join(artifact, "results.json"), JSON.stringify(summaries, null, 2));
console.log(`${summaries.length} real gateway browser scenarios passed; business requests: 0`);
