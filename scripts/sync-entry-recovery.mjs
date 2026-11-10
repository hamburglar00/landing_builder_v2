import {readFile,writeFile} from 'node:fs/promises';
import {loadProductPaths} from './product-worktrees.mjs';
const productPath=loadProductPaths();
const source=await readFile(productPath('landing-builder','frontend/lib/reyDeAses/request-recovery.ts'),'utf8');
const targets=['landing-autologuin/src/lib/request-recovery.ts','ases-gateway/src/lib/request-recovery.ts','ganamos-gateway/src/lib/request-recovery.ts','multi-skin-gateway/src/lib/request-recovery.ts','landing-prueba-1/lib/reyDeAses/request-recovery.ts'];
for(const target of targets){
 const [repo,...segments]=target.split('/');
 const url=productPath(repo,...segments);
 if(process.argv.includes('--check')){if(await readFile(url,'utf8')!==source)throw Error('Entry recovery drift: '+target)}
 else await writeFile(url,source);
}
console.log('Entry recovery synchronized across both engines and four gateways.');
