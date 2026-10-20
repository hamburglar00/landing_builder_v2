// Dedicated local Postgres only. Never accepts a production connection string.
import {command,delay,root} from './local-runtime.mjs';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';

const name='atrio-manager-validation-'+randomUUID().slice(0,8);
let networkCreated=false,containerCreated=false;
try {
  if(process.env.DOCKER_HOST||process.env.DOCKER_CONTEXT) throw Error('Unset Docker endpoint overrides');
  const endpoint=command('docker',['context','inspect','--format','{{.Endpoints.docker.Host}}']).trim();
  if(!endpoint.startsWith('npipe:////./pipe/')&&!endpoint.startsWith('unix:///')) throw Error('Docker must be local');
  command('docker',['network','create','--internal',name]);networkCreated=true;
  command('docker',['run','-d','--name',name,'--network',name,'--label','atrio.validation=true',
    '-e','POSTGRES_PASSWORD='+randomUUID(),'-e','POSTGRES_USER=supabase_admin','postgres:17-alpine']);containerCreated=true;
  let ready=false;
  for(let i=0;i<45;i++) {
    try {command('docker',['exec',name,'psql','-U','supabase_admin','-d','postgres','-c','select 1']);ready=true;break;}
    catch {await delay(1000);}
  }
  if(!ready) throw Error('Disposable Postgres failed to start');
  const network=JSON.parse(command('docker',['network','inspect',name]))[0];
  const container=JSON.parse(command('docker',['inspect',name]))[0];
  if(!network.Internal||Object.keys(container.HostConfig.PortBindings??{}).length) throw Error('Database isolation required');
  command('docker',['exec',name,'psql','-U','supabase_admin','-d','postgres','-c','create database validation owner supabase_admin']);
  const child=spawn(process.execPath,['--test','tests/manager-connections.test.mjs'],{
    cwd:resolve(root,'../internal-chat'),env:{...process.env,ATRIO_MANAGER_TEST_CONTAINER:name},stdio:'inherit',windowsHide:true,
  });
  process.exitCode=await new Promise((done,reject)=>{child.once('error',reject);child.once('close',done);});
} finally {
  if(containerCreated) command('docker',['rm','-f','-v',name]);
  if(networkCreated) command('docker',['network','rm',name]);
}
