import {readFile,writeFile} from 'node:fs/promises';
import {loadProductPaths} from './product-worktrees.mjs';
const productPath=loadProductPaths();
const repos=['landing-autologuin','ases-gateway','ganamos-gateway','multi-skin-gateway'];
for(const name of ['gateway-entry-shell.ts','gateway-session-reuse.ts','parallel-chat-prepare.ts','gateway-entry-shell.test.ts','gateway-session-reuse.test.ts','parallel-chat-prepare.test.ts']){
 const source=await readFile(productPath('landing-autologuin','src/lib',name),'utf8');
 for(const repo of repos){const file=productPath(repo,'src/lib',name);
  if(process.argv.includes('--check')){if(await readFile(file,'utf8')!==source)throw Error('Entry runtime drift: '+repo+'/'+name);}
  else await writeFile(file,source);
 }
}
const shell=await readFile(productPath('landing-autologuin','src/lib/gateway-entry-shell.ts'),'utf8');
const guard=shell.split('export const GATEWAY_CASINO_FRAME_GUARD = `')[1].split('`;')[0].replaceAll('\r\n','\n');
for(const repo of repos){
 const file=productPath(repo,'public/gateway-client.js');let source=(await readFile(file,'utf8')).replaceAll('\r\n','\n');
 if(!source.includes(guard)){
  if(process.argv.includes('--check'))throw Error('Missing casino frame guard: '+repo);
  if(source.includes('gateway-casino-frame'))throw Error('Conflicting casino frame guard: '+repo);
  source=source.replace('(() => {\n','(() => {\n'+guard);await writeFile(file,source);
 }
}
console.log('Entry runtime synchronized across all four gateways.');
