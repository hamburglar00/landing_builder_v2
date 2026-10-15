import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(path.join(root, "frontend/package.json"));
const { build } = require("esbuild");
const target = path.resolve(root, "../landing-prueba-1/lib/template7/shared.cjs");
const result = await build({
  absWorkingDir: path.join(root, "frontend"),
  entryPoints: ["components/public-landing/template7ClassicEntry.ts"],
  bundle: true, write: false, platform: "node", format: "cjs", target: "node22",
  jsx: "automatic", external: ["react", "react/jsx-runtime"],
  banner: { js: "// GENERATED from landing-builder. Run scripts/build-classic-template7.mjs --write there.\n// Contains only public rendering/tracking logic; no environment values are embedded." },
});
const source = result.outputFiles[0].text;
if (process.argv.includes("--write")) {
  await writeFile(target, source);
  console.log(`Generated shared Template 7 renderer (${Buffer.byteLength(source)} bytes, server-side only).`);
} else {
  const current = await readFile(target, "utf8");
  if (current !== source) throw new Error("Classic Template 7 is out of sync; regenerate before release.");
  console.log("Classic and constructor Template 7 sources are in sync.");
}
