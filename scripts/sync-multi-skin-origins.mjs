import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const github = path.resolve(root, '../../../../Documents/GitHub');
const copies = [
  [path.resolve(root, '../landing-prueba-1/lib'), ['multi-skin-origins.ts', 'reyDeAses/gatewayOrigins.ts']],
  [path.resolve(root, '../multi-skin-gateway/src/lib'), ['multi-skin-origins.ts']],
  [path.resolve(root, '../internal-chat/src/lib'), ['multi-skin-origins.ts']],
  [path.join(github, 'api2/app/helpers'), ['multi-skin-origins.ts', 'multi-skin-catalog.ts']],
  [path.join(github, 'panel3/lib/utils'), ['multi-skin-origins.ts', 'multi-skin-catalog.ts', 'skin-branding.ts']],
];
for (const [folder, files] of copies) for (const name of files) {
  const source = await readFile(path.join(root, 'frontend/lib', name));
  const target = path.join(folder, name);
  if (process.argv.includes('--check')) {
    if (!(await readFile(target)).equals(source)) throw new Error(`Copia desactualizada: ${target}`);
  } else { await mkdir(folder, { recursive: true }); await writeFile(target, source); }
}
console.log('Catálogo y subdominios Multi Skin sincronizados.');
