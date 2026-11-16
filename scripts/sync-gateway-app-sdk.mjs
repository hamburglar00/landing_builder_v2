import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { loadProductPaths } from './product-worktrees.mjs';
const productPath = loadProductPaths();

// Every gateway remains independently deployable; this is the source synchronization step.
const canonical = pathToFileURL(productPath('landing-autologuin', 'public/gateway-app-sdk.js'));
const source = await readFile(canonical);
// Only the keyboard controller and its two CSS rules are shared here.
// The surrounding clients contain provider-specific branding/support adapters.
const viewportPattern = /  function syncChatVisualViewport\(\) \{[\s\S]*?(?=  function scheduleChatVisualViewport\(\))/;
const keyboardPattern = /html\[data-gateway-keyboard="true"\] #gateway-chat-shell\s*\{[^}]*\}/g;
const canonicalClient = await readFile(productPath('landing-autologuin', 'public/gateway-client.js'), 'utf8');
const viewport = canonicalClient.match(viewportPattern)?.[0];
const keyboardRules = (await readFile(productPath('landing-autologuin', 'public/gateway-client.css'), 'utf8')).match(keyboardPattern);
if (!viewport || keyboardRules?.length !== 2) throw Error('Canonical keyboard fragments changed');
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
    const target = productPath(repo, 'public', file);
    const previous = await readFile(target, 'utf8');
    let expected;
    if (file.endsWith('.js')) {
      if (!viewportPattern.test(previous)) throw Error('Missing viewport controller: ' + repo);
      expected = previous.replace(viewportPattern, () => viewport);
    } else {
      let count = 0;
      expected = previous.replace(keyboardPattern, () => keyboardRules[count++]);
      if (count !== 2) throw Error('Missing keyboard styles: ' + repo);
    }
    if (process.argv.includes('--check')) {
      if (previous !== expected) throw new Error(`Teclado desactualizado: ${repo}/${file}`);
    } else await writeFile(target, expected);
  }
}
console.log(JSON.stringify({ canonical: fileURLToPath(canonical), gateways: 4, sha256: createHash('sha256').update(source).digest('hex') }));
