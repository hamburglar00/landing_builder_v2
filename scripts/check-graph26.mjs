// Exercise the real Purchase handlers and retries against Graph v26 with simulated IO.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const source=readFileSync(new URL('scripts/check-purchase-source-url.mjs',root),'utf8')
 .replaceAll("v25.0","v26.0")
 .replace('current.sent.push({',"assert.ok(url.pathname.startsWith('/v26.0/')); current.sent.push({")
 .replace("const root = fileURLToPath(new URL('../', import.meta.url));",'const root = '+JSON.stringify(decodeURIComponent(root.pathname).replace(/^\/([A-Z]:)/,'$1'))+';');
await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
