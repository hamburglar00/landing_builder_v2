import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const repos=['landing-autologuin','ases-gateway','ganamos-gateway','multi-skin-gateway'];
for(const name of ['gateway-entry-shell.ts','gateway-session-reuse.ts','parallel-chat-prepare.ts','gateway-entry-shell.test.ts','gateway-session-reuse.test.ts','parallel-chat-prepare.test.ts']){
 const source=await readFile(path.join(root,'landing-autologuin/src/lib',name),'utf8');
 for(const repo of repos){const file=path.join(root,repo,'src/lib',name);
  if(process.argv.includes('--check')){if(await readFile(file,'utf8')!==source)throw Error('Entry runtime drift: '+repo+'/'+name);}
  else await writeFile(file,source);
 }
}
const shell=await readFile(path.join(root,'landing-autologuin/src/lib/gateway-entry-shell.ts'),'utf8');
const guard=shell.split('export const GATEWAY_CASINO_FRAME_GUARD = `')[1].split('`;')[0];
for(const repo of repos){
 const file=path.join(root,repo,'public/gateway-client.js');let source=await readFile(file,'utf8');
 if(!source.includes(guard)){
  if(process.argv.includes('--check'))throw Error('Missing casino frame guard: '+repo);
  if(source.includes('gateway-casino-frame'))throw Error('Conflicting casino frame guard: '+repo);
  source=source.replace('(() => {\n','(() => {\n'+guard);await writeFile(file,source);
 }
}
console.log('Entry runtime synchronized across all four gateways.');
