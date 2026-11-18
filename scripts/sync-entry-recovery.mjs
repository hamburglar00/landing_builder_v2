import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { loadProductPaths } from "./product-worktrees.mjs";

const productPath = loadProductPaths();
const canonical = productPath("landing-builder", "frontend/lib/reyDeAses");
const require = createRequire(path.join(canonical, "../../package.json"));
const { build } = require("esbuild");
const moduleName = "request-recovery.ts";
const assetName = "request-recovery.browser.json";
const source = await readFile(path.join(canonical, moduleName), "utf8");

// Compile the named browser entry in isolation. Its generated sibling is only a
// re-export for server consumers and must never be an input to its own build.
const built = await build({
  absWorkingDir: canonical,
  stdin: { contents: 'export { fetchWithEntryRecovery } from "./request-recovery.ts"', resolveDir: canonical },
  bundle: true, write: false, platform: "browser", target: "es2020",
  format: "iife", globalName: "entryRecovery", minify: true, legalComments: "none",
  plugins: [{
    name: "omit-generated-reexport",
    setup(builder) {
      builder.onResolve({ filter: /request-recovery\.browser\.json$/ }, () => ({
        path: assetName, namespace: "generated", sideEffects: false,
      }));
      builder.onLoad({ filter: /.*/, namespace: "generated" }, () => ({ contents: '""', loader: "json" }));
    },
  }],
});
const script = built.outputFiles[0].text + "var fetchWithEntryRecovery = entryRecovery.fetchWithEntryRecovery;";
const asset = JSON.stringify(script) + "\n";
const targets = [
  canonical,
  productPath("landing-prueba-1", "lib/reyDeAses"),
  ...["landing-autologuin", "ases-gateway", "ganamos-gateway", "multi-skin-gateway"]
    .map(repo => productPath(repo, "src/lib")),
];
for (const target of targets) {
  for (const [name, expected] of [[moduleName, source], [assetName, asset]]) {
    if (target === canonical && name === moduleName) continue;
    const file = path.join(target, name);
    if (process.argv.includes("--check")) {
      const actual = await readFile(file, "utf8");
      if (actual.replaceAll("\r\n", "\n") !== expected.replaceAll("\r\n", "\n")) throw Error("Entry recovery drift: " + file);
    } else await writeFile(file, expected);
  }
}
console.log("Entry recovery synchronized across both engines and four gateways.");
