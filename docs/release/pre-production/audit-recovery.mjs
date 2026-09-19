// Read-only documentary recovery audit. Run from the repository root.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { hasPersonalPath } from '../../../scripts/security/artifact-paths.mjs';
import { validateManifest } from '../../../scripts/phase0/bootstrap-manifest.mjs';

const directory = 'docs/release/pre-production';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const git = (...args) => execFileSync('git', args, {
  encoding: 'utf8', env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
}).trim();
const read = name => JSON.parse(fs.readFileSync(`${directory}/${name}`, 'utf8'));
const review = read('review.json');
const recovery = read('recovery.json');
const evidence = read('recovered-evidence.json');
const rehearsal = read('rollout-rehearsal.json');
const findings = [];
const counts = { documents: 0, json: 0, markdownReferences: 0, repositoryReferences: 0, hashes: 0 };
const patterns = [
  ['mojibake', /\u00c3.|\u00c2.|\u00e2[\u0080-\u00bf]|\u00ef\u00bf\u00bd/],
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['JWT', /\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}\b/],
  ['provider-token', /\b(?:gh[pousr]_[A-Za-z0-9]{25,}|github_pat_[A-Za-z0-9_]{30,}|sbp_[A-Za-z0-9]{25,}|sk-(?:proj-)?[A-Za-z0-9_-]{25,}|xox[baprs]-[A-Za-z0-9-]{15,})\b/],
  ['credential-url', /[a-z]+:\/\/[^/\s:@]+:[^/\s@]+@/i],
  ['personal-email', /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/],
  ['personal-phone', /(?<![\w])\+[1-9][0-9 ()-]{9,18}[0-9](?![\w])/],
];
function auditText(text, label) {
  assert(!text.includes('\ufffd'), `Invalid UTF-8: ${label}`);
  // The user explicitly requested this exact external path in recovery records.
  // Keep the personal-path guard for all other files and all unrelated paths.
  let pathAuditText = text;
  if ([`${directory}/recovery.json`, `${directory}/recovery.md`].includes(label)) {
    const allowed = recovery.temporaryRecovery.absoluteDirectory;
    assert(path.win32.isAbsolute(allowed));
    for (const spelling of [allowed, JSON.stringify(allowed).slice(1, -1), allowed.replaceAll('\\', '/')]) {
      pathAuditText = pathAuditText.replaceAll(spelling, '<authorized-external-temporary>');
    }
  }
  if (hasPersonalPath(pathAuditText)) findings.push({ file: label, category: 'personal-path' });
  for (const [category, pattern] of patterns) {
    if (pattern.test(text)) findings.push({ file: label, category });
  }
}
function references(value) {
  if (typeof value === 'string' && /^(?:docs|scripts|frontend|supabase)\/[^\s{}*]+\.(?:md|json|tsx?|mjs|sql)$/.test(value)) {
    assert(fs.existsSync(value), `Missing repository reference: ${value}`);
    counts.repositoryReferences++;
  } else if (Array.isArray(value)) value.forEach(references);
  else if (value && typeof value === 'object') Object.values(value).forEach(references);
}
function checkHash(bytes, expected, label) {
  assert.equal(hash(bytes), expected, `Hash mismatch: ${label}`);
  counts.hashes++;
}
const names = fs.readdirSync(directory).filter(name => fs.statSync(`${directory}/${name}`).isFile()).sort();
for (const name of names) {
  const file = `${directory}/${name}`;
  const text = fs.readFileSync(file, 'utf8');
  auditText(text, file);
  assert(!text.split(/\r?\n/).some(line => /[ \t]+$/.test(line)), `Trailing whitespace: ${file}`);
  assert(text.endsWith('\n') && !/\n\s*\n$/.test(text), `Final newline: ${file}`);
  counts.documents++;
  if (name.endsWith('.json')) { references(JSON.parse(text)); counts.json++; }
  if (name.endsWith('.md')) for (const match of text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const target = match[1].replace(/^<|>$/g, '').split('#')[0];
    if (!target || /^(https?:|#)/.test(target)) continue;
    assert(fs.existsSync(path.resolve(directory, target)), `Missing Markdown target: ${file} ${target}`);
    counts.markdownReferences++;
  }
}
for (const entry of [...evidence.originalDocuments, ...evidence.reports, ...evidence.harnesses]) {
  checkHash(entry.content, entry.sha256, entry.name);
  auditText(entry.content, `preserved:${entry.name}`);
  if (entry.name.endsWith('.json')) JSON.parse(entry.content);
}
assert.deepEqual(findings, [], 'Document audit findings');
for (const entry of review.inventory.files) {
  if (entry.sha256) checkHash(fs.readFileSync(entry.file), entry.sha256, entry.file);
}
checkHash(fs.readFileSync(review.previousApplicationInventory.file), review.previousApplicationInventory.sha256, 'retained inventory');
for (const entry of review.evidenceReuse.reports) {
  const bytes = fs.readFileSync(entry.file);
  assert([hash(bytes), hash(bytes.toString('utf8').replace(/\r\n/g, '\n'))].includes(entry.sha256), entry.file);
  counts.hashes++;
}
for (const entry of rehearsal.modules) checkHash(fs.readFileSync(entry.file), entry.sha256, entry.file);
const edge = read('edge-functions.json');
for (const entry of [...edge.functions.map(item => item.local), edge.sharedSource]) {
  checkHash(fs.readFileSync(entry.file), entry.sha256, entry.file);
  assert.equal(git('rev-parse', `${review.applicationCandidate}:${entry.file}`), entry.gitBlob);
}
const manifest = validateManifest();
assert.equal(manifest.entries.length, 274);
checkHash(manifest.entries.map(entry => `${entry.file}:${entry.sha256}`).join('\n'), review.integrity.migrationSeal, '274-migration seal');
const inventory = read('release-inventory.json');
const inventoryDiff = git('diff', '--name-status', inventory.baseline, inventory.target).split(/\r?\n/).sort();
assert.deepEqual(inventoryDiff, inventory.files.map(entry => `${entry.status}\t${entry.file}`).sort());
// Never read the removed historical .env blob.
const entries = inventory.files.filter(entry => entry.status !== 'D');
const blobs = execFileSync('git', ['cat-file', '--batch'], {
  input: entries.map(entry => entry.headBlob).join('\n') + '\n', maxBuffer: 128 * 1024 * 1024,
});
let offset = 0;
for (const entry of entries) {
  const end = blobs.indexOf(10, offset);
  const [oid, type, size] = blobs.subarray(offset, end).toString('utf8').split(' ');
  assert.equal(type, 'blob'); assert.equal(oid, entry.headBlob);
  const bytes = blobs.subarray(end + 1, end + 1 + Number(size));
  checkHash(bytes, entry.headBlobSha256, entry.file);
  const current = fs.readFileSync(entry.file);
  checkHash(current, entry.worktreeSha256, entry.file);
  assert.equal(hash(current.toString('utf8').replace(/\r\n/g, '\n')), hash(bytes), entry.file);
  offset = end + Number(size) + 2;
}
const report = name => JSON.parse(evidence.reports.find(entry => entry.name === name).content);
const candidate = read('candidate.json');
const rollback = read('rollback-artifact.json');
for (const [label, doc] of [['candidate', candidate], ['baseline', rollback.deployedBaseline], ['compatible', rollback.compatibleFallback]]) {
  for (const [key, value] of Object.entries(report(`${label}-artifact.json`))) assert.deepEqual(doc[key], value, `${label}:${key}`);
  assert.deepEqual(doc.http, report(`${label}-http.json`));
  const archive = execFileSync('git', ['archive', '--format=tar', doc.commit, 'frontend', 'scripts', 'supabase/functions'], { maxBuffer: 12 * 1024 * 1024 });
  checkHash(archive, doc.archiveSha256, `${label} archive`);
  assert(doc.complete && doc.commands.every(command => command.exitCode === 0));
}
assert(candidate.commands.some(command => command.name === 'tests' && command.passed === 57 && command.failed === 0));
const initial = evidence.reports.find(entry => entry.name === 'rehearsal-report.json');
const continuation = evidence.reports.find(entry => entry.name === 'inbox-continuation.json');
checkHash(initial.content, rehearsal.harnessIncident.initialRawReportSha256, 'original rehearsal');
checkHash(continuation.content, rehearsal.harnessIncident.continuationRawReportSha256, 'resolved continuation');
assert.deepEqual(report(initial.name).checks, rehearsal.checks.transitionAndSecurity);
assert.equal(report(initial.name).migrations.length, 274);
assert(report(initial.name).migrations.every(entry => entry.passed));
assert.equal(report(initial.name).failures.length, 1);
assert(report(continuation.name).complete && report(continuation.name).failures.length === 0);
assert.deepEqual(report(continuation.name).inbox.checks, rehearsal.checks.inbox);
assert(rehearsal.complete && rehearsal.checks.totalRecords === 228);
const classic = read('classic-receiver.json');
assert.deepEqual(report('classic-test-report.json'), classic.compatibility.localValidation);
for (const entry of rehearsal.temporaryHarnessHashes) {
  assert.equal(evidence.harnesses.find(item => item.name === entry.name).originalSha256, entry.sha256);
}
assert.equal(git('branch', '--show-current'), 'main');
assert.equal(git('ls-files', '-u'), '');
assert.equal(git('diff', review.applicationCandidate, '--name-only', '--', '.', `:(exclude)${directory}/**`), '');
const changes = [...new Set([
  ...git('diff', review.applicationCandidate, '--name-only').split(/\r?\n/),
  ...git('ls-files', '--others', '--exclude-standard').split(/\r?\n/),
].filter(Boolean))].sort();
assert.deepEqual(changes, review.inventory.files.map(entry => entry.file).sort());
assert(changes.every(file => file.startsWith(`${directory}/`)));
assert.equal(names.length, review.inventory.completeDirectoryFiles);
assert.equal(changes.length, review.inventory.count);
const staged = git('diff', '--cached', '--name-only').split(/\r?\n/).filter(Boolean).sort();
if (staged.length) assert.deepEqual(staged, changes, 'Stage exactly the documentary inventory');
for (const file of changes) assert(!/\.(?:tar|gz|zip|log)$|(?:^|\/)(?:node_modules|\.next|release-prereq-bRshc8)(?:\/|$)/.test(file));
const tracked = git('ls-files').split(/\r?\n/);
assert(!tracked.some(file => /release-prereq-bRshc8|(?:candidate|baseline|compatible)\.tar|supabase-linux\.tar\.gz/.test(file)));
const env = fs.statSync('.env');
assert.equal(env.size, review.environmentFile.bytes);
assert.equal(env.mtime.toISOString(), review.environmentFile.modifiedAt);
assert.equal(git('ls-files', '--', '.env'), '');
assert.equal(git('check-ignore', '--', '.env'), '.env');
// Validate the retained audit record, without reading or requiring external files.
// Their removal in Explorer must not invalidate this documentary evidence.
const exception = recovery.cleanupException;
assert.equal(exception.authorizedByUser, true);
assert.equal(exception.blocksCheckpoint, false);
assert.equal(exception.deletionAttemptsAfterAuthorization, 0);
assert.equal(exception.permissionChanges, 0);
assert.equal(exception.policyBypassAttempts, 0);
assert.equal(review.localPreparationComplete, true);
assert.equal(review.cleanup.ownTempDirectoryRemovalRequiredBeforeCommit, false);
assert.equal(recovery.temporaryRecovery.files.length, 44);
assert.equal(recovery.temporaryRecovery.files.reduce((sum, entry) => sum + entry.bytes, 0), 46106759);
const externalDirectory = path.win32.normalize(recovery.temporaryRecovery.absoluteDirectory);
assert.equal(path.win32.basename(externalDirectory), recovery.temporaryRecovery.directoryName);
assert(!externalDirectory.toLowerCase().startsWith(path.resolve('.').toLowerCase() + path.sep));
for (const entry of recovery.temporaryRecovery.files) {
  assert.equal(entry.absolutePath, path.win32.join(externalDirectory, entry.name));
  assert(!entry.name.split('/').includes('..'));
  assert(!review.inventory.files.some(file => file.file === entry.absolutePath));
}
git('diff', '--check'); git('diff', '--cached', '--check');
const head = git('rev-parse', 'HEAD');
if (head !== review.applicationCandidate) {
  assert.equal(git('rev-parse', 'HEAD^'), review.applicationCandidate);
  assert.equal(git('log', '-1', '--format=%s'), review.checkpoint.message);
  assert.equal(git('status', '--porcelain'), '');
}
console.log(JSON.stringify({ complete: true, ...counts, migrationCount: 274, inventoryEntries: 324,
  preservedReports: evidence.reports.length, preservedHarnesses: evidence.harnesses.length,
  findings, productChanges: 0, envIgnoredAndUntracked: true,
  externalTemporaryFilesDocumented: 44, externalTemporaryReads: 0, cleanupExceptionAccepted: true,
  gitDiffChecksPassed: true, checkpointPresent: head !== review.applicationCandidate }));
