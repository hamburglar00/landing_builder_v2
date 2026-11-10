import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const source=await readFile(path.join(root,'frontend/public/favicon.svg'),'utf8');
// Preserve all drawing geometry and the original mask; remove nonvisual markup and redundant values.
const svg=source.trim()
  .replace(/<title>[^<]*<\/title>/,'')
  .replace(/ (?:role|aria-label)="[^"]*"/g,'')
  .replace(/^(<svg[^>]*?) width="64" height="64"/,'$1')
  .replaceAll(' fill="#0B1410"','')
  .replace('<g transform=', '<g fill="#0B1410" transform=')
  .replace(/(\d+)\.0+\b/g,'$1')
  .replace(/(\d+\.\d*?[1-9])0+\b/g,'$1')
  .replace(/>\s+</g,'><');
const name=`landingbuilder-favicon-${createHash('sha256').update(svg).digest('hex').slice(0,24)}.svg`;
const target=path.join(root,'frontend/public/public-assets/template-entry',name);
const manifest=path.join(root,'frontend/components/public-landing/publicLandingFavicon.generated.json');
const json=JSON.stringify({name},null,2)+'\n';
if(process.argv.includes('--write')){
  await writeFile(target,svg);await writeFile(manifest,json);
}else if(await readFile(target,'utf8')!==svg||await readFile(manifest,'utf8')!==json){
  throw Error('Public favicon is out of sync; run scripts/build-public-landing-favicon.mjs --write');
}
console.log(`${process.argv.includes('--write')?'Generated':'Verified'} public LandingBuilder favicon: ${Buffer.byteLength(svg)} bytes (source ${Buffer.byteLength(source)} bytes).`);
