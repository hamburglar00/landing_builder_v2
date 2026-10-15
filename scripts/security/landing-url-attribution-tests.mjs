import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { root } from '../phase0/local-runtime.mjs';
import { APPROVED_MANIFEST_SHA256, hash, assertSafeEnvironment } from '../phase0/bootstrap-manifest.mjs';
import { createBootstrapDatabase } from '../phase0/bootstrap-runtime.mjs';
import { compatibilitySources, applyCompatibility } from '../phase0/bootstrap-compatibility.mjs';
import { alignNativePgNet } from '../phase0/bootstrap-net.mjs';
import { createDiagnosticTrace } from './bootstrap-diagnostic-trace.mjs';

// Full history in a disposable local DB. Retain the sealed legacy manifest;
// register newer working-tree migrations in memory for this test only.
assertSafeEnvironment();
const directory = join(root, 'supabase/migrations');
const sources = new Map(readdirSync(directory).filter(f => f.endsWith('.sql')).sort().map(f => [f, readFileSync(join(directory, f))]));
const legacyBytes = readFileSync(join(root, 'supabase/bootstrap/legacy-manifest.json'));
const legacy = JSON.parse(legacyBytes);
const incremental = JSON.parse(readFileSync(join(root, 'supabase/bootstrap/incremental-manifest.json'), 'utf8'));
const known = new Set([...legacy.entries, ...incremental.entries].map(e => e.file));
for (const [file, bytes] of sources) {
  if (!known.has(file)) incremental.entries.push({ file, version: file.split('_')[0], sha256: hash(bytes) });
}
assert.equal(hash(legacyBytes), APPROVED_MANIFEST_SHA256);
const entries = [...legacy.entries, ...incremental.entries];
assert.equal(entries.length, sources.size);
for (const entry of entries) assert.equal(hash(sources.get(entry.file)), entry.sha256, entry.file);
const compatibility = compatibilitySources();
const diagnostics = createDiagnosticTrace(root, () => {});
let db;
try { db = await createBootstrapDatabase({ diagnostics }); }
catch (error) { console.error(JSON.stringify(error.diagnostic ?? { error: error.message })); throw error; }
try {
  alignNativePgNet(db);
  db.sql(`create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations(
      version text primary key, statements text[], name text);`);
  for (const [index, entry] of entries.entries()) {
    if (index === 268) applyCompatibility(db, compatibility);
    try {
      db.sql(`begin; set local statement_timeout='45s'; set local lock_timeout='5s';
        set local phase0.tracking_retry_url='http://127.0.0.1:1/disabled';
        set local phase0.tracking_retry_token='synthetic-local';
        ${sources.get(entry.file).toString('utf8')}
        insert into supabase_migrations.schema_migrations(version,name)
        values ('${entry.version}','${entry.file.slice(entry.version.length + 1, -4)}'); commit;`);
    } catch (error) { throw new Error(`Migration ${entry.version}: ${error.message}`); }
    if ((index + 1) % 50 === 0) console.log(`Local replay ${index + 1}/${entries.length}`);
  }
  console.log(`PASS: ${entries.length} migrations replayed`);
  const sql = readFileSync(join(root, 'scripts/security/landing-url-attribution-fixture.sql'), 'utf8');
  const result = db.sql(sql).trim();
  assert.match(result, /ATTRIBUTION_TESTS_OK/);
  console.log('PASS: scoped random fallback, availability, attribution storage, report/search/export and permissions');
} finally { db.close(); }
