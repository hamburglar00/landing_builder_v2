// Bounded local-only CLI diagnosis. Raw debug output stays in memory (may contain keys).
import { spawn,spawnSync } from 'node:child_process';
import { mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID,createHash } from 'node:crypto';
import { command,root,read } from './local-runtime.mjs';
if(process.env.DOCKER_HOST||process.env.DOCKER_CONTEXT)throw Error('Docker override forbidden');
const endpoint=command('docker',['context','inspect','--format','{{.Endpoints.docker.Host}}']).trim();
if(!/^(npipe:\/\/\/\/\.\/pipe\/|unix:\/\/\/)/.test(endpoint))throw Error('Local Docker required');
let cli='supabase';
if(process.platform==='win32'){
 const shim=command('where.exe',['supabase']).trim().split(/\r?\n/)[0].replace(/\.exe$/,'.shim');
 if(existsSync(shim))cli=readFileSync(shim,'utf8').match(/path = "([^"]+)"/)?.[1]??cli;
}
const name=`phase0-diagnose-${randomUUID().slice(0,8)}`, dir=mkdtempSync(join(tmpdir(),'phase0-diagnose-'));
const core=process.argv.includes('--without-observability');
const databaseOnly=process.argv.includes('--database-only');
mkdirSync(join(dir,'supabase/migrations'),{recursive:true});
writeFileSync(join(dir,'supabase/config.toml'),`project_id = "${name}"\n[db]\nmajor_version = 17\nport = 55322\n[api]\nport = 55321\n[studio]\nport = 55323\n[inbucket]\nport = 55324\n[db.seed]\nenabled = false\n`);
const report={mode:databaseOnly?'migration-replay-database-only':core?'alternative-without-observability':'full-services',cli:command(cli,['--version']).trim(),docker:JSON.parse(command('docker',['info','--format','{"cpus":{{.NCPU}},"memoryBytes":{{.MemTotal}},"version":"{{.ServerVersion}}"}'])),
 localOnly:true,linked:false,seedEnabled:false,migrationCount:readdirSync(join(root,'supabase/migrations')).filter(f=>f.endsWith('.sql')).length,stages:[],snapshots:[],migrations:[]};
const started=Date.now();let lastProgress=started,output='',extended=false,timedOut=false,child;
const save=()=>writeFileSync(join(root,`docs/optimization/phase-0/local-start-${databaseOnly?'replay':core?'alternative':'diagnostic'}.json`),JSON.stringify(report,null,2)+'\n');
try{
 const env={...process.env,DO_NOT_TRACK:'1'};delete env.SUPABASE_ACCESS_TOKEN;delete env.SUPABASE_PROJECT_ID;delete env.SUPABASE_DB_PASSWORD;
 child=spawn(cli,['start','--debug','--workdir',dir,...(databaseOnly?['--exclude','gotrue,realtime,storage-api,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor']:core?['--exclude','logflare,vector']:[])],{cwd:dir,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
 const collect=d=>{
  const text=d.toString();output+=text;
  for(const [kind,re] of [['image-download',/Downloading|Pulling fs layer/],['image-extract',/Extracting|Pull complete/],['database-start',/Starting database/],['schema-bootstrap',/Initialising schema|Initializing schema/],['services-start',/Starting containers/],['healthy',/Started supabase local/]]){
   if(re.test(text)){lastProgress=Date.now();if(!report.stages.some(s=>s.kind===kind)){report.stages.push({kind,atMs:Date.now()-started});console.log(kind);}}
  }
 };
 child.stdout.on('data',collect);child.stderr.on('data',collect);
 const timer=setInterval(()=>{
  const elapsed=Date.now()-started;
  const names=command('docker',['ps','-a','--filter',`name=${name}`,'--format','{{.Names}}|{{.Status}}']).trim();
  report.snapshots.push({atMs:elapsed,containers:names.replaceAll(name,'[test-project]').split(/\r?\n/).filter(Boolean)});
  if(elapsed>=180000&&!extended&&Date.now()-lastProgress<45000){extended=true;console.log('Observed progress: extending once to 360 seconds');}
  if(elapsed>=(extended?360000:180000)){timedOut=true;child.kill();}
 },10000);
 const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve);});clearInterval(timer);
 report.bootstrap={exitCode:code,timedOut,extended,elapsedMs:Date.now()-started};
 save();
 // Whitelist diagnostic summaries; never persist connection strings/debug SQL/keys.
 report.errorCategories=['connection refused','context deadline exceeded','failed to pull','unhealthy','unknown field','invalid keys','address already in use'].filter(s=>output.toLowerCase().includes(s));
 report.debugTailCategories=output.split(/\r?\n/).filter(s=>/^(Starting |Initiali|Waiting |Stopped |failed to |Error response from daemon)/.test(s)).map(s=>s.replace(/https?:\/\/\S+/g,'[endpoint]').replaceAll(dir,'[temporary project]').replaceAll(name,'[test-project]')).slice(-10);
 if(code===0){
  const db=`supabase_db_${name}`, isolated=`${name}-isolated`;
  command('docker',['network','create','--internal',isolated]);
  try{
   command('docker',['network','connect',isolated,db]);
   const networks=Object.keys(JSON.parse(command('docker',['inspect',db]))[0].NetworkSettings.Networks);
   for(const network of networks)if(network!==isolated)command('docker',['network','disconnect',network,db]);
   const sql=q=>command('docker',['exec','-i',db,'psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-At'],{input:q});
   const containerEnv=JSON.parse(command('docker',['inspect',db]))[0].Config.Env;
   const localPassword=containerEnv.find(e=>e.startsWith('POSTGRES_PASSWORD='))?.slice('POSTGRES_PASSWORD='.length);
   if(!localPassword)throw Error('Local bootstrap password unavailable');
   command('docker',['exec','-i','-e',`PGPASSWORD=${localPassword}`,db,'psql','-X','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1','-At'],{input:"alter system set cron.launch_active_jobs=off; select pg_reload_conf();"});
   if(sql("select current_database()||'|'||coalesce(inet_server_addr()::text,'unix-socket')||'|'||current_setting('cron.launch_active_jobs')").trim()!=='postgres|unix-socket|off')throw Error('Local identity mismatch');
   report.migrationTarget='temporary Docker database / unix socket / internal network / cron disabled';
   save();
   for(const file of readdirSync(join(root,'supabase/migrations')).filter(f=>f.endsWith('.sql')).sort()){
    const source=read(`supabase/migrations/${file}`),entry={file,sha256:createHash('sha256').update(source).digest('hex')};
    try{sql(source);entry.status='passed';}catch(e){entry.status='failed';entry.reason=e.message.match(/ERROR: ([^\r\n]+)/)?.[1]??'SQL failed';}
    report.migrations.push(entry);save();if(entry.status==='failed')break;
   }
  }finally{command('docker',['rm','-f','-v',db]);command('docker',['network','rm',isolated]);}
 }
 report.completeBackend=code===0&&report.migrations.length===report.migrationCount&&report.migrations.every(m=>m.status==='passed');
 if(!report.completeBackend)process.exitCode=1;
}catch(error){
 report.harnessError=error.message.includes('ETIMEDOUT')?'Local Docker command timeout':error.message.includes('password authentication failed')?'Local bootstrap administrator authentication failed':error.message.includes('cron.launch_active_jobs')?'Local bootstrap cron safety setup failed':'Local harness failed; no remote target used';
 report.completeBackend=false;process.exitCode=1;
}finally{
 save();
 for(const container of command('docker',['ps','-a','--filter',`name=${name}`,'--format','{{.Names}}']).trim().split(/\r?\n/).filter(Boolean)){
  if(!container.endsWith(name))throw Error('Cleanup target mismatch');
  const inspect=JSON.parse(command('docker',['inspect',container]))[0];
  const rawLog=spawnSync('docker',['logs','--tail','30',container],{encoding:'utf8',timeout:10000});const log=(rawLog.stdout??'')+(rawLog.stderr??'');
  report.logEvidence??=[];report.logEvidence.push({container:container.replace(name,'[test-project]'),dockerConnectionRefused:log.includes('Listing currently running containers failed')&&log.includes('Connection refused'),outOfMemory:/out of memory/i.test(log)});
  report.snapshots.push({container:container.replace(name,'[test-project]'),state:inspect.State.Status,exitCode:inspect.State.ExitCode,oomKilled:inspect.State.OOMKilled,health:inspect.State.Health?.Status??null});
  command('docker',['rm','-f','-v',container]);
 }
 for(const type of ['volume','network'])for(const target of command('docker',[type,'ls','--format','{{.Name}}']).trim().split(/\r?\n/).filter(x=>x.endsWith(name)))command('docker',[type,'rm',target]);
 report.temporaryProject='OS temporary directory / phase0-diagnose-*; only synthetic local config; no secrets retained';save();
 console.log(JSON.stringify({bootstrap:report.bootstrap,completeBackend:report.completeBackend,lastMigration:report.migrations.at(-1)}));
}
