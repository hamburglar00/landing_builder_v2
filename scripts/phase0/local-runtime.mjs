// Disposable Supabase Postgres. No external database URL is accepted.
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const read = path => readFileSync(resolve(root, path), 'utf8');
export const delay = ms => new Promise(r => setTimeout(r, ms));
export function command(cmd, args, options = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', timeout: 120000, maxBuffer: 8*1024*1024, ...options });
  if (r.error || r.status !== 0) throw new Error(`${cmd} failed: ${r.error?.message ?? r.stderr}`);
  return r.stdout;
}
export async function localDatabase() {
  // A caller cannot silently redirect Docker to a remote host/context.
  if (process.env.DOCKER_HOST || process.env.DOCKER_CONTEXT) throw new Error('Unset Docker endpoint overrides before running local tests');
  const endpoint = command('docker', ['context','inspect','--format','{{.Endpoints.docker.Host}}']).trim();
  if (!endpoint.startsWith('npipe:////./pipe/') && !endpoint.startsWith('unix:///')) throw new Error('Docker endpoint is not local');
  const name = `phase0-${randomUUID().slice(0,8)}`;
  const password = randomUUID();
  let networkCreated = false, dbCreated = false;
  const args = database => ['exec','-i',name,'psql','-X','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1','-At'];
  const sql = (query, database='phase0') => command('docker',args(database),{input:query});
  const concurrentSql = (query, database='phase0') => new Promise((resolveResult,reject) => {
    const child = spawn('docker',args(database),{stdio:['pipe','pipe','pipe']});
    let stdout='',stderr='';
    child.stdout.on('data',d=>stdout+=d); child.stderr.on('data',d=>stderr+=d);
    child.on('error',reject);
    child.on('close',code=>resolveResult({code,stdout,stderr}));
    child.stdin.end(`set statement_timeout='20s'; set lock_timeout='15s';\n${query}`);
  });
  const close = () => {
    if(dbCreated) command('docker',['rm','-f','-v',name]);
    if(networkCreated) command('docker',['network','rm',name]);
  };
  try {
    command('docker',['network','create','--internal',name]); networkCreated=true;
    command('docker',['run','-d','--name',name,'--network',name,'--label','phase0.disposable=true',
      '-e',`POSTGRES_PASSWORD=${password}`,'public.ecr.aws/supabase/postgres:17.6.1.063',
      'postgres','-D','/etc/postgresql','-c','cron.launch_active_jobs=off']); dbCreated=true;
    let ready=false;
    for(let i=0;i<60;i++) {try {command('docker',['exec',name,'pg_isready','-h','127.0.0.1','-U','postgres']);sql('select 1','postgres');ready=true;break;} catch {await delay(1000);}}
    if(!ready) throw new Error('Local Postgres did not start');
    const network = JSON.parse(command('docker',['network','inspect',name]))[0];
    const container = JSON.parse(command('docker',['inspect',name]))[0];
    if(!network.Internal || Object.keys(container.HostConfig.PortBindings ?? {}).length) throw new Error('Database isolation check failed');
    sql('create database phase0 template template0','postgres');
    const identity=sql("select current_database() || '|' || coalesce(inet_server_addr()::text,'unix-socket') || '|' || current_setting('cron.launch_active_jobs')").trim();
    if(identity!=='phase0|unix-socket|off') throw new Error('Unexpected local database identity');
    console.log('LOCAL TARGET VERIFIED: disposable Docker; internal network; no published DB port; phase0/unix-socket; cron execution disabled');
    return {name,password,sql,concurrentSql,close};
  } catch(error) {close();throw error;}
}
