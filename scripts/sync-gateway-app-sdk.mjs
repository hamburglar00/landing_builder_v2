import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { loadProductPaths } from './product-worktrees.mjs';
const productPath = loadProductPaths();

// Every gateway remains independently deployable; this is the source synchronization step.
const canonical = pathToFileURL(productPath('landing-autologuin', 'public/gateway-app-sdk.js'));
const source = await readFile(canonical);
for (const repo of ['ases-gateway', 'ganamos-gateway', 'multi-skin-gateway']) {
  const destination = pathToFileURL(productPath(repo, 'public/gateway-app-sdk.js'));
  if (process.argv.includes('--check')) {
    if (!(await readFile(destination)).equals(source)) throw new Error(`SDK desactualizado: ${repo}`);
  } else await writeFile(destination, source);
  const capture = await readFile(productPath('landing-autologuin', 'src/lib/gateway-app-capture.ts'));
  const captureDestination = pathToFileURL(productPath(repo, 'src/lib/gateway-app-capture.ts'));
  if (process.argv.includes('--check')) {
    if (!(await readFile(captureDestination)).equals(capture)) throw new Error(`Captura desactualizada: ${repo}`);
  } else await writeFile(captureDestination, capture);
  for (const file of ['gateway-client.js', 'gateway-client.css']) {
    const expected = await readFile(productPath('landing-autologuin', 'public', file));
    const target = productPath(repo, 'public', file);
    if (process.argv.includes('--check')) {
      if (!(await readFile(target)).equals(expected)) throw new Error(`Cliente desactualizado: ${repo}/${file}`);
    } else await writeFile(target, expected);
  }
}
console.log(JSON.stringify({ canonical: fileURLToPath(canonical), gateways: 4, sha256: createHash('sha256').update(source).digest('hex') }));
