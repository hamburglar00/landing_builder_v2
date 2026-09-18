// Official Auth image on the same internal network as the runner-owned database.
// Uses only the stack's existing local supabase_auth_admin login; no role grants.
import {spawnSync} from 'node:child_process';
import {randomUUID,createHmac} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';

function docker(args,input) {
  const r=spawnSync('docker',args,{input,encoding:'utf8',windowsHide:true,timeout:30000});
  if(r.error||r.status!==0)throw Error('Isolated Auth command failed; output withheld');
  return r.stdout;
}

export async function profileAuthApi(db) {
  const {containerId,networkId}=db.localApiTarget();
  const name=`phase1b1-auth-${randomUUID().slice(0,8)}`;
  const secret=randomUUID()+randomUUID();
  const image='public.ecr.aws/supabase/gotrue:v2.189.0';
  let ownedId;
  const close=()=>{
    if(!ownedId)return;
    const state=JSON.parse(docker(['inspect',ownedId]))[0];
    if(state.Name!=='/'+name||state.Config.Labels?.['phase1b1.database']!==containerId)throw Error('Auth ownership lost');
    const removedId=ownedId;
    docker(['rm','-f','-v',ownedId]);ownedId=null;
    if(docker(['ps','-aq','--no-trunc']).trim().split(/\r?\n/).includes(removedId))throw Error('Runner-owned Auth container remains');
    return {container:removedId,remaining:0};
  };
  const request=(method,path,body)=>{
    if(!/^(health|admin\/users(?:\/[a-f0-9-]{36})?)$/.test(path))throw Error('Unexpected local Auth endpoint');
    db.localApiTarget();
    const state=JSON.parse(docker(['inspect',ownedId]))[0];
    const networks=Object.values(state.NetworkSettings.Networks);
    if(networks.length!==1||networks[0].NetworkID!==networkId||Object.keys(state.HostConfig.PortBindings??{}).length)throw Error('Auth isolation changed');
    const b64=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
    const unsigned=`${b64({alg:'HS256',typ:'JWT'})}.${b64({role:'service_role',exp:Math.floor(Date.now()/1000)+600})}`;
    const jwt=unsigned+'.'+createHmac('sha256',secret).update(unsigned).digest('base64url');
    const config=[`url = ${JSON.stringify(`http://${name}:9999/${path}`)}`,`request = ${JSON.stringify(method)}`,
      'silent','show-error','max-time = 10','write-out = "\\n%{http_code}"',
      `header = ${JSON.stringify('Authorization: Bearer '+jwt)}`,'header = "Content-Type: application/json"'];
    if(body!==undefined)config.push(`data = ${JSON.stringify(JSON.stringify(body))}`);
    const response=docker(['exec','-i',containerId,'curl','--config','-'],config.join('\n'));
    const cut=response.lastIndexOf('\n');
    return {status:Number(response.slice(cut+1)),body:response.slice(0,cut)?JSON.parse(response.slice(0,cut)):null};
  };
  try {
    // Fail closed if the pinned image is unavailable; never pull during tests.
    docker(['image','inspect',image]);
    const state=JSON.parse(docker(['inspect',containerId]))[0];
    const password=state.Config.Env.find(e=>e.startsWith('POSTGRES_PASSWORD='))?.slice(18);
    if(!password)throw Error('Ephemeral Auth database credential unavailable');
    const env=[
      `GOTRUE_DB_DATABASE_URL=postgresql://supabase_auth_admin:${encodeURIComponent(password)}@${state.Name.slice(1)}:5432/postgres`,
      'GOTRUE_DB_DRIVER=postgres','GOTRUE_API_HOST=0.0.0.0','GOTRUE_API_PORT=9999',
      'API_EXTERNAL_URL=http://127.0.0.1:1/auth/v1','GOTRUE_SITE_URL=http://127.0.0.1:1',
      'GOTRUE_DISABLE_SIGNUP=true','GOTRUE_EXTERNAL_EMAIL_ENABLED=true','GOTRUE_EXTERNAL_PHONE_ENABLED=false',
      'GOTRUE_MAILER_AUTOCONFIRM=true','GOTRUE_JWT_ADMIN_ROLES=service_role','GOTRUE_JWT_AUD=authenticated',
      'GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated',`GOTRUE_JWT_SECRET=${secret}`,
      'GOTRUE_TRACING_ENABLED=false','GOTRUE_METRICS_ENABLED=false','GOTRUE_LOG_LEVEL=error',
    ];
    ownedId=docker(['create','--pull','never','--name',name,'--network',networkId,'--label',`phase1b1.database=${containerId}`,
      ...env.flatMap(value=>['-e',value]),image]).trim();
    docker(['start',ownedId]);
    let ready=false;
    for(let i=0;i<30;i++) {
      try {if(request('GET','health').status===200){ready=true;break;}}catch{}
      await delay(1000);
    }
    if(!ready)throw Error('Local Auth health check unavailable after 30 seconds; no fallback role grants attempted');
    return {request,close,image,dbLogin:'supabase_auth_admin (existing stack login)',publishedPorts:0};
  }catch(error){close();throw error;}
}
