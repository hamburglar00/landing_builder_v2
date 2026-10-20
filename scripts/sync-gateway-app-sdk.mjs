import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

// Every gateway remains independently deployable; this is the source synchronization step.
const canonical = new URL('../../landing-autologuin/public/gateway-app-sdk.js', import.meta.url);
const source = await readFile(canonical);
for (const repo of ['ases-gateway', 'ganamos-gateway', 'multi-skin-gateway']) {
  const destination = new URL(`../../${repo}/public/gateway-app-sdk.js`, import.meta.url);
  if (process.argv.includes('--check')) {
    if (!(await readFile(destination)).equals(source)) throw new Error(`SDK desactualizado: ${repo}`);
  } else await writeFile(destination, source);
  const capture = await readFile(new URL('../../landing-autologuin/src/lib/gateway-app-capture.ts', import.meta.url));
  const captureDestination = new URL(`../../${repo}/src/lib/gateway-app-capture.ts`, import.meta.url);
  if (process.argv.includes('--check')) {
    if (!(await readFile(captureDestination)).equals(capture)) throw new Error(`Captura desactualizada: ${repo}`);
  } else await writeFile(captureDestination, capture);
}
console.log(JSON.stringify({ canonical: fileURLToPath(canonical), gateways: 4, sha256: createHash('sha256').update(source).digest('hex') }));
