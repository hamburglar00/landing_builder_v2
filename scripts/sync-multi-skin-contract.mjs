import {readFile,writeFile} from 'node:fs/promises';
for(const name of ['multi-skin-catalog.ts','skin-branding.ts']) {
  const source=await readFile(new URL('../../multi-skin-gateway/src/lib/'+name,import.meta.url),'utf8');
  for(const folder of ['../frontend/lib/','../../internal-chat/src/lib/','../../landing-prueba-1/lib/']) {
    const target=new URL(folder+name,import.meta.url);
    if(process.argv.includes('--check')) {
      if((await readFile(target,'utf8')).replaceAll('\r\n','\n')!==source.replaceAll('\r\n','\n')) throw Error('Multi Skin catalog differs: '+folder+name);
    } else await writeFile(target,source);
  }
}
console.log('Multi Skin catalog synchronized.');
