import {validateManifest, assertSafeEnvironment} from '../phase0/bootstrap-manifest.mjs';
import {createBootstrapDatabase} from '../phase0/bootstrap-runtime.mjs';
import {compatibilitySources, applyCompatibility} from '../phase0/bootstrap-compatibility.mjs';
import {alignNativePgNet} from '../phase0/bootstrap-net.mjs';

// Replays the registered schema in an isolated local Supabase PostgreSQL
// container. No application rows, remote endpoint, or persisted report.
assertSafeEnvironment();
const {entries, sources} = validateManifest();
const compatibility = compatibilitySources();
const db = await createBootstrapDatabase();
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
        ${sources.get(entry.file)}
        insert into supabase_migrations.schema_migrations(version,name)
        values ('${entry.version}','${entry.file.slice(entry.version.length + 1, -4)}');
        commit;`);
    } catch (error) {
      throw new Error(`Local migration ${entry.version} failed (${error.sqlstate ?? 'unknown SQLSTATE'})`);
    }
    if ((index + 1) % 50 === 0) console.log(`Local replay: ${index + 1}/${entries.length}`);
  }
  const ledger = Number(db.sql('select count(*) from supabase_migrations.schema_migrations').trim());
  if (ledger !== entries.length) throw new Error('Local ledger count mismatch');
  const quota = db.sql(`select count(*) from pg_proc
    where oid='private.select_landing_weighted_quota_phone(uuid,text,text,boolean)'::regprocedure`).trim();
  if (quota !== '1') throw new Error('Quota function absent after replay');
  console.log(`PASS: ${ledger} local migrations, quota function present, cron disabled`);
} finally {
  db.close();
}
