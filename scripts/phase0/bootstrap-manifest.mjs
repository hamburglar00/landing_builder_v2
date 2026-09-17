import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { root } from './local-runtime.mjs';
import { checkFutureOrder } from './check-future-migrations.mjs';

// Deliberate approval seal. Changing legacy exceptions requires review of this seal too.
export const APPROVED_MANIFEST_SHA256 = "76ad2e803e3c9f94b7e2141b900f08a4ac96883d08c887f7632963325aa1bf22";
export const hash = value => createHash('sha256').update(value).digest('hex');
export function assertFreshProject(project,existingNames) {
  if(!/^phase0b-[a-f0-9]{8}$/.test(project) || existingNames.some(n=>n.endsWith(project)||n===project+'-isolated'))throw Error('Generated project collides with an existing resource');
}
export function validateManifest(base = root) {
  const bytes = readFileSync(join(base, 'supabase/bootstrap/legacy-manifest.json'));
  const incremental=JSON.parse(readFileSync(join(base,'supabase/bootstrap/incremental-manifest.json'),'utf8'));
  const directory=join(base,'supabase/migrations');
  const sources=new Map(readdirSync(directory).filter(f=>f.endsWith('.sql')).map(f=>[f,readFileSync(join(directory,f))]));
  return validateSnapshot(bytes,sources,incremental);
}
export function validateSnapshot(bytes,sourceBytes,incremental={legacyCutoff:'20260915190657',entries:[]}) {
  if (hash(bytes) !== APPROVED_MANIFEST_SHA256) throw Error('Unapproved legacy manifest modification');
  const manifest = JSON.parse(bytes);
  const files = [...sourceBytes.keys()].sort();
  if(incremental.legacyCutoff!==manifest.legacyCutoff || !Array.isArray(incremental.entries))throw Error('Invalid incremental registration');
  let lastVersion=manifest.legacyCutoff;
  for(const e of incremental.entries){if(!/^\d{14}$/.test(e.version)||e.version<=lastVersion)throw Error('Future migrations must use strict chronological order after the cutoff');lastVersion=e.version;}
  const entries=[...manifest.entries,...incremental.entries.map((e,i)=>({...e,executionOrder:269+i,transaction:true,dependencies:[]}))];
  if (manifest.entries.length !== 268 || files.length !== entries.length) throw Error('Missing or unregistered migration; legacy set is frozen');
  const seen = new Set();
  const sources = new Map();
  for (const [i, entry] of entries.entries()) {
    if (!/^\d+_[a-zA-Z0-9_]+\.sql$/.test(entry.file) || entry.file.split('_')[0] !== entry.version || seen.has(entry.version)) throw Error('Invalid or duplicate migration identity');
    if (entry.executionOrder !== i + 1 || !entry.transaction) throw Error('Invalid execution contract');
    if (!files.includes(entry.file)) throw Error('Migration file missing');
    for (const dep of entry.dependencies) if (!seen.has(dep.version)) throw Error('Dependency order violation');
    const source = sourceBytes.get(entry.file);
    if (hash(source) !== entry.sha256) throw Error(`Migration hash mismatch: ${entry.version}`);
    // A file may not escape the runner transaction or execute psql shell commands.
    const clean = source.toString('utf8').replace(/--[^\n]*/g, '');
    if (/^\s*\\/m.test(clean) || /^\s*(?:commit|rollback|begin\s*;|start\s+transaction|vacuum|alter\s+system)\b/im.test(clean) || /\bcreate\s+(?:unique\s+)?index\s+concurrently\b/i.test(clean)) throw Error(`Unsupported transaction/psql operation: ${entry.version}`);
    seen.add(entry.version); sources.set(entry.file, source.toString('utf8'));
  }
  if (files.some(f => !entries.some(e => e.file === f))) throw Error('Unregistered migration');
  const violations=checkFutureOrder(sources,manifest.legacyCutoff);
  if(violations.length)throw Error('Future migration dependency is forward or unresolvable: '+violations[0].file);
  return { manifest, entries, sources };
}

export function assertSafeEnvironment(env = process.env, args = process.argv.slice(2)) {
  if (args.length) throw Error('Bootstrap accepts no target arguments or URL overrides');
  const forbidden = Object.keys(env).filter(k => /^(?:DOCKER_HOST|DOCKER_CONTEXT|DOCKER_TLS|SUPABASE_|NEXT_PUBLIC_SUPABASE_|PG[A-Z_]+|DATABASE_|DB_|POSTGRES_|PHASE0_)/i.test(k) && env[k]);
  if (forbidden.length) throw Error('Ambiguous database/environment overrides are forbidden; unset target variables');
}
