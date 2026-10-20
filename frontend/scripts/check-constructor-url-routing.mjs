import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile, writeFile } from 'node:fs/promises';
import { createServer, request as httpRequest } from 'node:http';
import { fileURLToPath } from 'node:url';

// Build and exercise the actual production router against local synthetic data.
// No browser scripts run, accounts are created, or conversion events are sent.
const cwd = fileURLToPath(new URL('../', import.meta.url));
const fixtureStatePath = new URL('../.next/constructor-url-routing-fixture.json', import.meta.url);
// Only reuse after changing the test harness; source changes require a fresh build.
const saved = process.argv.includes('--reuse-build') ? JSON.parse(await readFile(fixtureStatePath, 'utf8')) : null;
const providers = ['rey_de_ases', 'ases_del_norte', 'ganamos_net', 'multi_skin'];
const fixtures = new Map([
  ['url-test-a', { template: 1 }], ['url-test-b', { template: 2 }],
  ...providers.map(provider => [`url-test-${provider}`, { template: 7, provider }]),
]);
const api = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  res.setHeader('Content-Type', 'application/json');
  if (url.pathname === '/functions/v1/builder-config') {
    const name = url.searchParams.get('name');
    const fixture = fixtures.get(name);
    if (!fixture) { res.statusCode = 404; return res.end('{}'); }
    return res.end(JSON.stringify({
      id: '91000000-0000-4000-8000-000000000011', name, schemaVersion: 1, updatedAt: '',
      layout: { template: fixture.template, ctaPosition: 'bottom' },
      content: { logoUrl: '', title: [`Fixture ${name}`], subtitle: [], ctaText: 'Continuar' },
      tracking: { pixelId: '', postUrl: '', landingTag: 'TEST', target_provider: fixture.provider,
        skin_code: fixture.provider === 'multi_skin' ? 'ganamos_plus' : undefined },
    }));
  }
  if (url.pathname === '/rest/v1/rpc/get_cached_constructor_landing_phone') return res.end('null');
  res.statusCode = 404;
  res.end('{}');
});
api.listen(saved?.apiPort ?? 0, '127.0.0.1');
await once(api, 'listening');
const probe = createServer();
probe.listen(0, '127.0.0.1');
await once(probe, 'listening');
const port = saved?.port ?? probe.address().port;
await new Promise(resolve => probe.close(resolve));
const origin = `http://localhost:${port}`;
const env = {
  ...process.env, NEXT_TELEMETRY_DISABLED: '1', NODE_ENV: 'production',
  NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${api.address().port}`,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'synthetic-url-routing', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-url-routing',
  NEXT_PUBLIC_CONSTRUCTOR_LANDING_BASE_URL: origin,
  NEXT_PUBLIC_PROMOTIONS_PUBLIC_BASE_URL: 'https://promotions.example',
};
const next = (...args) => spawn(process.execPath, ['node_modules/next/dist/bin/next', ...args], {
  cwd, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
});
let server;
let serverLog = '';
try {
  if (!saved) {
    const build = next('build');
    build.stdout.on('data', data => process.stdout.write(data));
    build.stderr.on('data', data => process.stderr.write(data));
    const [code] = await once(build, 'exit');
    assert.equal(code, 0, 'production build');
    await writeFile(fixtureStatePath, JSON.stringify({ port, apiPort: api.address().port }));
  }

  server = next('start', '--hostname', 'localhost', '--port', String(port));
  let ready = false;
  server.stdout.on('data', data => {
    serverLog = (serverLog + data).slice(-4000);
    if (String(data).includes('Ready in')) ready = true;
  });
  server.stderr.on('data', data => { serverLog = (serverLog + data).slice(-4000); });
  for (let i = 0; i < 120 && !ready; i++) {
    assert.equal(server.exitCode, null, serverLog);
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.ok(ready, serverLog);

  const get = path => fetch(origin + path, {
    redirect: 'manual', signal: AbortSignal.timeout(30000),
  });
  // Node fetch ignores a custom Host header; HTTP is needed to test host routing.
  const statusWithHost = path => new Promise((resolve, reject) => {
    const req = httpRequest(origin + path, {
      headers: { host: 'promotions.example' }, signal: AbortSignal.timeout(30000),
    }, response => { response.resume(); resolve(response.statusCode); });
    req.on('error', reject);
    req.end();
  });
  const cases = [
    ['/l/url-test-a', 'url-test-a'],
    ['/?landing=url-test-b', 'url-test-b'],
    ['/l?landing=url-test-a', 'url-test-a'],
    ['/l/url-test-a?landing=url-test-b&campana=October&conjunto=A&anuncio=B&fbclid=synthetic', 'url-test-b'],
    ['/l/url-test-b?landing=url-test-a', 'url-test-a'],
    ['/l/url-test-a', 'url-test-a'],
    ['/?landing=url-test-a', 'url-test-a'],
    ['/?landing=url-test-b', 'url-test-b'],
    ['/l/url-test-a?landing=', 'url-test-a'],
    ...providers.map(provider => [`/l/url-test-a?landing=url-test-${provider}`, `url-test-${provider}`]),
  ];
  for (const [path, expected] of cases) {
    const response = await get(path);
    assert.equal(response.status, 200, `${path}: ${serverLog}`);
    assert.equal(response.headers.get('location'), null, path);
    assert.match(response.headers.get('cache-control') || '', /s-maxage=15/, path);
    const html = await response.text();
    assert.ok(html.includes(`"slug":"${expected}"`), `runtime slug: ${path}`);
    assert.ok(html.includes(`rel="canonical" href="${origin}/l/${expected}"`), `canonical: ${path}`);
    if (expected.startsWith('url-test-') && providers.some(provider => expected.endsWith(provider))) {
      const provider = expected.slice('url-test-'.length);
      assert.ok(html.includes(`"targetProvider":"${provider}"`), path);
      assert.ok(html.includes('data-template7-name'), path);
    }
    console.log(`PASS ${path} -> ${expected}`);
  }
  for (const path of ['/?landing=missing', '/l/url-test-a?landing=missing', '/?landing=../api', '/?landing=a&landing=b']) {
    assert.equal((await get(path)).status, 404, path);
  }
  const root = await get('/');
  assert.equal(root.status, 307);
  assert.equal(new URL(root.headers.get('location'), origin).pathname, '/login');
  assert.equal((await get('/login?landing=url-test-a')).status, 200);
  assert.equal(await statusWithHost('/?landing=url-test-a'), 404);
  assert.equal(await statusWithHost('/l/missing.png?landing=url-test-a'), 404);
  console.log('PASS production routing, cache isolation, all four Template 7 providers, missing/invalid selection and panel/promotions boundaries');
} finally {
  if (server && server.exitCode === null) {
    server.kill();
    await once(server, 'exit');
  }
  api.closeAllConnections();
  await new Promise(resolve => api.close(resolve));
}
