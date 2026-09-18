// Real PostgREST, reachable only inside the runner's isolated Docker network.
import {spawnSync} from 'node:child_process';
import {randomUUID,createHmac} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';

function docker(args,input) {
  const r=spawnSync('docker',args,{input,encoding:'utf8',windowsHide:true,timeout:30000});
  if(r.error||r.status!==0)throw Error('Isolated profile Data API command failed; output withheld');
  return r.stdout;
}

export async function profileDataApi(db) {
  const {containerId,networkId}=db.localApiTarget();
  const name=`phase1b1-api-${randomUUID().slice(0,8)}`;
  const secret=randomUUID()+randomUUID();
  let ownedId;
  const close=()=>{
    if(!ownedId)return;
    const removedId=ownedId;
    const owned=JSON.parse(docker(['inspect',ownedId]))[0];
    if(owned.Config.Labels?.['phase1b1.database']!==containerId)throw Error('API ownership lost');
    docker(['rm','-f','-v',ownedId]);ownedId=null;
    if(docker(['ps','-aq','--no-trunc']).trim().split(/\r?\n/).includes(removedId))throw Error('Runner-owned API container remains');
    return {container:removedId,remaining:0};
  };
  const token=(role,sub)=>{
    const b64=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
    const unsigned=`${b64({alg:'HS256',typ:'JWT'})}.${b64({role,sub,exp:Math.floor(Date.now()/1000)+600})}`;
    return unsigned+'.'+createHmac('sha256',secret).update(unsigned).digest('base64url');
  };
  const request=(role,sub,method,path,body,prefer='return=representation')=>{
    db.localApiTarget();
    const state=JSON.parse(docker(['inspect',ownedId]))[0];
    if(Object.values(state.NetworkSettings.Networks).some(n=>n.NetworkID!==networkId))throw Error('API network changed');
    const config=[
      `url = ${JSON.stringify(`http://${name}:3000/${path}`)}`,
      `request = ${JSON.stringify(method)}`,
      'silent','show-error','max-time = 10','write-out = "\\n%{http_code}"',
      `header = ${JSON.stringify('Authorization: Bearer '+token(role,sub))}`,
      'header = "Content-Type: application/json"',
      `header = ${JSON.stringify('Prefer: '+prefer)}`,
    ];
    if(body!==undefined)config.push(`data = ${JSON.stringify(JSON.stringify(body))}`);
    // Credentials go through stdin, never CLI arguments or console output.
    const result=docker(['exec','-i',containerId,'curl','--config','-'],config.join('\n'));
    const cut=result.lastIndexOf('\n');
    return {status:Number(result.slice(cut+1)),body:result.slice(0,cut)?JSON.parse(result.slice(0,cut)):null};
  };
  try {
    docker(['exec',containerId,'curl','--version']);
    const state=JSON.parse(docker(['inspect',containerId]))[0];
    const password=state.Config.Env.find(e=>e.startsWith('POSTGRES_PASSWORD='))?.slice(18);
    if(!password)throw Error('Ephemeral DB credential unavailable');
    ownedId=docker(['create','--name',name,'--network',networkId,'--label',`phase1b1.database=${containerId}`,
      '-e',`PGRST_DB_URI=postgres://postgres:${encodeURIComponent(password)}@${state.Name.slice(1)}:5432/postgres`,
      '-e','PGRST_DB_SCHEMAS=public','-e','PGRST_DB_ANON_ROLE=anon',
      '-e',`PGRST_JWT_SECRET=${secret}`,'public.ecr.aws/supabase/postgrest:v14.1']).trim();
    docker(['start',ownedId]);
    let ready=false;
    for(let i=0;i<30;i++) {
      try {if(request('anon',undefined,'GET','').status===200){ready=true;break;}}catch{}
      await delay(1000);
    }
    if(!ready)throw Error('Isolated profile Data API unavailable after 30 seconds');
    const apiState=JSON.parse(docker(['inspect',ownedId]))[0];
    if(Object.keys(apiState.HostConfig.PortBindings??{}).length)throw Error('API must not publish ports');
    return {request,close,image:apiState.Config.Image,dbLogin:'postgres; requests SET ROLE from ephemeral signed JWT',publishedPorts:0};
  }catch(error){close();throw error;}
}
