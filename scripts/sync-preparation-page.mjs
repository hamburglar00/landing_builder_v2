import { readFile, writeFile } from 'node:fs/promises';
const source = await readFile(new URL('../../landing-autologuin/src/lib/preparation-page.ts', import.meta.url), 'utf8');
for (const repo of ['ases-gateway', 'ganamos-gateway', 'multi-skin-gateway']) {
  const file = new URL(`../../${repo}/src/lib/preparation-page.ts`, import.meta.url);
  if (process.argv.includes('--check')) {
    if (await readFile(file, 'utf8') !== source) throw Error(`Preparation page drift: ${repo}`);
  } else await writeFile(file, source);
  const test = new URL(`../../${repo}/src/lib/preparation-page.test.ts`, import.meta.url);
  const canonicalTest = await readFile(new URL('../../landing-autologuin/src/lib/preparation-page.test.ts', import.meta.url), 'utf8');
  if (process.argv.includes('--check')) {
    if (await readFile(test, 'utf8') !== canonicalTest) throw Error(`Preparation test drift: ${repo}`);
  } else await writeFile(test, canonicalTest);
}
console.log('Preparation page synchronized across four gateways.');
