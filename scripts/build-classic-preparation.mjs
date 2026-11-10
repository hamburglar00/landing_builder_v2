import { createRequire } from "node:module";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(path.join(root, "frontend/package.json"));
const { build } = require("esbuild");
const result = await build({
  absWorkingDir: path.join(root, "frontend"),
  entryPoints: ["lib/reyDeAses/classic-preparation-issue.server.ts"],
  bundle: true, write: false, platform: "node", format: "cjs", target: "node20",
  banner: { js: "// GENERATED SERVER-ONLY issuer from landing-builder. Run scripts/build-classic-preparation.mjs --write there. No environment values are embedded." },
});
const directory = new URL("../../landing-prueba-1/lib/template7/", import.meta.url);
const target = new URL("preparation.cjs", directory);
const source = result.outputFiles[0].text;
if (process.argv.includes("--write")) {
  await mkdir(directory, { recursive: true });
  await writeFile(target, source);
} else if (await readFile(target, "utf8") !== source) {
  throw Error("Classic preparation issuer is stale; regenerate it from Builder.");
}
console.log("Verified shared classic preparation issuer (server only).");
