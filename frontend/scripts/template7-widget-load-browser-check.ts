import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

// Run the actual rewriters and widget scripts with every request intercepted.
// Casino scripts and render-blocking CSS stay pending until the iframe starts.
async function main() {
  const root = path.resolve(process.cwd(), "../..");
  const { chromium } = await import(
    pathToFileURL(
      path.join(root, "landing-builder/scripts/phase0/browser-runtime.mjs"),
    ).href
  );
  const providers = [
    {
      repo: "landing-autologuin",
      rewrite: "rewriteReyHtml",
      extra: "",
      result: ".html",
    },
    {
      repo: "multi-skin-gateway",
      rewrite: "rewriteMultiSkinHtml",
      extra: 'import {getSkinConfig} from "./src/lib/skin-registry";',
      options:
        'skin:getSkinConfig("ganamos_plus"),accessToken:"synthetic",user:{id:1},',
      result: "",
    },
    {
      repo: "ases-gateway",
      rewrite: "rewriteAsesHtml",
      extra: 'import {getProviderConfig} from "./src/lib/skin-registry";',
      options: "provider:getProviderConfig(),",
      result: "",
    },
    {
      repo: "ganamos-gateway",
      rewrite: "rewriteGanamosHtml",
      extra: 'import {getProviderConfig} from "./src/lib/skin-registry";',
      options: "provider:getProviderConfig(),",
      result: "",
    },
  ];
  const results = [];
  for (const entry of providers) {
    const repo = path.join(root, entry.repo);
    const source = `import {${entry.rewrite}} from "./src/lib/html-rewriter";${entry.extra}
      export const html=${entry.rewrite}('<!doctype html><html><head><link rel="stylesheet" href="/slow-provider.css"><script defer src="/slow-provider.js"></script></head><body><main>Casino</main></body></html>',${entry.result ? "{gatewayClient:" : ""}{appId:"synthetic",displayName:"Synthetic",chatEmbedUrl:"https://atrio.test/embed/synthetic",${entry.options ?? ""}}${entry.result ? "}" : ""})${entry.result};`;
    const compiled = await build({
      absWorkingDir: repo,
      tsconfig: path.join(repo, "tsconfig.json"),
      stdin: { contents: source, resolveDir: repo, loader: "ts" },
      bundle: true,
      write: false,
      platform: "node",
      format: "cjs",
      packages: "external",
    });
    const loaded = { exports: {} as { html: string } };
    new Function("module", "exports", "require", compiled.outputFiles[0].text)(
      loaded,
      loaded.exports,
      createRequire(path.join(repo, "package.json")),
    );
    const client = await readFile(
      path.join(repo, "public/gateway-client.js"),
      "utf8",
    );
    const browser = await chromium();
    let held: string | undefined;
    let heldStyle: string | undefined;
    let iframeRequested = false;
    const pending = new Set<Promise<unknown>>();
    const fulfill = (requestId: string, body: string, contentType: string) =>
      browser.send("Fetch.fulfillRequest", {
        requestId,
        responseCode: 200,
        responseHeaders: [{ name: "Content-Type", value: contentType }],
        body: Buffer.from(body).toString("base64"),
      });
    try {
      await browser.send("Page.enable");
      await browser.send("Runtime.enable");
      await browser.send("Fetch.enable", { patterns: [{ urlPattern: "*" }] });
      browser.on(
        "Fetch.requestPaused",
        (event: { requestId: string; request: { url: string } }) => {
          const u = new URL(event.request.url);
          if (u.pathname === "/slow-provider.js") {
            held = event.requestId;
            return;
          }
          if (u.pathname === "/slow-provider.css") {
            heldStyle = event.requestId;
            return;
          }
          if (u.pathname === "/embed/synthetic") iframeRequested = true;
          const work = fulfill(
            event.requestId,
            u.pathname === "/casino"
              ? loaded.exports.html
              : u.pathname === "/gateway-client.js"
                ? client
                : u.pathname === "/embed/synthetic"
                  ? "<!doctype html><html><body>Chat</body></html>"
                  : "",
            u.pathname.endsWith(".js")
              ? "text/javascript"
              : u.pathname.endsWith(".css")
                ? "text/css"
                : "text/html",
          );
          pending.add(work);
          void work.finally(() => pending.delete(work)).catch(() => {});
        },
      );
      await browser.send("Page.navigate", {
        url: "https://gateway.test/casino",
      });
      const end = Date.now() + 8000;
      while (Date.now() < end && (!held || !heldStyle || !iframeRequested))
        await new Promise((resolve) => setTimeout(resolve, 30));
      assert.ok(held, "The provider script must still be pending");
      assert.ok(heldStyle, "The render-blocking stylesheet must still be pending");
      assert.equal(
        iframeRequested,
        true,
        `${entry.repo}: chat must start while casino scripts and CSS are pending`,
      );
      assert.equal(await browser.evaluate("!!window.__providerLoaded"), false);
      assert.equal(
        await browser.evaluate(
          "!!document.querySelector('#gateway-chat-shell iframe')",
        ),
        true,
      );
      await fulfill(held, "window.__providerLoaded=true", "text/javascript");
      held = undefined;
      await fulfill(heldStyle, "body{background:#111}", "text/css");
      heldStyle = undefined;
      results.push({ gateway: entry.repo, chatStartsBeforeCasinoScript: true, chatStartsBeforeCasinoStylesheet: true });
    } finally {
      if (held) await fulfill(held, "", "text/javascript").catch(() => {});
      if (heldStyle) await fulfill(heldStyle, "", "text/css").catch(() => {});
      await Promise.allSettled([...pending]);
      await browser.close();
    }
  }
  console.log(
    JSON.stringify(
      { passed: results, externalNetwork: 0, realAccountsCreated: 0 },
      null,
      2,
    ),
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
