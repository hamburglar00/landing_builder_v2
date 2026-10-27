import {readFile,writeFile} from 'node:fs/promises';
const source=await readFile(new URL('../frontend/lib/reyDeAses/request-recovery.ts',import.meta.url),'utf8');
const targets=['landing-autologuin/src/lib/request-recovery.ts','ases-gateway/src/lib/request-recovery.ts','ganamos-gateway/src/lib/request-recovery.ts','multi-skin-gateway/src/lib/request-recovery.ts','landing-prueba-1/lib/reyDeAses/request-recovery.ts'];
for(const target of targets){
 const url=new URL('../../'+target,import.meta.url);
 if(process.argv.includes('--check')){if(await readFile(url,'utf8')!==source)throw Error('Entry recovery drift: '+target)}
 else await writeFile(url,source);
}
console.log('Entry recovery synchronized across both engines and four gateways.');
