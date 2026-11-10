import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { loadProductPaths } from './product-worktrees.mjs';
const productPath = loadProductPaths();
const targets = ['landing-autologuin', 'ases-gateway', 'ganamos-gateway', 'multi-skin-gateway'];
const sources = [
  ['landing-autologuin/src/lib/performance.ts', 'src/lib/performance.ts'],
  ['landing-builder/frontend/lib/landing/entryFunnel.ts', 'src/lib/entry-funnel.ts'],
  ['landing-autologuin/src/lib/entry-funnel-server.ts', 'src/lib/entry-funnel-server.ts'],
  ['landing-autologuin/src/lib/entry-funnel-proxy.ts', 'src/lib/entry-funnel-proxy.ts'],
  ['landing-autologuin/src/lib/entry-funnel-server.test.ts', 'src/lib/entry-funnel-server.test.ts'],
  ['landing-autologuin/src/lib/entry-funnel-client.test.ts', 'src/lib/entry-funnel-client.test.ts'],
  ['landing-autologuin/src/app/api/entry-funnel/route.ts', 'src/app/api/entry-funnel/route.ts'],
  ['landing-autologuin/src/app/api/preparations/complete/funnel-error.test.ts', 'src/app/api/preparations/complete/funnel-error.test.ts'],
];
for (const [source, target] of sources) {
  const [sourceRepo, ...sourcePath] = source.split('/');
  const content = await readFile(productPath(sourceRepo, ...sourcePath), 'utf8');
  for (const repo of targets) {
    const file = productPath(repo, target);
    if (process.argv.includes('--check')) {
      if (await readFile(file, 'utf8') !== content) throw Error('Gateway funnel drift: ' + repo + '/' + target);
    } else { await mkdir(path.dirname(file), {recursive:true}); await writeFile(file, content); }
  }
}
console.log('Gateway entry diagnostics synchronized across four gateways.');
