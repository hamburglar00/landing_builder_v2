import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const icons = {
  rey_de_ases: ['landing-autologuin', 'rey-de-ases-logo-transparent.optimized.webp'],
  ases_del_norte: ['ases-gateway', 'ases-del-norte-transition-logo.optimized.webp'],
  ganamos_net: ['ganamos-gateway', 'ganamos-net-transition-logo.webp'],
  ganamos_plus: ['multi-skin-gateway', 'ganamos-plus-logo-transparent.optimized.webp'],
};
for (const skin of ['jugamos','casino_zeus','bet30','gana_en_casa','celu_apuestas','casino_zeta','oro_puro','fortu_bet','gran_poseidon','kona_bet','mega_faraon','camel_bet','rhino_play']) icons[skin] = ['multi-skin-gateway', `skins/${skin}/logo.webp`];
for (const [name, [repo, icon]] of Object.entries(icons)) {
  // Reuse the gateway logo bytes, preserving transparency and original proportions.
  const optimized = await readFile(path.resolve(root, '..', repo, 'public', icon));
  for (const publicRoot of ['frontend/public', '../landing-prueba-1/public']) {
    const target = path.resolve(root, publicRoot, 'public-assets/template9', `${name}_logo.webp`);
    if (process.argv.includes('--check')) {
      if (!(await readFile(target)).equals(optimized)) throw Error('Template 9 icon out of sync: ' + target);
    } else { await mkdir(path.dirname(target), {recursive:true}); await writeFile(target, optimized); }
  }
  console.log(`${name}: ${optimized.length} bytes`);
}
