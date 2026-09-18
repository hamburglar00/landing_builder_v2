// Scoped audit: no values are printed, including when a finding is detected.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {root} from '../phase0/local-runtime.mjs';
import {validateManifest} from '../phase0/bootstrap-manifest.mjs';
import {hasPersonalPath} from './artifact-paths.mjs';

const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const changed=[...new Set([...git('diff','--name-only').split('\n'),...git('ls-files','--others','--exclude-standard').split('\n')].filter(Boolean))].sort();
const expected=[
  'scripts/phase0/bootstrap-runtime.mjs','scripts/phase0/bootstrap-safety.test.mjs','supabase/bootstrap/incremental-manifest.json',
  'supabase/migrations/20260917183837_protect_profile_administrative_fields.sql',
  ...['profile-data-api.mjs','profile-auth-api.mjs','profile-metadata.sql','profile-security-tests.mjs','run-profile-security.mjs','run-profile-regressions.mjs','audit-profile-artifacts.mjs',
    'artifact-paths.mjs','bootstrap-diagnostic-trace.mjs','diagnostic-tools.test.mjs','run-profile-reconstruction-diagnostic.mjs',
    'profile-evidence.mjs','run-profile-repeat.mjs'].map(f=>'scripts/security/'+f),
  ...['README.md','consumers.json','remote-profile-metadata.json','local-profile-metadata.json','local-validation.json','review.json','audit.json',
    'auth-delete-diagnostic-audit.json','auth-delete-diagnostic.json','auth-delete-diagnostic.md','auth-delete-diagnostic.mjs','auth-delete-network-events.json','regression-validation.json',
    'reconstruction-diagnostic.json','reconstruction-diagnostic.md','validation-inputs.json','evidence-validation.json','profile-repeat-validation.json'].map(f=>'docs/security/phase-1b1/'+f),
].sort();
const findings=[];
if(git('branch','--show-current')!=='main'||git('rev-parse','HEAD')!=='ba7b3d3f5e60eb0c2cb907a8c281d4462e15d4bb')findings.push({kind:'unexpected base'});
if(git('diff','--cached','--name-only'))findings.push({kind:'unexpected staging'});
const auditPath='docs/security/phase-1b1/audit.json';
if(JSON.stringify(changed.filter(f=>f!==auditPath))!==JSON.stringify(expected.filter(f=>f!==auditPath)))findings.push({kind:'unexpected file inventory'});
const env={physicallyPresent:existsSync(join(root,'.env')),ignored:git('check-ignore','.env')==='.env',tracked:!!git('ls-files','.env')};
if(!env.physicallyPresent||!env.ignored||env.tracked)findings.push({kind:'env hygiene'});
const patterns=[
  ['literal JWT',/eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}/],
  ['private key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['credential pattern',/\b(?:sb_secret_|sb_publishable_|sk-proj-|ghp_|github_pat_|AKIA)[A-Za-z0-9_-]{12,}/],
  ['literal bearer',/Bearer[ \t]+[A-Za-z0-9._-]{24,}/i],
  ['production project address',/https:\/\/[a-z]{20}\.supabase\.co/],
];
const inventory=[];
for(const file of changed.filter(f=>f!==auditPath)) {
  const bytes=readFileSync(join(root,file));
  const source=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  if(file.endsWith('.json'))JSON.parse(source);
  source.split(/\r?\n/).forEach((line,n)=>{
    if(hasPersonalPath(line))findings.push({file,line:n+1,kind:'local personal path'});
    for(const [kind,re] of patterns)if(re.test(line))findings.push({file,line:n+1,kind});
    for(const match of line.matchAll(/[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g))if(!['example.invalid','example.com','invalid.test'].includes(match[1]))findings.push({file,line:n+1,kind:'non-synthetic email domain'});
    if(/[\t ]+$/.test(line))findings.push({file,line:n+1,kind:'trailing whitespace'});
  });
  inventory.push({file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
}
const validated=validateManifest();
git('diff','--check');
const report={scope:'All changed/new Phase 1B.1 artifacts; static credential, personal-path, email and UTF-8 checks plus manual synthetic-fixture review. Not a production data or full-history audit.',filesReviewed:inventory.length,findings,env,historicalMigrationsUnchanged:validated.entries.slice(0,268).length===268,registeredMigrations:validated.entries.length,inventory,auditSelf:'This generated report does not hash itself.'};
writeFileSync(join(root,auditPath),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({filesReviewed:report.filesReviewed,findings,env,migrations:validated.entries.length}));
if(findings.length)process.exitCode=1;
