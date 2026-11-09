// Actual callback clients/handler with synthetic broker/session responses only.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  front = path.join(root, "frontend"),
  require = createRequire(path.join(front, "package.json"));
const { build } = require("esbuild"),
  { chromium, webkit } = require("playwright");
const atrio = path.resolve(
  root,
  process.argv.find((a) => a.startsWith("--atrio-root="))?.slice(13) ||
    "../internal-chat",
);
const output = path.join(root, ".local/pbadmin-connection");
await mkdir(output, { recursive: true });
const protocol = path
  .join(atrio, "src/lib/pbadmin/protocol.server.ts")
  .replaceAll("\\", "/");
const mockPlugin = {
  name: "connection-fixtures",
  setup(b) {
    b.onResolve(
      {
        filter:
          /^(server-only|next\/headers|@\/lib\/(pbadmin\/(protocol|provider)\.server|supabase\/server|manager-sync))$/,
      },
      (a) => ({ path: a.path, namespace: "fixture" }),
    );
    b.onLoad({ filter: /.*/, namespace: "fixture" }, (a) => ({
      loader: "js",
      resolveDir: atrio,
      contents:
        a.path === "server-only"
          ? ""
          : a.path === "next/headers"
            ? "export const cookies=async()=>({get:()=>undefined,delete:()=>{}});"
            : a.path.includes("protocol.server")
              ? `import * as actual from ${JSON.stringify(protocol)};export * from ${JSON.stringify(protocol)};export async function redeem(provider,code,state){const f=globalThis.__connectionState;f.redeems++;if(f.mode==='expired'||code!=='a'.repeat(43)||state!=='b'.repeat(43))throw new actual.AccessError('Este acceso venció. Volvé a ingresar.',401);return {provider,ownerId:101,userId:11,role:0};}`
              : a.path.includes("provider.server")
                ? `export async function provision(){globalThis.__connectionState.provisions++;return {advisorId:'fixture-advisor',session:{access_token:'fixture-access',refresh_token:'fixture-refresh'}};}`
                : a.path.includes("supabase/server")
                  ? `export async function createServerSupabaseClient(){return {auth:{setSession:async()=>{const f=globalThis.__connectionState;f.saves++;return {error:f.mode==='session'?new Error('fixture session failure'):null};}}};}`
                  : `export async function synchronizeAdvisorManagers(){const f=globalThis.__connectionState;f.syncs++;if(f.mode==='sync-error')throw Error('fixture sync failure');}`,
    }));
  },
};
const routeFile = path.join(output, "atrio-route.mjs");
await build({
  absWorkingDir: atrio,
  entryPoints: [path.join(atrio, "src/app/pbadmin/callback/route.ts")],
  outfile: routeFile,
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  plugins: [mockPlugin],
});
const callback = await import(pathToFileURL(routeFile).href);
const configFile = path.join(output, "builder-config.mjs");
await build({
  entryPoints: [path.join(front, "next.config.ts")],
  outfile: configFile,
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
});
const config = (await import(pathToFileURL(configFile).href)).default;
const responseHeaders = (await config.headers()).find(
  (item) => item.source === "/pbadmin/callback",
).headers;
assert.equal(
  responseHeaders.find((h) => h.key === "Referrer-Policy")?.value,
  "no-referrer",
);
const client = await build({
  absWorkingDir: front,
  stdin: {
    contents: `import React from 'react';import {createRoot} from 'react-dom/client';import Callback from './app/pbadmin/callback/page';window.__fixtureMode=new URLSearchParams(location.search).get('fixture');createRoot(document.getElementById('root')).render(<React.StrictMode><Callback/></React.StrictMode>);`,
    resolveDir: front,
    loader: "tsx",
  },
  outfile: "client.js",
  write: false,
  bundle: true,
  platform: "browser",
  jsx: "automatic",
  plugins: [
    {
      name: "builder-client",
      setup(b) {
        b.onResolve(
          { filter: /^(next\/image|@\/lib\/supabaseClient)$/ },
          (a) => ({ path: a.path, namespace: "fixture" }),
        );
        b.onLoad({ filter: /.*/, namespace: "fixture" }, (a) => ({
          loader: "jsx",
          resolveDir: front,
          contents:
            a.path === "next/image"
              ? `import React from 'react';export default function Image({src,alt,width,height,className,loading}){return <img src={src} alt={alt} width={width} height={height} className={className} loading={loading}/>;}`
              : `export const supabase={auth:{setSession:async()=>{sessionStorage.setItem('fixture-set-session',String(Number(sessionStorage.getItem('fixture-set-session')||0)+1));return {error:window.__fixtureMode==='session'?new Error('fixture'):null,data:{user:{id:'fixture-user'}}};}}};`,
        }));
      },
    },
  ],
});
const js = client.outputFiles.find((f) => f.path.endsWith(".js")).text,
  css =
    "html,body{margin:0;font-family:system-ui}" +
    client.outputFiles.find((f) => f.path.endsWith(".css")).text;
let active,
  origins = {};
const servers = [],
  results = [];
for (const product of ["builder", "atrio"]) {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, origins[product]);
      if (url.pathname === "/dashboard") {
        res.setHeader("Content-Type", "text/html;charset=utf-8");
        return res.end("<h1>Panel abierto</h1>");
      }
      if (url.pathname === "/client.js") {
        res.setHeader("Content-Type", "text/javascript");
        return res.end(js);
      }
      if (url.pathname === "/style.css") {
        res.setHeader("Content-Type", "text/css");
        return res.end(css);
      }
      if (
        url.pathname === "/icons/icon.svg" ||
        url.pathname === "/brand/landingbuilder/landingbuilder-isotipo-dark.svg"
      ) {
        active.assetReferrers.push(req.headers.referer || "");
        res.setHeader("Content-Type", "image/svg+xml");
        return res.end(
          await readFile(
            path.join(
              product === "atrio" ? atrio : front,
              "public",
              url.pathname,
            ),
          ),
        );
      }
      if (req.method === "POST") {
        const f = active,
          chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const body = Buffer.concat(chunks).toString();
        f.requests.push(JSON.parse(body));
        f.arrived();
        await f.gate;
        if (product === "builder") {
          res.setHeader("Content-Type", "application/json");
          res.statusCode = f.mode === "expired" ? 401 : 200;
          return res.end(
            JSON.stringify(
              f.mode === "expired"
                ? { error: "Este acceso venció. Volvé a ingresar." }
                : {
                    access_token: "fixture-access",
                    refresh_token: "fixture-refresh",
                    syncPending: f.mode === "pending",
                  },
            ),
          );
        }
        globalThis.__connectionState = f;
        const headers = Object.fromEntries(
          Object.entries(req.headers).map(([key, value]) => [
            key,
            Array.isArray(value) ? value.join(",") : value,
          ]),
        );
        const response = await callback.POST(
          new Request(url, { method: "POST", headers, body }),
        );
        res.writeHead(response.status, Object.fromEntries(response.headers));
        return res.end(await response.text());
      }
      if (product === "atrio") {
        const response = callback.GET();
        res.writeHead(response.status, Object.fromEntries(response.headers));
        return res.end(await response.text());
      }
      res.setHeader("Content-Type", "text/html;charset=utf-8");
      for (const h of responseHeaders) res.setHeader(h.key, h.value);
      res.end(
        '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/client.js"></script></body></html>',
      );
    } catch (error) {
      res.statusCode = 500;
      res.end(String(error));
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  origins[product] = `http://127.0.0.1:${server.address().port}`;
  servers.push(server);
}
Object.assign(process.env, {
  PBADMIN_EXTENSIONS_ENABLED: "true",
  PBADMIN_EXTENSIONS_SECRET: "fixture-connection-secret-01234567890123456789",
  PBADMIN_EXTENSIONS_API_ORIGIN: origins.atrio,
  PBADMIN_EXTENSIONS_PANEL_ORIGIN: origins.atrio,
  PBADMIN_EXTENSIONS_APP_ORIGIN: origins.atrio,
});
function state(mode) {
  let release, arrived;
  return {
    mode,
    requests: [],
    assetReferrers: [],
    redeems: 0,
    provisions: 0,
    saves: 0,
    syncs: 0,
    gate: new Promise((r) => (release = r)),
    arrival: new Promise((r) => (arrived = r)),
    release: () => release(),
    arrived: () => arrived(),
  };
}
try {
  // The server keeps Origin enforcement and never sends session tokens to the client.
  active = state("success");
  active.release();
  globalThis.__connectionState = active;
  const forbidden = await callback.POST(
    new Request(origins.atrio + "/pbadmin/callback", {
      method: "POST",
      headers: {
        Origin: "https://foreign.invalid",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code: "a".repeat(43), state: "b".repeat(43) }),
    }),
  );
  assert.equal(forbidden.status, 403);
  assert.equal(active.redeems, 0);
  active = state("sync-error");
  active.release();
  globalThis.__connectionState = active;
  const retry = await callback.POST(
    new Request(origins.atrio + "/pbadmin/callback", {
      method: "POST",
      headers: { Origin: origins.atrio, "Content-Type": "application/json" },
      body: JSON.stringify({ code: "a".repeat(43), state: "b".repeat(43) }),
    }),
  );
  assert.equal(retry.status, 200);
  const resumed = await retry.json();
  assert.equal(resumed.next, origins.atrio + "/dashboard");
  assert.equal(Object.hasOwn(resumed, "access_token"), false);
  assert.equal(active.saves, 1);
  assert.equal(active.syncs, 1);
  for (const [engine, launcher] of process.argv.includes("--smoke")
    ? [["chromium", chromium]]
    : [
        ["chromium", chromium],
        ["webkit", webkit],
      ]) {
    const browser = await launcher.launch();
    try {
      for (const product of ["builder", "atrio"])
          for (const width of [320, 1365])
          for (const motion of ["no-preference", "reduce"])
            for (const mode of ["success", "expired", "network", "session"]) {
              const context = await browser.newContext({
                  viewport: { width, height: width === 320 ? 568 : 768 },
                  reducedMotion: motion,
                  serviceWorkers: "block",
                }),
                page = await context.newPage(),
                errors = [];
              active = state(mode);
              const f = active;
              page.setDefaultTimeout(10000);
              page.on("pageerror", (e) => errors.push(e.message));
              await context.route("**/*", async (route) => {
                if (new URL(route.request().url()).origin !== origins[product])
                  return route.abort();
                if (mode === "network" && route.request().method() === "POST") {
                  f.requests.push(route.request().postDataJSON());
                  f.arrived();
                  await f.gate;
                  return route.abort("failed");
                }
                return route.continue();
              });
              try {
                await page.goto(
                  origins[product] +
                    "/pbadmin/callback?code=" +
                    "a".repeat(43) +
                    "&state=" +
                    "b".repeat(43) +
                    "&fixture=" +
                    mode,
                );
                await f.arrival;
                await page
                  .getByRole("heading", {
                    name: new RegExp(
                      "Conectando con " +
                        (product === "builder" ? "LandingBuilder" : "Atrio"),
                    ),
                  })
                  .waitFor();
                const logo = page.getByRole("img", {
                  name: product === "builder" ? "LandingBuilder" : "Atrio",
                  exact: true,
                });
                await logo.waitFor();
                await logo.evaluate((img) => img.decode());
                assert.equal(new URL(page.url()).search, "");
                assert.equal(f.requests.length, 1);
                assert.deepEqual(f.requests[0], {
                  code: "a".repeat(43),
                  state: "b".repeat(43),
                });
                assert.ok(f.assetReferrers.every((ref) => !ref));
                const animated = page.locator(
                  product === "builder"
                    ? ".pbadmin-connection-logo"
                    : ".connection-logo",
                );
                assert.equal(
                  (await animated.evaluate(
                    (n) => n.getAnimations({ subtree: true }).length,
                  )) > 0,
                  motion === "no-preference",
                );
                assert.equal(
                  await page.evaluate(
                    () =>
                      document.documentElement.scrollWidth > innerWidth + 1 ||
                      document.documentElement.scrollHeight > innerHeight + 1,
                  ),
                  false,
                );
                if (mode === "success" && motion === "no-preference")
                  await page.screenshot({
                    path: path.join(
                      output,
                      `${product}-${engine}-${width}.png`,
                    ),
                  });
                f.release();
                if (mode === "success") {
                  await page.waitForURL(origins[product] + "/dashboard");
                  await page
                    .getByRole("heading", { name: "Panel abierto" })
                    .waitFor();
                  if (product === "builder") {
                    assert.equal(
                      await page.evaluate(() =>
                        sessionStorage.getItem("pbadmin_access"),
                      ),
                      "fixture-user",
                    );
                    assert.equal(
                      await page.evaluate(() =>
                        sessionStorage.getItem("fixture-set-session"),
                      ),
                      "1",
                    );
                  } else {
                    assert.equal(f.redeems, 1);
                    assert.equal(f.saves, 1);
                    assert.equal(f.syncs, 1);
                  }
                } else {
                  await page.getByRole("alert").waitFor();
                  assert.equal(
                    new URL(page.url()).pathname,
                    "/pbadmin/callback",
                  );
                  const action = page.getByRole("link", {
                    name: /Volver a (intentar|ingresar con PBAdmin)/,
                  });
                  assert.equal(
                    await action.getAttribute("href"),
                    "/api/pbadmin/start",
                  );
                  assert.ok(
                    Number(
                      await action.evaluate(
                        (n) => getComputedStyle(n).fontWeight,
                      ),
                    ) >= 700,
                  );
                  assert.equal(
                    await animated.evaluate(
                      (n) => n.getAnimations({ subtree: true }).length,
                    ),
                    0,
                  );
                  if (mode === "expired" && motion === "no-preference")
                    await page.screenshot({
                      path: path.join(
                        output,
                        `${product}-error-${engine}-${width}.png`,
                      ),
                    });
                }
                assert.deepEqual(errors, []);
                results.push({ engine, product, width, motion, mode });
                console.log(
                  `PASS connection ${engine} ${product} ${width} ${motion} ${mode}`,
                );
              } finally {
                f.release();
                await context.close();
              }
            }
    } finally {
      await browser.close();
    }
  }
} finally {
  for (const server of servers) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  await writeFile(
    path.join(output, "results.json"),
    JSON.stringify({ results }, null, 2),
  );
}
