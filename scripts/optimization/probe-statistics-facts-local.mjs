// Disposable local feasibility probe. Never connects to a hosted database.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { root } from '../phase0/local-runtime.mjs';
import { assertSafeEnvironment, validateSnapshot } from '../phase0/bootstrap-manifest.mjs';
import { createBootstrapDatabase } from '../phase0/bootstrap-runtime.mjs';
import { compatibilitySources, applyCompatibility } from '../phase0/bootstrap-compatibility.mjs';
import { alignNativePgNet } from '../phase0/bootstrap-net.mjs';

assertSafeEnvironment();
const tracked = path => {
  const result = spawnSync('git', ['show', `HEAD:${path}`], {
    cwd: root, encoding: null, windowsHide: true, maxBuffer: 4 * 1024 * 1024,
  });
  assert.equal(result.status, 0, `Cannot read ${path}`);
  return result.stdout;
};
const legacy = readFileSync(join(root, 'supabase/bootstrap/legacy-manifest.json'));
const incremental = JSON.parse(readFileSync(join(root, 'supabase/bootstrap/incremental-manifest.json'), 'utf8'));
const files = [...JSON.parse(legacy).entries, ...incremental.entries].map(entry => entry.file);
const sources = new Map(files.map(file => [file, tracked(`supabase/migrations/${file}`)]));
const manifest = validateSnapshot(legacy, sources, incremental);
assert.equal(manifest.entries.length, 280);
const original = sources.get('20260921181600_optimize_conversion_stats_latency.sql').toString('utf8');
const native = original.match(/CREATE OR REPLACE FUNCTION conversions_read\.stats_native\(p_request jsonb\)[\s\S]*?(?=REVOKE ALL ON FUNCTION conversions_read\.stats_native)/)?.[0];
assert(native, 'Native model missing');
const projection = native.match(/WITH source AS MATERIALIZED \( SELECT row_number\(\) OVER\(ORDER BY c\.created_at DESC,c\.id\) ord,([\s\S]*?)\n FROM public\.conversions c WHERE/)?.[1];
assert(projection, 'Native source projection missing');
assert.equal(native.match(/FROM public\.conversions c/g)?.length, 1);
const factNative = native
  .replace('conversions_read.stats_native(p_request jsonb)', 'statistics_probe.stats_native_fact(p_request jsonb)')
  .replace('FROM public.conversions c', 'FROM statistics_probe.conversion_facts c');
let db;
try {
  db = await createBootstrapDatabase();
  alignNativePgNet(db);
  db.sql('CREATE SCHEMA IF NOT EXISTS supabase_migrations; CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations(version text PRIMARY KEY,statements text[],name text);');
  for (const [index, entry] of manifest.entries.entries()) {
    if (index === 268) applyCompatibility(db, compatibilitySources());
    db.sql(`BEGIN; SET LOCAL statement_timeout='45s'; SET LOCAL lock_timeout='5s'; SET LOCAL phase0.tracking_retry_url='http://127.0.0.1:1/stats-disabled'; SET LOCAL phase0.tracking_retry_token='synthetic-local'; ${manifest.sources.get(entry.file)} INSERT INTO supabase_migrations.schema_migrations(version,name) VALUES('${entry.version}','${entry.file.slice(entry.version.length + 1, -4)}'); COMMIT;`);
    if ((index + 1) % 50 === 0 || index === 279) console.log(`LOCAL_REPLAY ${index + 1}/280`);
  }
  db.sql(`CREATE SCHEMA statistics_probe;
    CREATE TABLE statistics_probe.conversion_facts AS SELECT ${projection} FROM public.conversions c WITH NO DATA;
    ALTER TABLE statistics_probe.conversion_facts ADD PRIMARY KEY (id);
    ALTER TABLE statistics_probe.conversion_facts ENABLE ROW LEVEL SECURITY;
    CREATE POLICY facts_read ON statistics_probe.conversion_facts FOR SELECT TO authenticated
      USING (user_id=(SELECT auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.role='admin'));
    GRANT USAGE ON SCHEMA statistics_probe TO authenticated;
    GRANT SELECT ON statistics_probe.conversion_facts TO authenticated;
    ${factNative}
    REVOKE ALL ON FUNCTION statistics_probe.stats_native_fact(jsonb) FROM public,anon;
    GRANT EXECUTE ON FUNCTION statistics_probe.stats_native_fact(jsonb) TO authenticated;`);
  db.sql(`INSERT INTO auth.users(id,raw_app_meta_data) VALUES
    ('00000000-0000-4000-8000-000000000001','{"panelbot_admin_created":true}'::jsonb),
    ('00000000-0000-4000-8000-000000000002','{"panelbot_admin_created":true}'::jsonb);
    UPDATE public.profiles SET role='admin' WHERE id='00000000-0000-4000-8000-000000000001';
    INSERT INTO public.conversions(user_id,created_at,currency,estado,valor,phone,external_id,
      contact_event_id,lead_event_id,purchase_event_id,purchase_type,utm_campaign,device_type,geo_region,test_event_code)
    SELECT CASE WHEN g%5=0 THEN '00000000-0000-4000-8000-000000000002'::uuid ELSE '00000000-0000-4000-8000-000000000001'::uuid END,
      '2026-09-30 03:00:00+00'::timestamptz - (g%90)*interval '1 day' + (g%24)*interval '1 hour',
      'ARS',CASE WHEN g%4=0 THEN 'purchase' WHEN g%3=0 THEN 'lead' ELSE 'contact' END,
      CASE WHEN g%4=0 THEN g*10 ELSE 0 END,'synthetic-'||(g%370),'synthetic-'||(g%370),
      CASE WHEN g%2=0 THEN 'synthetic-contact-'||g ELSE '' END,
      CASE WHEN g%3=0 THEN 'synthetic-lead-'||g ELSE '' END,
      CASE WHEN g%4=0 THEN 'synthetic-purchase-'||g ELSE '' END,
      CASE WHEN g%4=0 THEN 'first' ELSE null END,'synthetic-campaign-'||(g%20),
      'desktop','Buenos Aires','' FROM generate_series(1,280000) g;
    ANALYZE public.conversions;`);
  console.log('SYNTHETIC_CONVERSIONS 280000');
  db.sql(`INSERT INTO statistics_probe.conversion_facts SELECT ${projection} FROM public.conversions c;
    CREATE INDEX facts_currency_date_idx ON statistics_probe.conversion_facts(currency,created_at);
    CREATE INDEX facts_user_currency_date_idx ON statistics_probe.conversion_facts(user_id,currency,created_at);
    ANALYZE statistics_probe.conversion_facts;`);
  const sizes = db.sql(`SELECT pg_size_pretty(pg_total_relation_size('public.conversions')) original,
    pg_size_pretty(pg_total_relation_size('statistics_probe.conversion_facts')) facts;`);
  console.log(`TABLE_SIZES ${sizes.trim()}`);
  const request = JSON.stringify({ admin: true, currency: 'ARS', from: null, to: null,
    timezone: 'America/Argentina/Buenos_Aires', premium: 50000, options: { topLimit: 100 } });
  const measure = (name, fn) => {
    const query = `BEGIN; SET LOCAL ROLE authenticated;
      SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
      SET LOCAL statement_timeout='60s';
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT ${fn}('${request}'::jsonb);
      ROLLBACK;`;
    try {
      const plan = JSON.parse(db.sql(query));
      const item = plan[0];
      console.log(JSON.stringify({ name, executionMs: item['Execution Time'],
        sharedHit: item.Plan['Shared Hit Blocks'], sharedRead: item.Plan['Shared Read Blocks'],
        tempRead: item.Plan['Temp Read Blocks'], tempWritten: item.Plan['Temp Written Blocks'] }));
      return true;
    } catch (error) {
      console.log(JSON.stringify({ name, failed: true, sqlstate: error.sqlstate ?? null,
        message: error.message?.slice(0, 150) }));
      return false;
    }
  };
  const factPassed = measure('facts_max_admin_ars', 'statistics_probe.stats_native_fact');
  if (factPassed) measure('original_max_admin_ars', 'conversions_read.stats_native');
} finally {
  if (db) console.log(JSON.stringify({ cleanup: db.close() }));
}
