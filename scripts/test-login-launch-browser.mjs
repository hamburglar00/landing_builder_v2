import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const root = process.cwd(), frontend = path.join(root, "frontend");
const require = createRequire(path.join(frontend, "package.json"));
const { build } = require("esbuild"), { chromium, webkit } = require("playwright");
const postcss = require("postcss"), tailwind = require("@tailwindcss/postcss");
const artifacts = path.resolve(process.env.LOGIN_TEST_ARTIFACT_DIR || ".vercel/login-launch-20261110");
fs.mkdirSync(artifacts, { recursive: true });

// Exercise the real login, persistent provider and arrival hook without real credentials or services.
const entry = `import React,{useSyncExternalStore} from 'react';import {createRoot} from 'react-dom/client';
import LoginPage from './app/(panel)/login/page';
import {LoginTransitionProvider,useLoginArrival} from './components/brand/LoginTransitionProvider';
const subscribe=fn=>{window.addEventListener('fixture',fn);return()=>window.removeEventListener('fixture',fn)};
function Destination(){const ready=useSyncExternalStore(subscribe,()=>window.fixture.ready);useLoginArrival(ready);return ready?<h1>INICIO</h1>:<p>Destino pendiente</p>}
function App(){const pathname=useSyncExternalStore(subscribe,()=>window.fixture.path);return <LoginTransitionProvider>{pathname==='/login'?<LoginPage/>:<Destination/>}</LoginTransitionProvider>}
window.fixture={path:'/login',ready:false,authCalls:0,profileCalls:0,releaseAuth:null,releaseProfile:null};
window.fixture.emit=()=>window.dispatchEvent(new Event('fixture'));
createRoot(document.getElementById('root')).render(<App/>);`;
const navigation = `import {useSyncExternalStore} from 'react';
const subscribe=fn=>{window.addEventListener('fixture',fn);return()=>window.removeEventListener('fixture',fn)};
export function usePathname(){return useSyncExternalStore(subscribe,()=>window.fixture.path)}
const router={push:path=>{window.fixture.path=path;window.fixture.emit()}};export const useRouter=()=>router;`;
const services = `export const supabase={auth:{signInWithPassword:async()=>{window.fixture.authCalls++;const result=await new Promise(resolve=>window.fixture.releaseAuth=resolve);if(result==='throw')throw Error('Sin conexión');return result==='invalid'?{error:new Error('Credenciales inválidas'),data:{}}:{data:{user:{id:'synthetic'}},error:null}}},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>{window.fixture.profileCalls++;const role=await new Promise(resolve=>window.fixture.releaseProfile=resolve);return {data:{role}}}})})})};`;
const bundle = await build({ absWorkingDir: frontend, stdin: { contents: entry, resolveDir: frontend, loader: "tsx" }, bundle: true, write: false, outdir: path.join(artifacts, "bundle"), platform: "browser", format: "iife", jsx: "automatic", define: { "process.env.NEXT_PUBLIC_PBADMIN_EXTENSIONS_ENABLED": '"true"', "process.env.NODE_ENV": '"production"' }, plugins: [{ name: "synthetic-services", setup(b) {
  b.onResolve({ filter: /^next\/navigation$|^next\/image$|supabaseClient$/ }, a => ({ path: a.path, namespace: "fixture" }));
  b.onLoad({ filter: /.*/, namespace: "fixture" }, a => ({ loader: "jsx", resolveDir: frontend, contents: a.path === "next/navigation" ? navigation : a.path === "next/image" ? "import React from 'react';export default function Image({unoptimized,...props}){return <img {...props}/>;}" : services }));
} }] });
const globalCss = fs.readFileSync(path.join(frontend, "app/globals.css"), "utf8").replace('@import "tailwindcss";', '@import "tailwindcss" source(none); @source "./app/(panel)/login/page.tsx"; @source "./components/brand/LandingBuilderLogo.tsx"; @source "./components/brand/LandingBuilderLoading.tsx";');
const css = (await postcss([tailwind()]).process(globalCss, { from: path.join(frontend, "login-test.css") })).css + bundle.outputFiles.filter(f => f.path.endsWith(".css")).map(f => f.text).join("\n");
const js = bundle.outputFiles.find(f => f.path.endsWith(".js")).text;
const observations = [];

for (const [name, engine] of [["chromium", chromium], ["webkit", webkit]]) {
  const browser = await engine.launch();
  try {
    for (const viewport of [{ width: 320, height: 820 }, { width: 390, height: 820 }, { width: 1280, height: 820 }, { width: 844, height: 390 }]) for (const reducedMotion of ["no-preference", "reduce"]) {
      const { width, height } = viewport;
      const page = await browser.newPage({ viewport, reducedMotion });
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("**/*", route => {
        const url = new URL(route.request().url());
        if (url.pathname.startsWith("/brand/landingbuilder/")) return route.fulfill({ contentType: "image/svg+xml", body: fs.readFileSync(path.join(frontend, "public", url.pathname)) });
        return route.abort();
      });
      try {
        await page.setContent(`<!doctype html><html><head><base href="https://fixture.invalid"><style>${css}</style></head><body><div id="root"></div></body></html>`);
        await page.addScriptTag({ content: js });
        const submit = page.getByRole("button", { name: "ENTRAR AL PANEL", exact: true });
        await submit.waitFor();
        assert.equal(await page.getByRole("link", { name: "INGRESAR CON PBADMIN", exact: true }).count(), 1);
        assert.equal(await submit.evaluate(e => getComputedStyle(e).textTransform), "uppercase");
        await page.getByLabel("Email", { exact: true }).fill("synthetic@example.invalid");
        await page.getByLabel("Contraseña", { exact: true }).fill("synthetic-test-password");
        await page.getByLabel("Contraseña", { exact: true }).press("Enter");
        const overlay = page.getByRole("status", { name: "Iniciando sesión en LandingBuilder", exact: true });
        await overlay.waitFor();
        await page.evaluate(() => { document.querySelector('form').requestSubmit(); document.querySelector('form').requestSubmit(); });
        assert.equal(await page.evaluate(() => window.fixture.authCalls), 1, "repeated submissions cannot start concurrent authentication");
        const geometry = await overlay.evaluate(e => ({ width: e.getBoundingClientRect().width, height: e.getBoundingClientRect().height, pageWidth: document.documentElement.scrollWidth, focus: document.activeElement === e, locked: document.querySelector('#root [inert]') !== null }));
        assert.equal(geometry.width, width); assert.equal(geometry.height, height); assert.ok(geometry.pageWidth <= width); assert.ok(geometry.focus); assert.ok(geometry.locked);
        if (reducedMotion === "reduce") {
          assert.equal(await page.locator('[class*="movingRocket"]').evaluate(e => getComputedStyle(e).display), "none");
          assert.notEqual(await page.locator('[class*="stillRocket"]').evaluate(e => getComputedStyle(e).display), "none");
        } else {
          const positions = await page.evaluate(() => { const svg = document.querySelector('svg[class*="orbit"]'); svg.pauseAnimations(); return [.4, 1.4, 2.5].map(t => { svg.setCurrentTime(t); const r = svg.querySelector('[class*="movingRocket"] image').getBoundingClientRect(); return { x: r.x, y: r.y }; }); });
          assert.ok(positions[0].y > positions[1].y && positions[1].y > positions[2].y, "flight rises along its curved path");
          assert.ok(Math.max(...positions.map(p => p.x)) - Math.min(...positions.map(p => p.x)) > 15, "flight moves sideways along the ascending spiral");
          await page.evaluate(() => { const svg = document.querySelector('svg[class*="orbit"]'); svg.setCurrentTime(1.15); for (const animation of document.getAnimations()) { animation.pause(); animation.currentTime = 1150; } });
          if (width === 390) await page.screenshot({ path: path.join(artifacts, `${name}-launch-390.png`) });
          await page.evaluate(() => { document.querySelector('svg[class*="orbit"]').unpauseAnimations(); for (const animation of document.getAnimations()) animation.play(); });
        }
        await page.evaluate(result => window.fixture.releaseAuth(result), width === 320 ? "throw" : "invalid");
        await overlay.waitFor({ state: "hidden" });
        await page.getByRole("alert").filter({ hasText: width === 320 ? "Sin conexión" : "Credenciales inválidas" }).waitFor();
        assert.equal(await submit.isEnabled(), true); assert.equal(await page.locator("[inert]").count(), 0);
        await submit.click(); await overlay.waitFor();
        await page.waitForFunction(() => window.fixture.authCalls === 2);
        await page.evaluate(() => window.fixture.releaseAuth("ok"));
        await page.waitForFunction(() => window.fixture.profileCalls === 1);
        assert.equal(await overlay.isVisible(), true, "overlay stays while the role is loading");
        const role = width === 390 ? "client" : "admin";
        await page.evaluate(role => window.fixture.releaseProfile(role), role);
        await page.waitForFunction(role => window.fixture.path === (role === "admin" ? "/admin" : "/dashboard"), role);
        assert.equal(await overlay.isVisible(), true, "the same overlay survives unmounting login and mounting the destination");
        assert.equal(await page.getByRole("heading", { name: "INICIO", exact: true }).count(), 0);
        if (width === 390 && reducedMotion === "no-preference") {
          await page.evaluate(() => { window.fixture.path = "/login"; window.fixture.emit(); });
          await overlay.waitFor({ state: "hidden" });
          await page.getByLabel("Email", { exact: true }).fill("synthetic@example.invalid");
          await page.getByLabel("Contraseña", { exact: true }).fill("synthetic-test-password");
          await submit.click(); await overlay.waitFor();
          await page.waitForFunction(() => window.fixture.authCalls === 3);
          await page.evaluate(() => window.fixture.releaseAuth("ok"));
          await page.waitForFunction(() => window.fixture.profileCalls === 2);
          await page.evaluate(role => window.fixture.releaseProfile(role), role);
          await page.waitForFunction(role => window.fixture.path === (role === "admin" ? "/admin" : "/dashboard"), role);
          assert.equal(await overlay.isVisible(), true, "returning to login clears the old transition and permits another attempt");
        }
        await page.evaluate(() => { window.fixture.ready = true; window.fixture.emit(); });
        await overlay.waitFor({ state: "hidden" });
        await page.getByRole("heading", { name: "INICIO", exact: true }).waitFor();
        assert.equal(await page.locator("[inert]").count(), 0);
        assert.equal(await page.evaluate(() => document.body.style.overflow), "");
        assert.deepEqual(errors, []);
        observations.push({ browser: name, width, height, reducedMotion, role, status: "passed", geometry });
      } finally { await page.close(); }
    }
  } finally { await browser.close(); }
}
fs.writeFileSync(path.join(artifacts, "browser-results.json"), JSON.stringify(observations, null, 2));
console.log(JSON.stringify({ scenarios: observations.length, status: "passed", scope: "real components, synthetic auth/router, external network blocked" }));
