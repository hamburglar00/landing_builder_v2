import{readFile,writeFile}from'node:fs/promises';
const check=process.argv.includes('--check'),root=new URL('../../',import.meta.url),read=async file=>(await readFile(new URL(file,root),'utf8')).replaceAll('\r\n','\n');
const canonical=await read('landing-autologuin/public/gateway-client.js'),pattern=/  let chatClearanceFrame = 0;[\s\S]*?  function scheduleChatVisualViewport\(\) \{[\s\S]*?\n  \}/,section=canonical.match(pattern)?.[0];
if(!section)throw Error('Missing canonical chat viewport');
for(const repo of ['landing-autologuin','ases-gateway','ganamos-gateway','multi-skin-gateway']){
 const capture=await read('landing-autologuin/src/lib/gateway-app-capture.ts'),capturePath=new URL(repo+'/src/lib/gateway-app-capture.ts',root);
 if(check){if(await read(repo+'/src/lib/gateway-app-capture.ts')!==capture)throw Error('Early viewport capture differs: '+repo)}else await writeFile(capturePath,capture);
 let before=await read(repo+'/public/gateway-client.js'),after=before.replace(pattern,()=>section);
 if(check){if(after!==before)throw Error('Chat viewport differs: '+repo)}else await writeFile(new URL(repo+'/public/gateway-client.js',root),after);
 const css=await read(repo+'/public/gateway-client.css');let next=css.replace(/(?:-webkit-)?backdrop-filter:\s*blur\([^)]*\)\s*saturate\([^)]*\);/g,'backdrop-filter: none;').replace('background: rgba(4, 4, 7, 0.54);','background: rgba(4, 4, 7, 0.64);');
 const marker='/* BEGIN shared installed chat viewport */';let shared=(await read('landing-autologuin/public/gateway-client.css')).split(marker)[1];if(!shared)throw Error('Missing shared viewport styles');shared=marker+shared;
 if(next.includes(marker))next=next.slice(0,next.indexOf(marker))+shared;else next=next.trimEnd()+'\n\n'+shared;
 if(check){if(next!==css)throw Error('Chat surface differs: '+repo)}else await writeFile(new URL(repo+'/public/gateway-client.css',root),next);
}
console.log('Chat viewport and dim surfaces synchronized across four gateways.');
