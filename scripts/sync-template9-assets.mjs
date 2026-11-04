import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const sharp = createRequire(new URL('../frontend/package.json', import.meta.url))('sharp');
const icons = {
  rey_de_ases: ['landing-autologuin', 'rey-de-ases-app-192.png'],
  ases_del_norte: ['ases-gateway', 'ases-del-norte-app-192.png'],
  ganamos_net: ['ganamos-gateway', 'ganamos-net-app-192.png'],
  ganamos_plus: ['multi-skin-gateway', 'ganamos-plus-app-192.png'],
};
for (const skin of ['jugamos','casino_zeus','bet30','gana_en_casa','celu_apuestas','casino_zeta','oro_puro','fortu_bet','gran_poseidon','kona_bet','mega_faraon','camel_bet','rhino_play']) icons[skin] = ['multi-skin-gateway', `skins/${skin}/icon-192.png`];
for (const [name, [repo, icon]] of Object.entries(icons)) {
  const source = await readFile(['ganamos_net','ganamos_plus'].includes(name) ? path.resolve(root, 'frontend/assets/template9/ganamos.png') : path.resolve(root, '..', repo, 'public', icon));
  const optimized = await sharp(source).resize(152, 152, {fit:'contain'}).webp({quality:82}).toBuffer();
  for (const publicRoot of ['frontend/public', '../landing-prueba-1/public']) {
    const target = path.resolve(root, publicRoot, 'public-assets/template9', `${name}.webp`);
    if (process.argv.includes('--check')) {
      if (!(await readFile(target)).equals(optimized)) throw Error('Template 9 icon out of sync: ' + target);
    } else { await mkdir(path.dirname(target), {recursive:true}); await writeFile(target, optimized); }
  }
  console.log(`${name}: ${optimized.length} bytes`);
}
