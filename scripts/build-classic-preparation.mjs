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
const classicRoot = path.resolve(process.env.LANDING_CLASSIC_ROOT || path.join(root, "../landing-prueba-1"));
const directory = path.join(classicRoot, "lib/template7");
const target = path.join(directory, "preparation.cjs");
const source = result.outputFiles[0].text;
if (process.argv.includes("--write")) {
  await mkdir(directory, { recursive: true });
  await writeFile(target, source);
} else if (await readFile(target, "utf8") !== source) {
  throw Error("Classic preparation issuer is stale; regenerate it from Builder.");
}
console.log("Verified shared classic preparation issuer (server only).");
