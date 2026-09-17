// Reports locations/categories, never matching values. Manual fixture review is also required.
import { readdirSync,readFileSync,writeFileSync,existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { root } from './local-runtime.mjs';
const original=[
  ...['README.md','baseline.md','contracts.md','deployed-edge-manifest.json','production-statistics.json','rollback-and-phase-1.md'].map(f=>'docs/optimization/phase-0/'+f),
  ...['phase0AudiencePipeline.test.ts','phase0HomeContracts.test.ts','phase0LandingContracts.test.ts','phase0PhoneHandlers.test.ts'].map(f=>'frontend/tests/'+f),
  ...['audience-benchmark.ts','browser-observer.js','local-schema.sql','measure-audience.sql','production-statistics.sql','run-browser-benchmark.mjs','run-local-contracts.mjs'].map(f=>'scripts/phase0/'+f),
  ...['phase0_audience_boundaries.test.sql','phase0_purchase_claims.test.sql'].map(f=>'supabase/tests/'+f),
];
const files=[...new Set([...original,...['scripts/phase0','docs/optimization/phase-0','supabase/bootstrap'].flatMap(d=>existsSync(join(root,d))?readdirSync(join(root,d)).map(f=>d+'/'+f):[]),
  ...['20260427180000','20260427190000'].map(v=>'supabase/migrations/'+v+'_remote_sync_placeholder.sql'),
  'supabase/migrations/20260325201000_add_internal_id_to_conversions.sql','.gitignore','.env.example'])].filter(f=>!f.endsWith('/artifact-audit.json')).sort();
const findings=[];
const checks=[
  ['user-specific absolute path',/(?:[A-Z]:[\\/]Users[\\/][^\s"']+|\/Users\/[^\s"']+|\/home\/[^\s"']+)/i],
  ['literal JWT',/eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}/],
  ['private key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['live-style credential',/\b(?:sb_secret_|sb_publishable_|sk-proj-|ghp_|github_pat_|AKIA)[A-Za-z0-9_-]{12,}/],
  ['literal bearer credential',/Bearer[ \t]+[A-Za-z0-9._-]{24,}/i],
  ['external database or project address',/(?:postgres(?:ql)?:\/\/(?![^\s]*\$\{)[^\s"']+|https:\/\/[a-z]{20}\.supabase\.co)/],
];
const inventory=[];
for(const file of files){
  const content=readFileSync(join(root,file),'utf8');
  content.split(/\r?\n/).forEach((line,n)=>{for(const [kind,re] of checks)if(re.test(line))findings.push({file,line:n+1,kind});
    for(const match of line.matchAll(/[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g)){
      if(!['example.invalid','example.com','invalid.test'].includes(match[1]))findings.push({file,line:n+1,kind:'review email domain'});
    }
  });
  inventory.push({file,bytes:Buffer.byteLength(content),sha256:createHash('sha256').update(content).digest('hex')});
}
const missingOriginal=original.filter(f=>!existsSync(join(root,f)));
const report={originalCount:19,preservedOriginal:19-missingOriginal.length,missingOriginal,filesReviewed:files.length,findings,
  scope:'Static credential/path/email scan plus manual review of synthetic fixtures; hashes and queryids are metadata, not secrets. Ephemeral Docker passwords/JWTs are generated at runtime and never saved.',inventory};
writeFileSync(join(root,'docs/optimization/phase-0/artifact-audit.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({preservedOriginal:report.preservedOriginal,filesReviewed:report.filesReviewed,findings}));
if(missingOriginal.length||findings.length)process.exitCode=1;
