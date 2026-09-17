import { createRequire } from 'node:module';
import { existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, join, relative, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { findBrowser } from './browser-runtime.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(join(root,'frontend/package.json'));
const { buildSync } = require('esbuild'); // Already supplied by tsx; no dependency changes.
const browser = findBrowser();
const dir = mkdtempSync(join(tmpdir(),'landing-phase0-'));
try {
  const bundle = buildSync({entryPoints:[join(root,'scripts/phase0/audience-benchmark.ts')],bundle:true,write:false,platform:'browser',format:'iife'}).outputFiles[0].text;
  writeFileSync(join(dir,'index.html'),`<!doctype html><pre id="result"></pre><script>${bundle}</script>`);
  const r = spawnSync(browser, ['--headless','--disable-gpu','--no-first-run','--disable-background-networking',`--user-data-dir=${join(dir,'profile')}`,'--dump-dom',pathToFileURL(join(dir,'index.html')).href],{encoding:'utf8',timeout:60000,maxBuffer:1024*1024});
  const json = r.stdout?.match(/<pre id="result">([^<]+)<\/pre>/)?.[1];
  if (!json) throw new Error(`Browser benchmark did not finish (${r.status ?? r.error?.message})`);
  console.log(JSON.stringify(JSON.parse(json),null,2));
} finally {
  // Only the fresh mkdtemp directory created above; Chromium may briefly hold profile files.
  const withinTemp = relative(resolve(tmpdir()),resolve(dir));
  if (!withinTemp || isAbsolute(withinTemp) || withinTemp.startsWith('..') || !withinTemp.startsWith('landing-phase0-')) {
    throw new Error('Refusing to remove a directory outside this benchmark temporary root');
  }
  try { rmSync(resolve(dir),{recursive:true,force:true,maxRetries:3,retryDelay:200}); } catch { console.error('Temporary browser profile still locked; located at:',dir); }
}
