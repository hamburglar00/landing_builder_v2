// Scope and content audit without reading environment files or printing matched values.
import {readFileSync,writeFileSync,readdirSync,existsSync} from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {root} from '../phase0/local-runtime.mjs';
import {validateManifest} from '../phase0/bootstrap-manifest.mjs';
import {hasPersonalPath} from './artifact-paths.mjs';

const folder='docs/security/phase-1b2/',output=folder+'implementation-audit.json';
const review=JSON.parse(readFileSync(join(root,folder+'implementation-review.json')));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}).trim();
if(!existsSync(join(root,output)))writeFileSync(join(root,output),'{}\n');
const files=[...new Set([...git(['diff','--name-only','HEAD']).split('\n'),...git(['ls-files','--others','--exclude-standard']).split('\n')].filter(Boolean))].sort();
const allowed=new Set([
  'frontend/README.md','frontend/package.json','frontend/lib/settingsDb.ts','frontend/lib/landing/publishLanding.ts',
  'frontend/app/(panel)/admin/settings/page.tsx','frontend/app/(panel)/admin/tests/page.tsx',
  'frontend/app/(panel)/admin/landings/[id]/editar/page.tsx','frontend/app/(panel)/dashboard/landing/[id]/editar/page.tsx',
  'frontend/app/api/revalidate/route.ts','frontend/app/api/landings/revalidate/route.ts',
  ...['types.ts','client.ts','catalog.server.ts','service.server.ts','transport.server.ts','supabase.server.ts'].map(n=>'frontend/lib/revalidation/'+n),
  ...['revalidationClient.test.ts','revalidationSecurity.test.ts','revalidation-server-loader.mjs','revalidation-server-resolver.mjs'].map(n=>'frontend/tests/'+n),
  ...['settings-security-tests.mjs','run-settings-security.mjs','run-settings-validation.mjs','audit-settings-artifacts.mjs'].map(n=>'scripts/security/'+n),
  'supabase/bootstrap/incremental-manifest.json','supabase/migrations/'+review.migration.file,
  ...['README.md','audit.json','consumers.json','review.json','revalidation-contract-diagnostic.md','implementation.md','implementation-review.json','implementation-database-validation.json','implementation-validation.json','implementation-audit.json'].map(n=>folder+n),
]);
const findings=[];
const hashes=[];
for(const file of files) {
  if(!allowed.has(file)){findings.push({file,kind:'scope'});continue;}
  if(file===output)continue;
  const bytes=readFileSync(join(root,file)),text=bytes.toString('utf8');hashes.push({file,sha256:hash(bytes)});
  if(hasPersonalPath(text))findings.push({file,kind:'personal-path'});
  if(/(?:sb_secret_|sbp_)[A-Za-z0-9_-]{20,}|eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text))findings.push({file,kind:'credential-pattern'});
}
for(const expected of review.baseline.docs)if(hash(readFileSync(join(root,expected.file)))!==expected.sha256)findings.push({file:expected.file,kind:'protected-document-changed'});
const historical=readdirSync(join(root,'supabase/migrations')).filter(n=>n.endsWith('.sql')&&n!==review.migration.file).sort().map(file=>({file,sha256:hash(readFileSync(join(root,'supabase/migrations',file)))}));
if(historical.length!==269||hash(JSON.stringify(historical))!==review.baseline.migrationsSha256)findings.push({kind:'historical-migration-integrity'});
try{if(validateManifest().entries.length!==270)findings.push({kind:'migration-count'});}catch{findings.push({kind:'migration-manifest'});}
const env={present:existsSync(join(root,'.env')),ignored:spawnSync('git',['check-ignore','--quiet','--','.env'],{cwd:root,windowsHide:true}).status===0,tracked:!!git(['ls-files','--','.env'])};
if(!env.present||!env.ignored||env.tracked)findings.push({kind:'environment-file-protection'});
if(git(['diff','--cached','--name-only'])||git(['ls-files','--unmerged']))findings.push({kind:'staging-or-conflicts'});
if(git(['branch','--show-current'])!=='main'||git(['rev-parse','HEAD'])!==review.baseCommit)findings.push({kind:'base-changed'});
const report={phase:'1B.2',passed:findings.length===0,files,hashes,selfHashExcluded:true,protectedDocumentsUnchanged:!findings.some(f=>f.kind==='protected-document-changed'),historicalMigrations:historical.length,environmentFile:env,findings,remoteWrites:0};
writeFileSync(join(root,output),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,files:files.length,findings}));
if(!report.passed)process.exitCode=1;
