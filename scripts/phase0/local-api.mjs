import { randomUUID, createHmac } from 'node:crypto';
import { command, delay } from './local-runtime.mjs';

export async function localApi(db, role='authenticated', subject='13000000-0000-0000-0000-000000000001') {
  const name=`${db.name}-api`, password=db.password, secret=randomUUID()+randomUUID();
  // Ephemeral password from this invocation, never written to fixtures/reports.
  let created=false,stage='create';
  try {
    command('docker',['create','--name',name,'--network','bridge','-p','127.0.0.1::3000',
      '-e',`PGRST_DB_URI=postgres://postgres:${password}@${db.name}:5432/phase0`,
      '-e','PGRST_DB_SCHEMAS=public','-e','PGRST_DB_ANON_ROLE=anon','-e','PGRST_DB_MAX_ROWS=1000',
      '-e',`PGRST_JWT_SECRET=${secret}`,'public.ecr.aws/supabase/postgrest:v14.1']);created=true;
    stage='start';command('docker',['network','connect',db.name,name]);command('docker',['start',name]);
    await delay(1500);
    stage='loopback binding';const binding=command('docker',['port',name,'3000/tcp']).trim();
    if(!/^127\.0\.0\.1:\d+$/.test(binding)) throw new Error('API is not loopback-only');
    const url=`http://${binding}`;
    stage='HTTP readiness';let ready=false;
    for(let i=0;i<30;i++){try{if((await fetch(url)).ok){ready=true;break;}}catch{}await delay(1000);}
    if(!ready) throw new Error('Local PostgREST did not start');
    const b64=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
    const unsigned=`${b64({alg:'HS256',typ:'JWT'})}.${b64({role,sub:subject,exp:Math.floor(Date.now()/1000)+3600})}`;
    const jwt=`${unsigned}.${createHmac('sha256',secret).update(unsigned).digest('base64url')}`;
    return {url,jwt,close:()=>command('docker',['rm','-f','-v',name])};
  } catch {
    let reason='unknown';
    if(created){
      try{const logs=command('docker',['logs',name]);reason=['Connection refused','password authentication failed','no pg_hba.conf entry','could not translate host name'].find(x=>logs.includes(x))??reason;}catch{}
      command('docker',['rm','-f','-v',name]);
    }
    throw new Error(`Disposable local API startup failed at ${stage}: ${reason} (credentials withheld)`);
  }
}
