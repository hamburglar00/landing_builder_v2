import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
const sharp = createRequire(new URL("../../internal-chat/package.json", import.meta.url))("sharp");
const check = process.argv.includes("--check");
// Re-export the existing official spade artwork. No wordmark or new drawing.
for (const [repo, source, prefix, legacy, background] of [
  ["ganamos-gateway", "ganamos-spade.avif", "ganamos-spade", "ganamos-net-app", "#11001f"],
  ["multi-skin-gateway", "ganamos-plus-logo-transparent.png", "ganamos-plus-spade", "ganamos-plus-app", "#121212"],
]) {
  const root = new URL(`../../${repo}/public/`, import.meta.url), image = await readFile(new URL(source, root));
  for (const [size, suffix, old, maskable] of [[32,"favicon-32","icon",false],[180,"apple-180","apple-180",false],[192,"192","192",false],[512,"512","512",false],[512,"maskable-512","maskable-512",true]]) {
    const drawing = await sharp(image).resize(Math.round(size * (maskable ? .70 : .88)), Math.round(size * (maskable ? .70 : .88)), {fit:"contain",background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer();
    const buffer = await sharp({create:{width:size,height:size,channels:4,background:maskable?background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:drawing,gravity:"centre"}]).png({compressionLevel:9}).toBuffer();
    const names = [`${prefix}-${suffix}.png`, ...(size===32?[]:[`${legacy}-${old}.png`]), ...(size===192?[`${legacy}-icon.png`]:[])];
    for (const name of names) {
      const target = new URL(name, root);
      if (check) { if (!(await readFile(target)).equals(buffer)) throw Error(`PWA artwork differs: ${repo}/${name}`); }
      else await writeFile(target, buffer);
    }
  }
}
console.log(`${check?"Verified":"Exported"} Ganamos spade favicon, Apple, any and maskable icons.`);
