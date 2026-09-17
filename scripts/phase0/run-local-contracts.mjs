// Local-only contract database. Never accepts a database URL or production credentials.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHmac } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const suffix = randomUUID().slice(0, 8);
const network = `phase0-${suffix}`;
const db = `${network}-db`;
const api = `${network}-api`;
const password = randomUUID();
const secret = randomUUID() + randomUUID();
const run = (command, args, options = {}) => {
  const r = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, ...options });
  if (r.error || r.status !== 0) throw new Error(`${command} failed: ${r.error?.message ?? r.stderr ?? r.stdout}`);
  return r.stdout;
};
let database = 'postgres';
const sql = (text) => run('docker', ['exec', '-i', '-e', `PGPASSWORD=${password}`, db, 'psql', '-X', '-h', '127.0.0.1', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database, '-At'], { input: text });
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const delay = (ms) => new Promise(r => setTimeout(r, ms));
let networkCreated = false, dbCreated = false, apiCreated = false;
if (process.env.DOCKER_HOST || process.env.DOCKER_CONTEXT) throw new Error('Unset Docker endpoint overrides before local tests');
const endpoint = run('docker', ['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}']).trim();
if (!endpoint.startsWith('npipe:////./pipe/') && !endpoint.startsWith('unix:///')) throw new Error('Docker endpoint is not local');
try {
  run('docker', ['network', 'create', '--internal', network]); networkCreated = true;
  run('docker', ['run', '-d', '--name', db, '--network', network, '-e', `POSTGRES_PASSWORD=${password}`, 'public.ecr.aws/supabase/postgres:17.6.1.063']); dbCreated = true;
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try { sql('select 1'); ready = true; break; } catch { await delay(1000); }
  }
  if (!ready) throw new Error('Local Postgres did not become ready');
  sql('create database phase0 template template0');
  database = 'phase0';
  const identity = sql("select current_database() || '|' || host(inet_server_addr())").trim();
  if (identity !== 'phase0|127.0.0.1') throw new Error('Unexpected local database target');
  console.log('LOCAL TARGET VERIFIED: disposable Docker, internal database network, phase0 on 127.0.0.1 inside container');
  // Minimal dependency schema, not a full migration replay or a production schema clone.
  sql(read('scripts/phase0/local-schema.sql'));
  for (const name of [
    '20260728163000_purchase_event_atomic_claims.sql',
    '20260911175635_meta_audience_buyers_rpc.sql',
    '20260911180712_speed_up_meta_audience_buyers_rpc.sql',
    '20260911200034_meta_audience_buyers_v2.sql',
    '20260911201101_compact_meta_audience_buyers_v2_payload.sql',
    '20260911213912_meta_audience_configs.sql',
  ]) sql(read(`supabase/migrations/${name}`));
  for (const name of ['meta_audience_buyers.test.sql', 'meta_audience_buyers_v2.test.sql', 'meta_audience_configs.test.sql', 'phase0_audience_boundaries.test.sql', 'phase0_purchase_claims.test.sql']) {
    const output = sql(read(`supabase/tests/${name}`));
    const planned = Number(output.match(/^1\.\.(\d+)$/m)?.[1]);
    const passed = (output.match(/^ok \d+/gm) ?? []).length;
    if (!planned || planned !== passed || /^not ok|^Bail out!/m.test(output)) throw new Error(`${name}\n${output}`);
    console.log(`${name}: ${passed}/${planned} PASS`);
  }
  sql(`insert into auth.users(id) values ('13000000-0000-0000-0000-000000000001');
    insert into public.conversions(user_id,estado,currency,email,purchase_event_id,purchase_type,valor,created_at)
    select '13000000-0000-0000-0000-000000000001','purchase','ARS','synthetic-'||n||'@example.invalid','fixture-'||n,'first',n,'2026-01-01'::timestamptz from generate_series(1,1205) n;`);
  // Docker Desktop does not publish ports on an internal-only network. Only the API
  // gets a bridge interface; the database stays on the private, internal network.
  run('docker', ['create', '--name', api, '--network', 'bridge', '-p', '127.0.0.1::3000',
    '-e', `PGRST_DB_URI=postgres://postgres:${password}@${db}:5432/phase0`, '-e', 'PGRST_DB_SCHEMAS=public',
    '-e', 'PGRST_DB_ANON_ROLE=anon', '-e', 'PGRST_DB_MAX_ROWS=1000', '-e', `PGRST_JWT_SECRET=${secret}`,
    'public.ecr.aws/supabase/postgrest:v14.1']); apiCreated = true;
  run('docker', ['network', 'connect', network, api]);
  run('docker', ['start', api]);
  await delay(1500);
  let port;
  try { port = run('docker', ['port', api, '3000/tcp']).trim().split(':').at(-1); }
  catch {
    const logs = run('docker', ['logs', api]).replaceAll(password,'[local password]').replaceAll(secret,'[local JWT secret]');
    throw new Error(`Local API startup failed: ${logs}`);
  }
  const url = `http://127.0.0.1:${port}`;
  const b64 = (x) => Buffer.from(JSON.stringify(x)).toString('base64url');
  const unsigned = `${b64({alg:'HS256',typ:'JWT'})}.${b64({role:'authenticated',sub:'13000000-0000-0000-0000-000000000001',exp:Math.floor(Date.now()/1000)+3600})}`;
  const jwt = `${unsigned}.${createHmac('sha256',secret).update(unsigned).digest('base64url')}`;
  ready = false;
  for (let i = 0; i < 30; i++) {
    try { if ((await fetch(url)).ok) { ready = true; break; } } catch {}
    await delay(1000);
  }
  if (!ready) throw new Error('Local Data API did not become ready');
  // Direct Node invocation avoids Windows shell quoting and never prints JWTs.
  const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', 'tests/metaAudienceDataApi.integration.test.ts'], {
    cwd: resolve(root, 'frontend'), stdio: 'inherit',
    env: { ...process.env, META_AUDIENCE_DATA_API_TEST_URL: url, META_AUDIENCE_DATA_API_TEST_JWT: jwt },
  });
  if (result.status !== 0) throw new Error('Data API integration failed');
} finally {
  // Remove only containers created by this invocation; never touch existing stacks or volumes.
  if (apiCreated) spawnSync('docker', ['rm', '-f', '-v', api]);
  if (dbCreated) spawnSync('docker', ['rm', '-f', '-v', db]);
  if (networkCreated) spawnSync('docker', ['network', 'rm', network]);
}
