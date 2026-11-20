// Browser-level comparison of shipped markup. Requests resolve only to local fixtures.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { loadProductPaths } from "./product-worktrees.mjs";

const productPath = loadProductPaths();
const require = createRequire(productPath("landing-builder", "frontend/package.json"));
const { build } = require("esbuild");
const { chromium, webkit } = require("playwright");
async function renderers(repo, exports) {
  const cwd = productPath(repo);
  const result = await build({ absWorkingDir: cwd, stdin: { contents: exports, loader: "ts", resolveDir: cwd },
    platform: "node", format: "cjs", bundle: true, write: false, external: ["next/*"] });
  const module = { exports: {} };
  new Function("module", "exports", "require", result.outputFiles[0].text)(module, module.exports, createRequire(path.join(cwd, "package.json")));
  return module.exports;
}
const { gatewayAgencyPage, gatewayLoginPage, renderPreparationPage, renderGatewayEntryTransition, gatewayPreparationTheme } =
  await renderers("landing-autologuin", [
    'export { gatewayAgencyPage } from "./src/lib/gateway-agency-page";',
    'export { gatewayLoginPage } from "./src/lib/gateway-login-page";',
    'export { renderPreparationPage } from "./src/lib/preparation-page";',
    'export { renderGatewayEntryTransition, gatewayPreparationTheme } from "./src/lib/gateway-entry-transition";',
  ].join("\n"));
const { getMultiSkinBrand, MULTI_SKIN_CATALOG, multiSkinGatewayOrigin, NextRequest, proxyToMultiSkin } = await renderers("multi-skin-gateway", [
  'export { getMultiSkinBrand } from "./src/lib/skin-branding"; export { MULTI_SKIN_CATALOG } from "./src/lib/multi-skin-catalog";',
  'export { multiSkinGatewayOrigin } from "./src/lib/multi-skin-origins"; export { proxyToMultiSkin } from "./src/lib/proxy"; export { NextRequest } from "next/server";',
].join("\n"));
Object.assign(process.env, { VERCEL_ENV: "development", MULTI_SKIN_GATEWAY_BASE_DOMAIN: "skins.test",
  SESSION_ENCRYPTION_KEY: "fixture-session-secret-value-12345678", UPSTREAM_RELAY_ORIGIN: "https://relay.test",
  UPSTREAM_RELAY_API_KEY: "fixture-relay-key-with-32-characters" });
const brands = [
  { provider: "rey_de_ases", repo: "landing-autologuin" }, { provider: "ases_del_norte", repo: "ases-gateway" },
  { provider: "ganamos_net", repo: "ganamos-gateway" },
  ...Object.keys(MULTI_SKIN_CATALOG).map(skin => ({ provider: "multi_skin", repo: "multi-skin-gateway", skin, override: getMultiSkinBrand(skin) })),
];
const styleOf = el => {
  const css = getComputedStyle(el);
  return [css.color, css.fontFamily, css.fontSize, css.fontWeight, css.lineHeight, css.letterSpacing, css.textTransform];
};
function contrastWithWhite(hex) {
  const [r, g, b] = hex.match(/[a-f\d]{2}/ig).map(pair => {
    const channel = parseInt(pair, 16) / 255;
    return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
  });
  return 1.05 / (.2126 * r + .7152 * g + .0722 * b + .05);
}
const stripRuntime = html => html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<link\b[^>]*>/gi, "");
let checks = 0;
for (const launcher of [chromium, webkit]) {
  const browser = await launcher.launch({ headless: true });
  try {
    for (const [width, height, density] of [[320, 480, 3], [390, 844, 3], [1365, 768, 1]]) {
      const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: density });
      const page = await context.newPage();
      let html = "", repo = "";
      await context.route("**/*", async route => {
        const url = new URL(route.request().url());
        assert.equal(url.origin, "https://entry.test");
        if (url.pathname === "/") return route.fulfill({ contentType: "text/html", body: html });
        if (!/^\/(?:skins\/[a-z0-9_]+\/)?[a-z0-9_.-]+\.(avif|webp|png)$/.test(url.pathname)) return route.abort();
        return route.fulfill({ contentType: "image/" + path.extname(url.pathname).slice(1), body: await readFile(productPath(repo, "public", url.pathname.slice(1))) });
      });
      async function show(markup) {
        html = stripRuntime(markup);
        await page.goto("https://entry.test/");
      }
      for (const brand of brands) {
        const { provider, skin, override } = brand;
        repo = brand.repo;
        const theme = gatewayPreparationTheme(provider, override);
        const label = [launcher.name(), width, skin || provider].join(" ");
        assert.ok(contrastWithWhite(theme.background) >= 4.5, label + " stage contrast");
        await show('<meta name="viewport" content="width=device-width,initial-scale=1">' + renderGatewayEntryTransition(provider, { active: true, stage: "verifying", brand: override }));
        const title = page.locator("[data-entry-title]");
        const expected = await title.evaluate(styleOf);
        assert.equal(expected[0], "rgb(255, 255, 255)");
        assert.equal(expected[3], "700");
        assert.equal(expected[6], "none");
        const logoBounds = await page.locator("[data-entry-logo]").boundingBox();
        await title.evaluate(el => { el.textContent = "Verificando tu cuenta…"; });
        assert.deepEqual(await page.locator("[data-entry-logo]").boundingBox(), logoBounds, label + " quiet to verifying");
        if (provider === "ases_del_norte") {
          const asset = await page.locator("[data-entry-logo]").evaluate(async img => {
            await img.decode();
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
            const ctx = canvas.getContext("2d"); ctx.drawImage(img, 0, 0);
            return [img.currentSrc, getComputedStyle(img).filter, ctx.getImageData(canvas.width - 1, canvas.height - 1, 1, 1).data[3],
              getComputedStyle(img.closest(".entry-logo-halo"), "::before").backgroundImage];
          });
          assert.match(asset[0], /\.webp$/);
          assert.equal(asset[1], "none"); assert.equal(asset[2], 0); assert.match(asset[3], /radial-gradient/);
        }
        async function same(selector) {
          assert.deepEqual(await page.locator(selector).evaluate(styleOf), expected, label + " " + selector);
          checks++;
        }
        await show(renderPreparationPage("test-handoff", theme, "", { returningAccount: true }));
        await same("#entry-stage");
        const box = await page.locator("img.logo").boundingBox();
        for (const dimension of ["x","y","width","height"]) assert.ok(Math.abs(box[dimension]-logoBounds[dimension]) <= 1, label + " preparation logo " + dimension);
        await page.locator("#state").evaluate(main => { main.dataset.feedback = ""; main.dataset.view = "account"; main.dataset.returning = "true"; });
        await same("#account-title"); await same("#status");
        await page.locator("#continue").evaluate(btn => { btn.hidden = false; btn.dataset.busy = "true"; });
        await same("#continue");
        await page.locator("#state").evaluate(main => { main.dataset.view = "error"; });
        await same(".error h1");
        const customSkin = !!skin && skin !== "ganamos_plus";
        const loginBrand = customSkin ? { ...override, logo: override.logo.replace(/\.avif$/, ".webp") } : undefined;
        await show(await gatewayAgencyPage(provider, 17, undefined, skin, loginBrand).text());
        await same(".agency-verification"); await same("#agency-creating"); await same("#title"); await same("#agency-account-title");
        const nameColor = await page.locator("#agency-returning-name").evaluate(el => getComputedStyle(el).color);
        const [r,g,b] = theme.accent.slice(1).match(/../g).map(v => parseInt(v, 16));
        assert.equal(nameColor, "rgb(" + [r,g,b].join(", ") + ")", label + " verified name color");
        await page.locator("#submit").evaluate(el => { el.setAttribute("aria-busy","true"); });
        await same("#submit");
        const manual = skin ? await proxyToMultiSkin(new NextRequest(multiSkinGatewayOrigin(skin, "skins.test"), { headers: { accept: "text/html" } }))
          : gatewayLoginPage(provider);
        assert.equal(manual.status, 401);
        await show(await manual.text());
        await page.evaluate(() => { document.documentElement.dataset.recovery = "missing"; });
        const logo = await page.locator(".brand img").evaluate(async img => {
          await img.decode();
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
          let transparent = 0;
          for (let i = 3; i < data.length; i += 4) if (data[i] === 0) transparent++;
          const alpha = (x, y) => data[4 * (y * canvas.width + x) + 3];
          const x = canvas.width - 1, y = canvas.height - 1;
          const rect = img.getBoundingClientRect();
          return { clear: transparent / (canvas.width * canvas.height), corners: [alpha(0,0), alpha(x,0), alpha(0,y), alpha(x,y)],
            fit: getComputedStyle(img).objectFit, inView: rect.width > 0 && rect.left >= 0 && rect.right <= innerWidth };
        });
        assert.ok(logo.clear > .1 && logo.corners.filter(a => a <= 1).length >= 3, label + " transparent wordmark");
        assert.equal(logo.fit, "contain"); assert.ok(logo.inView, label + " contained wordmark");
        await same(".recovering"); await same("#login-title");
        await page.locator("#login-submit").evaluate(el => { el.setAttribute("aria-busy","true"); });
        await same("#login-submit");
      }
      await context.close();
    }
  } finally { await browser.close(); }
}
console.log(JSON.stringify({ checks, brands: brands.length, engines: ["Chromium","WebKit"], viewports: 3, externalRequests: 0 }));

