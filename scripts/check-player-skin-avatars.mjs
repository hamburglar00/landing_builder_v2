// The real Atrio avatar renderer with local images in both browser engines. No app/env boot.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createServer } from "node:http";

const workspace = fileURLToPath(new URL("../../", import.meta.url));
const atrio = path.join(workspace, "internal-chat");
const require = createRequire(new URL("../frontend/package.json", import.meta.url));
const appRequire = createRequire(path.join(atrio, "package.json"));
const { build } = require("esbuild");
const ts = appRequire("typescript");
const sharp = appRequire("sharp");
const { chromium, webkit } = require(path.join(process.env.APPDATA, "npm/node_modules/playwright"));
const source = await readFile(path.join(atrio, "src/components/advisor-inbox-shell.tsx"), "utf8");
const ast = ts.createSourceFile("inbox.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const avatar = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "PlayerAvatar");
assert.ok(avatar, "The real inbox avatar renderer must exist");
const compiled = await build({
  absWorkingDir: atrio, bundle: true, write: false, platform: "node", format: "cjs",
  external: ["react", "react/jsx-runtime", "react-dom/server", "next/*"],
  stdin: { loader: "tsx", resolveDir: atrio, contents: `
    import React from 'react'; import Image from 'next/image'; import {renderToStaticMarkup} from 'react-dom/server';
    import {playerAvatarBrand} from './src/lib/player-avatar-brand';
    export {MULTI_SKIN_CODES,MULTI_SKIN_CATALOG} from './src/lib/multi-skin-catalog';
    const contactLabel = conversation => conversation.contact.displayName;
    const initials = value => value.slice(0,2);
    ${avatar.getText(ast)}
    export function render(provider,skin,size){return renderToStaticMarkup(<PlayerAvatar className={'avatar-frame frame-'+size} conversation={{id:'same-conversation-fixture',contact:{displayName:'Mismo jugador',targetProvider:provider,providerSkinCode:skin}}}/>);}
  ` },
});
const module = { exports: {} };
new Function("require", "module", "exports", compiled.outputFiles[0].text)(appRequire, module, module.exports);
const api = module.exports;
const samples = [
  ["rey_de_ases", null, "Rey de Ases"], ["ases_del_norte", null, "Ases del Norte"], ["ganamos_net", null, "Ganamos NET"],
  ...api.MULTI_SKIN_CODES.map(code => ["multi_skin", code, api.MULTI_SKIN_CATALOG[code].name]),
];
const cards = samples.map(([provider, skin, label]) => `<article data-provider="${provider}" data-skin="${skin ?? ""}"><h2>${label}</h2><div class="avatars">${[36, 56, 84].map(size => api.render(provider, skin, size)).join("")}</div></article>`).join("");
const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>
*{box-sizing:border-box}body{margin:0;padding:24px;background:#0b0b0f;color:#eee;font:14px system-ui}h1{font-size:20px;margin:0 0 8px}p{margin:0 0 20px;color:#a1a1aa}main{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}article{padding:16px;border:1px solid #38383f;border-radius:14px;background:#18181c}h2{font-size:14px;margin:0 0 16px}.avatars{display:flex;align-items:center;justify-content:space-between;gap:10px}.avatar-frame{border-radius:50%;flex-shrink:0}.frame-36{width:36px;height:36px}.frame-56{width:56px;height:56px}.frame-84{width:84px;height:84px}.overflow-hidden{overflow:hidden}.bg-black{background:#000}.h-full{height:100%}.w-full{width:100%}.object-cover{object-fit:cover}.object-contain{object-fit:contain}@media(max-width:700px){body{padding:12px}main{grid-template-columns:1fr}}
</style><h1>Avatares por skin · Atrio</h1><p>Componente real del inbox · 36, 56 y 84 px · originales conservados</p><main>${cards}</main>`;
const output = path.join(atrio, "docs/validation");
await mkdir(output, { recursive: true });
const checks = [];
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://127.0.0.1");
    if (url.pathname === "/") { response.setHeader("Content-Type", "text/html; charset=utf-8"); response.end(html); return; }
    const asset = url.pathname === "/_next/image" ? url.searchParams.get("url") : url.pathname;
    const filename = path.resolve(atrio, "public", "." + asset);
    if (!asset?.startsWith("/brands/") || !filename.startsWith(path.join(atrio, "public") + path.sep)) { response.writeHead(404).end(); return; }
    const image = await readFile(filename);
    // Match next.config.ts's AVIF/WebP negotiation; Windows WebKit has no AVIF decoder.
    const avif = String(request.headers.accept).includes("image/avif");
    response.setHeader("Content-Type", avif ? "image/avif" : "image/webp");
    response.end(avif ? image : await sharp(image).webp({ quality: 85 }).toBuffer());
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
try {
for (const [engine, browserType] of [["chromium", chromium], ["webkit", webkit]]) {
  const browser = await browserType.launch({ headless: true });
  try {
    for (const viewport of [{ width: 1280, height: 1100 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      const forbidden = [], errors = [], failed = [];
      page.on("pageerror", error => errors.push(error.message));
      page.on("requestfailed", request => failed.push({ url: request.url(), error: request.failure()?.errorText }));
      await context.route("**/*", async route => {
        const url = new URL(route.request().url());
        if (url.hostname !== "127.0.0.1") { forbidden.push(url.href); return route.abort(); }
        return route.continue();
      });
      await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: "networkidle" });
      const decoded = await page.evaluate(async () => {
        for (const img of document.images) img.loading = "eager";
        return Promise.all([...document.images].map(async img => {
          try { await img.decode(); return { ok: true }; }
          catch { return { ok: false, src: img.currentSrc || img.src }; }
        }));
      });
      assert.equal(decoded.every(image => image.ok), true, JSON.stringify({ engine, failed: failed.slice(0, 3), images: decoded.filter(image => !image.ok).slice(0, 3) }));
      const frames = await page.locator(".avatar-frame").evaluateAll(nodes => nodes.map(node => {
        const image = node.querySelector("img"), rect = node.getBoundingClientRect(), imageRect = image.getBoundingClientRect();
        return { width: rect.width, height: rect.height, imageWidth: imageRect.width, imageHeight: imageRect.height, loaded: image.complete && image.naturalWidth > 0, fit: getComputedStyle(image).objectFit, title: node.title, src: image.getAttribute("src") };
      }));
      assert.equal(frames.length, samples.length * 3);
      frames.forEach((frame, index) => {
        assert.equal(frame.loaded, true); assert.equal(frame.width, [36, 56, 84][index % 3]);
        assert.equal(frame.height, frame.width); assert.equal(frame.imageWidth, frame.width); assert.equal(frame.imageHeight, frame.height);
        assert.ok(frame.title); assert.ok(["contain", "cover"].includes(frame.fit));
      });
      const plus = frames[samples.findIndex(sample => sample[1] === "ganamos_plus") * 3];
      const bet30 = frames[samples.findIndex(sample => sample[1] === "bet30") * 3];
      assert.notEqual(plus.src, bet30.src); assert.match(bet30.title, /Bet30/);
      assert.deepEqual(forbidden, []); assert.deepEqual(errors, []);
      if (engine === "chromium" && viewport.width === 1280) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: path.join(output, "player-skin-avatars-20261030.png"), fullPage: true });
      }
      checks.push({ engine, viewport, avatars: frames.length, externalRequests: forbidden.length, errors });
      await context.close();
    }
  } finally { await browser.close(); }
}
} finally { await new Promise(resolve => server.close(resolve)); }
await writeFile(path.join(output, "player-skin-avatars-browser-20261030.json"), JSON.stringify({ checks }, null, 2) + "\n");
console.log(`PASS ${checks.length} browser/viewport checks, ${samples.length * 3 * checks.length} rendered avatars; no external requests.`);
