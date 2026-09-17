import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { assertSafeEnvironment, assertFreshProject } from './bootstrap-manifest.mjs';

const checked = (cmd, args, input) => {
  const r = spawnSync(cmd, args, {input, encoding:'utf8', timeout:120000, maxBuffer:32*1024*1024, windowsHide:true});
  if (r.error || r.status !== 0) {
    // SQL/output may contain old literals: never forward raw output or stderr.
    const code = r.stderr?.match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1];
    const missing = r.stderr?.match(/column "[a-zA-Z0-9_]{1,100}" of relation "[a-zA-Z0-9_]{1,100}" does not exist/)?.[0]
      ?? r.stderr?.match(/(?:relation|column|function|type|schema) "([a-zA-Z0-9_. ]{1,100})" (?:does not exist|already exists)/)?.[0];
    const e = Error(missing ?? `Local command failed${code ? ' SQLSTATE '+code : ''}`);
    e.sqlstate = code ?? null; throw e;
  }
  return r.stdout;
};
const docker = (args, input) => checked('docker', args, input);
const inspect = id => JSON.parse(docker(['inspect', id]))[0];

export async function createBootstrapDatabase() {
  assertSafeEnvironment();
  const endpoint = docker(['context','inspect','--format','{{.Endpoints.docker.Host}}']).trim();
  if (!/^(npipe:\/\/\/\/\.\/pipe\/|unix:\/\/\/)/.test(endpoint)) throw Error('Docker daemon must be local');
  const nonce = randomUUID();
  const project = `phase0b-${nonce.slice(0,8)}`;
  const name = `supabase_db_${project}`;
  const existingNames=[docker(['ps','-a','--format','{{.Names}}']),docker(['volume','ls','--format','{{.Name}}']),docker(['network','ls','--format','{{.Name}}'])].flatMap(s=>s.trim().split(/\r?\n/).filter(Boolean));
  assertFreshProject(project,existingNames);
  const dir = mkdtempSync(join(tmpdir(), 'phase0b-bootstrap-'));
  const networkName = `${project}-isolated`;
  let containerId = null, networkId = null;
  let cli = 'supabase';
  if (process.platform === 'win32') {
    const shim = checked('where.exe',['supabase']).trim().split(/\r?\n/)[0].replace(/\.exe$/,'.shim');
    if (existsSync(shim)) cli = readFileSync(shim,'utf8').match(/path = "([^"]+)"/)?.[1] ?? cli;
  }
  checked(cli, ['start','--help']);
  if (docker(['ps','-aq','--filter',`name=^/${name}$`]).trim()) throw Error('Generated container already exists');
  mkdirSync(join(dir,'supabase/migrations'), {recursive:true});
  writeFileSync(join(dir,'supabase/config.toml'), `project_id = "${project}"\n[db]\nmajor_version = 17\nport = 55322\n[db.seed]\nenabled = false\n[api]\nport = 55321\n[studio]\nport = 55323\n[inbucket]\nport = 55324\n`);
  const proveOwnership = () => {
    if (!containerId || inspect(containerId).Name !== '/'+name) throw Error('Disposable container ownership lost');
    const liveEndpoint = docker(['context','inspect','--format','{{.Endpoints.docker.Host}}']).trim();
    if (liveEndpoint !== endpoint) throw Error('Docker endpoint changed');
  };
  const sql = query => {
    proveOwnership();
    const state = inspect(containerId);
    const networks = Object.keys(state.NetworkSettings.Networks);
    if (networks.length !== 1 || networks[0] !== networkName || !inspect(networkId).Internal) throw Error('Database network is no longer isolated');
    return docker(['exec','-i',containerId,'psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-Atq'], query);
  };
  const close = () => {
    if (containerId) { proveOwnership(); docker(['rm','-f','-v',containerId]); containerId=null; }
    if (networkId) { const n=inspect(networkId); if(n.Name!==networkName || n.Labels?.['phase0b.owner']!==nonce) throw Error('Network ownership lost'); docker(['network','rm',networkId]); networkId=null; }
    // CLI creates its own uniquely named network/volume. Only this generated project's resources qualify.
    for (const type of ['volume','network']) {
      for (const target of docker([type,'ls','--format','{{.Name}}']).trim().split(/\r?\n/).filter(n=>n.endsWith('_'+project))) {
        const item=JSON.parse(docker([type,'inspect',target]))[0];
        const labels=item.Labels ?? {};
        if (!Object.values(labels).includes(project)) throw Error('CLI resource ownership unverified; retained');
        docker([type,'rm',type==='network'?item.Id:target]);
      }
    }
  };
  const started = Date.now();
  try {
    const excluded='gotrue,realtime,storage-api,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor';
    const child=spawn(cli,['start','--workdir',dir,'--exclude',excluded],{cwd:dir,env:{...process.env,DO_NOT_TRACK:'1'},windowsHide:true,stdio:['ignore','pipe','pipe']});
    // Drain output without retaining debug credentials or logging provider statements.
    child.stdout.on('data',()=>{}); child.stderr.on('data',()=>{});
    const timer=setTimeout(()=>child.kill(),180000);
    const exit=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve);});clearTimeout(timer);
    const candidate=docker(['ps','-aq','--filter',`name=^/${name}$`]).trim();
    if(candidate){const own=inspect(candidate);if(own.Name!=='/'+name || !Object.values(own.Config.Labels??{}).includes(project)) throw Error('CLI container provenance unverified');containerId=own.Id;}
    if(exit!==0 || !containerId) throw Error('Local Supabase database bootstrap failed within 180 seconds');
    networkId=docker(['network','create','--internal','--label',`phase0b.owner=${nonce}`,networkName]).trim();
    docker(['network','connect',networkId,containerId]);
    for(const n of Object.keys(inspect(containerId).NetworkSettings.Networks)) if(n!==networkName) docker(['network','disconnect',n,containerId]);
    const password=inspect(containerId).Config.Env.find(e=>e.startsWith('POSTGRES_PASSWORD='))?.slice('POSTGRES_PASSWORD='.length);
    if(!password)throw Error('Bootstrap administrator credential missing');
    docker(['exec','-i','-e',`PGPASSWORD=${password}`,containerId,'psql','-X','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1','-Atq'],"alter system set cron.launch_active_jobs=off; select pg_reload_conf();");
    if(sql("select current_database()||'|'||coalesce(inet_server_addr()::text,'unix-socket')||'|'||current_setting('cron.launch_active_jobs')").trim()!=='postgres|unix-socket|off') throw Error('Database identity or cron gate invalid');
    if(sql("select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'").trim()!=='0')throw Error('Application database is not empty');
    const provider={cli:checked(cli,['--version']).trim(),image:inspect(containerId).Config.Image,imageId:inspect(containerId).Image};
    // Native extension installation only, before application history. Never accepts SQL or a target.
    const installNativePgNet=()=>{
      if(sql("select current_setting('cron.launch_active_jobs')='off' and not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r')").trim()!=='t')throw Error('Native pg_net installation requires an empty runner-owned database');
      return docker(['exec','-i','-e',`PGPASSWORD=${password}`,containerId,'psql','-X','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-Atq'],`
BEGIN; SET LOCAL statement_timeout='15s'; SET LOCAL lock_timeout='2s';
DO $$ BEGIN
 IF NOT EXISTS(SELECT FROM pg_available_extension_versions WHERE name='pg_net' AND version='0.19.5') THEN RAISE EXCEPTION 'Required pg_net version unavailable'; END IF;
 IF EXISTS(SELECT FROM net.http_request_queue) OR EXISTS(SELECT FROM net._http_response) THEN RAISE EXCEPTION 'Network relations must be empty'; END IF;
END $$;
SET LOCAL event_triggers=false;
DROP EXTENSION pg_net;
CREATE EXTENSION pg_net WITH SCHEMA public VERSION '0.19.5';
COMMIT;
SELECT extversion FROM pg_extension WHERE extname='pg_net';`);
    };
    const netProbe=(role,fn,denied=null)=>{
      if(!['anon','authenticated','authenticator','service_role','postgres'].includes(role)||!['http_get','http_post'].includes(fn)||![null,'queue','sequence','execute'].includes(denied))throw Error('Invalid local pg_net probe');
      if(sql("select current_setting('cron.launch_active_jobs')='off' and not exists(select from net.http_request_queue) and not exists(select from net._http_response)").trim()!=='t')throw Error('pg_net probe requires stopped cron and empty network relations');
      const revoke=denied==='queue'?'REVOKE INSERT ON net.http_request_queue FROM PUBLIC;':denied==='sequence'?'REVOKE USAGE, UPDATE ON SEQUENCE net.http_request_queue_id_seq FROM PUBLIC;':denied==='execute'?`REVOKE EXECUTE ON FUNCTION net.${fn}(${fn==='http_get'?'text,jsonb,jsonb,integer':'text,jsonb,jsonb,jsonb,integer'}) FROM PUBLIC;`:'';
      return docker(['exec','-i','-e',`PGPASSWORD=${password}`,containerId,'psql','-X','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-Atq'],`
BEGIN; SET LOCAL statement_timeout='5s'; SET LOCAL lock_timeout='2s';
ALTER TABLE net.http_request_queue ADD COLUMN phase0_invoker text DEFAULT current_user;
${revoke}
SET LOCAL ROLE ${role};
SELECT net.${fn}(url:='http://127.0.0.1:1/phase0-disabled');
SELECT jsonb_build_object('role',current_user,'superuser',(SELECT rolsuper FROM pg_roles WHERE rolname=current_user),'rows',(SELECT count(*) FROM net.http_request_queue),'invoker',(SELECT phase0_invoker FROM net.http_request_queue),'sequenceMatches',(SELECT currval('net.http_request_queue_id_seq')=id FROM net.http_request_queue),'responses',(SELECT count(*) FROM net._http_response));
ROLLBACK;`);
    };
    return {sql,close,provider,installNativePgNet,netProbe,bootstrapMs:Date.now()-started,target:'runner-created Supabase PostgreSQL / unix socket / isolated network / cron.launch_active_jobs=off',
      verify:()=>sql("select current_setting('cron.launch_active_jobs')").trim()==='off'};
  } catch(error) { close(); throw error; }
}
