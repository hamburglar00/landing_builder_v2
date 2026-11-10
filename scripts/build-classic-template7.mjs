import { createRequire } from "node:module";
import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(path.join(root, "frontend/package.json"));
const { build } = require("esbuild");
const target = path.resolve(root, "../landing-prueba-1/lib/template7/shared.cjs");
const resolutionTarget = path.resolve(root, "../landing-prueba-1/lib/landing/resolution.ts");
const resolutionSource = '// GENERATED from landing-builder/frontend/lib/landing/resolution.ts.\n' +
  await readFile(path.join(root, 'frontend/lib/landing/resolution.ts'), 'utf8');
const handoffTarget = path.resolve(root, "../landing-prueba-1/lib/reyDeAses/handoff-url.ts");
const handoffSource = '// GENERATED from landing-builder/frontend/lib/reyDeAses/handoff-url.ts.\n' +
  await readFile(path.join(root, 'frontend/lib/reyDeAses/handoff-url.ts'), 'utf8');
const fbcTarget = path.resolve(root, "../landing-prueba-1/lib/tracking/landingFbc.ts");
const fbcSource = '// GENERATED from landing-builder/frontend/lib/tracking/landingFbc.ts.\n' +
  await readFile(path.join(root, 'frontend/lib/tracking/landingFbc.ts'), 'utf8');
const registrationStatsTarget = path.resolve(root, "../landing-prueba-1/lib/reyDeAses/registrationStats.server.ts");
const registrationStatsSource = '// GENERATED from landing-builder/frontend/lib/reyDeAses/registrationStats.server.ts.\n' +
  await readFile(path.join(root, 'frontend/lib/reyDeAses/registrationStats.server.ts'), 'utf8');
const result = await build({
  absWorkingDir: path.join(root, "frontend"),
  entryPoints: ["components/public-landing/template7ClassicEntry.ts"],
  bundle: true, write: false, platform: "node", format: "cjs", target: "node22",
  jsx: "automatic", external: ["react", "react/jsx-runtime"],
  banner: { js: "// GENERATED from landing-builder. Run scripts/build-classic-template7.mjs --write there.\n// Contains only public rendering/tracking logic; no environment values are embedded." },
});
const source = result.outputFiles[0].text;
const classicRoot=path.resolve(root,'../landing-prueba-1');
const analytics=await build({absWorkingDir:classicRoot,entryPoints:['lib/landing/analytics-runtime.ts'],bundle:true,write:false,platform:'browser',format:'iife',target:'es2020',minify:true,legalComments:'none',define:{'process.env.NODE_ENV':'"production"'}});
const analyticsSource=analytics.outputFiles[0].text;
const analyticsName=`analytics-${createHash('sha256').update(analyticsSource).digest('hex').slice(0,24)}.js`;
const analyticsFile=path.join(classicRoot,'public/public-assets/template-entry',analyticsName);
const analyticsManifest=JSON.stringify({name:analyticsName},null,2)+'\n';
const analyticsManifestFile=path.join(classicRoot,'lib/landing/analytics.generated.json');
if(process.argv.includes('--write')){
  await writeFile(analyticsFile,analyticsSource);await writeFile(analyticsManifestFile,analyticsManifest);
}else if(await readFile(analyticsFile,'utf8')!==analyticsSource||await readFile(analyticsManifestFile,'utf8')!==analyticsManifest)throw Error('Classic analytics adapter out of sync');
const assetSource=path.join(root,'frontend/public/public-assets/template-entry');
const assetTarget=path.resolve(root,'../landing-prueba-1/public/public-assets/template-entry');
if(process.argv.includes('--write'))await mkdir(assetTarget,{recursive:true});
for(const name of await readdir(assetSource)){
  if(!/^(?:t[78]-(?:classic|builder)-[a-f0-9]{24}\.js|landing-[a-f0-9]{24}\.(?:js|css))$/.test(name))continue;
  const contents=await readFile(path.join(assetSource,name),'utf8');
  if(process.argv.includes('--write'))await writeFile(path.join(assetTarget,name),contents);
  else if(await readFile(path.join(assetTarget,name),'utf8')!==contents)throw Error('Classic entry asset out of sync: '+name);
}
if (process.argv.includes("--write")) {
  await writeFile(target, source);
  await writeFile(resolutionTarget, resolutionSource);
  await writeFile(handoffTarget, handoffSource);
  await writeFile(fbcTarget, fbcSource);
  await writeFile(registrationStatsTarget, registrationStatsSource);
  console.log(`Generated shared Template 7 renderer (${Buffer.byteLength(source)} bytes, server-side only).`);
} else {
  const current = await readFile(target, "utf8");
  if (current !== source) throw new Error("Classic Template 7 is out of sync; regenerate before release.");
  if (await readFile(registrationStatsTarget, 'utf8') !== registrationStatsSource) throw new Error('Confirmed account statistics are out of sync.');
  if (await readFile(resolutionTarget, 'utf8') !== resolutionSource) throw new Error('Classic landing resolution capture is out of sync.');
  if (await readFile(handoffTarget, 'utf8') !== handoffSource) throw new Error('Classic handoff URL validation is out of sync.');
  if (await readFile(fbcTarget, 'utf8') !== fbcSource) throw new Error('Classic scoped FBC is out of sync.');
  console.log("Classic and constructor Template 7 sources are in sync.");
}
