import { createRequire } from "node:module";
import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(path.join(root, "frontend/package.json"));
const { build } = require("esbuild");
const target = path.resolve(root, "../landing-prueba-1/lib/template7/shared.cjs");
const resolutionTarget = path.resolve(root, "../landing-prueba-1/lib/landing/resolution.ts");
const resolutionSource = '// GENERATED from landing-builder/frontend/lib/landing/resolution.ts.\n' +
  await readFile(path.join(root, 'frontend/lib/landing/resolution.ts'), 'utf8');
const result = await build({
  absWorkingDir: path.join(root, "frontend"),
  entryPoints: ["components/public-landing/template7ClassicEntry.ts"],
  bundle: true, write: false, platform: "node", format: "cjs", target: "node22",
  jsx: "automatic", external: ["react", "react/jsx-runtime"],
  banner: { js: "// GENERATED from landing-builder. Run scripts/build-classic-template7.mjs --write there.\n// Contains only public rendering/tracking logic; no environment values are embedded." },
});
const source = result.outputFiles[0].text;
const assetSource=path.join(root,'frontend/public/public-assets/template-entry');
const assetTarget=path.resolve(root,'../landing-prueba-1/public/public-assets/template-entry');
if(process.argv.includes('--write'))await mkdir(assetTarget,{recursive:true});
for(const name of await readdir(assetSource)){
  if(!/^t[78]-(?:classic|builder)-[a-f0-9]{24}\.js$/.test(name))continue;
  const contents=await readFile(path.join(assetSource,name),'utf8');
  if(process.argv.includes('--write'))await writeFile(path.join(assetTarget,name),contents);
  else if(await readFile(path.join(assetTarget,name),'utf8')!==contents)throw Error('Classic entry asset out of sync: '+name);
}
if (process.argv.includes("--write")) {
  await writeFile(target, source);
  await writeFile(resolutionTarget, resolutionSource);
  console.log(`Generated shared Template 7 renderer (${Buffer.byteLength(source)} bytes, server-side only).`);
} else {
  const current = await readFile(target, "utf8");
  if (current !== source) throw new Error("Classic Template 7 is out of sync; regenerate before release.");
  if (await readFile(resolutionTarget, 'utf8') !== resolutionSource) throw new Error('Classic landing resolution capture is out of sync.');
  console.log("Classic and constructor Template 7 sources are in sync.");
}
