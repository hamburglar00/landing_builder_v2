// Diagnostic observers only: no .env access, SQL mutation, retries or raw logs.
import {spawnSync} from 'node:child_process';
import {cpus,freemem,totalmem,tmpdir} from 'node:os';
import {statfsSync} from 'node:fs';
import {basename} from 'node:path';
import {personalPathPattern} from './artifact-paths.mjs';

export function sanitizeText(value) {
  return String(value??'').replace(/\x1b\[[0-9;]*m/g,'')
    .replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g,'[private key withheld]')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[JWT withheld]')
    .replace(/\b(?:sb_secret_|sb_publishable_|sk-proj-|ghp_|github_pat_|AKIA)[A-Za-z0-9_-]+/g,'[credential withheld]')
    .replace(/\bBearer\s+[^\s"',;]+/gi,'[authorization withheld]')
    .replace(/\b(?:password|passwd|token|secret|api[_-]?key|authorization)\s*[:=]\s*[^\s,;]+/gi,'[credential assignment withheld]')
    .replace(/(?:postgres(?:ql)?|https?):\/\/[^\s"'<>]+/gi,'[URL withheld]')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,'[email withheld]')
    .replace(new RegExp(personalPathPattern.source,'gi'),'[personal path withheld]')
    .replace(/\b[A-Za-z0-9_+/=-]{48,}\b/g,token=>/^[a-f0-9]{64}$/.test(token)?token:'[opaque value withheld]');
}

function errorText(value) {
  const source=String(value??'');
  return source.split(/\r?\n/).filter(line=>!/(?:STATEMENT:|CONTEXT:|DETAIL:|QUERY:|^\s*LINE \d+:|^\s*\^\s*$)/i.test(line))
    .map(line=>sanitizeText(line.replace(/'(?:''|[^'])*'/g,"'[literal withheld]'"))).join('\n').slice(-12000);
}

export function safeCommand(cmd,args) {
  const exe=basename(cmd.replaceAll('\\','/'));
  const safe=[];
  for(let i=0;i<args.length;i++) {
    const arg=String(args[i]);
    if(['-e','--env'].includes(arg)){safe.push(arg,String(args[++i]).split('=')[0]+'=[withheld]');continue;}
    if(arg==='--workdir'){safe.push(arg,'[temporary directory]');i++;continue;}
    safe.push(sanitizeText(arg));
  }
  return {executable:exe,subcommand:exe==='docker'?args.slice(0,args[0]==='exec'?1:2).join(' '):args[0]??'',args:safe};
}

export function safeInspection(raw) {
  const items=JSON.parse(raw);
  return items.map(item=>item.Config?{
    Id:item.Id,Name:item.Name,image:item.Config.Image,restartCount:item.RestartCount,
    state:{status:item.State.Status,running:item.State.Running,paused:item.State.Paused,restarting:item.State.Restarting,
      oomKilled:item.State.OOMKilled,exitCode:item.State.ExitCode,error:sanitizeText(item.State.Error),
      startedAt:item.State.StartedAt,finishedAt:item.State.FinishedAt,health:item.State.Health?.Status},
    limits:{memory:item.HostConfig.Memory,nanoCpus:item.HostConfig.NanoCpus,cpuQuota:item.HostConfig.CpuQuota,cpuPeriod:item.HostConfig.CpuPeriod,pidsLimit:item.HostConfig.PidsLimit},
    networks:Object.entries(item.NetworkSettings.Networks).map(([name,value])=>({name,id:value.NetworkID})),
    volumes:item.Mounts.filter(m=>m.Type==='volume').map(m=>({name:m.Name,destination:m.Destination})),
  }:{Id:item.Id,Name:item.Name,Internal:item.Internal,Driver:item.Driver});
}

export function safeOutput(cmd,args,result) {
  let stdout;
  if(args.includes('psql')) {
    // A migration or a catalog query can print historical SQL/credentials.
    const lines=String(result.stdout??'').trim().split(/\r?\n/);
    stdout=lines.every(line=>/^(?:|t|f|\d+|BEGIN|COMMIT|ROLLBACK|CREATE [A-Z ]+|ALTER [A-Z ]+|DROP [A-Z ]+|INSERT \d+ \d+|UPDATE \d+|DELETE \d+)$/.test(line))
      ?lines.join('\n'):'[SQL result contents withheld; byte count retained]';
  } else if(cmd==='docker'&&args[0]==='inspect'&&result.status===0) {
    try {stdout=safeInspection(result.stdout);}catch{stdout='[unparsed inspect output withheld]';}
  } else if(/supabase(?:\.exe)?$/.test(cmd)&&args[0]==='start') {
    stdout=String(result.stdout??'').split(/\r?\n/).filter(line=>/^(?:Starting|Started|Stopping|Stopped|Initializ|Applying|Waiting|Failed|Error|ERROR)/i.test(line)).map(sanitizeText).join('\n').slice(-12000);
  } else {stdout=sanitizeText(result.stdout).slice(-12000);}
  const stderr=args.includes('psql')?errorText(result.stderr).split('\n').filter(line=>/^(?:psql:[^\n]*?:\s*)?(?:ERROR|FATAL|PANIC|WARNING|NOTICE|LOCATION):/.test(line)).join('\n'):errorText(result.stderr);
  return {stdout,stderr,stdoutBytes:Buffer.byteLength(result.stdout??''),stderrBytes:Buffer.byteLength(result.stderr??'')};
}

export function createDiagnosticTrace(root,onChange) {
  const data={context:{stage:'preflight',migration:null,lastCompletedMigration:null},commandCount:0,commandCounts:{},lastCommands:[],failures:[],snapshots:[],retryCount:0};
  let owner;
  const flush=()=>onChange(data);
  const setStage=(stage,details={})=>{data.context={...data.context,stage,...details};flush();};
  const bindOwner=value=>{owner={...owner,...value};data.owner=owner;flush();};
  function record({cmd,args,result,timeoutMs,durationMs,inputPresent=false,timeoutTriggered=false}) {
    const command=safeCommand(cmd,args);
    const item={number:++data.commandCount,at:new Date().toISOString(),...data.context,...command,
      timeoutMs,durationMs:Math.round(durationMs),exitCode:result.status??null,signal:result.signal??null,
      spawnError:result.error?{code:result.error.code??null,errno:result.error.errno??null,message:sanitizeText(result.error.message)}:null,
      timedOut:timeoutTriggered||result.error?.code==='ETIMEDOUT',sqlstate:result.stderr?.match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1]??null,
      stdin:inputPresent?'[withheld]':'none',...safeOutput(cmd,args,result)};
    data.commandCounts[command.executable+' '+command.subcommand]=(data.commandCounts[command.executable+' '+command.subcommand]??0)+1;
    data.lastCommands.push(item);if(data.lastCommands.length>40)data.lastCommands.shift();
    if(result.error||result.status!==0)data.failures.push(item);
    flush();return item;
  }
  function diagnostic(args) {
    const started=performance.now();
    const result=spawnSync('docker',args,{encoding:'utf8',windowsHide:true,timeout:15000,maxBuffer:2*1024*1024});
    // Diagnostic read failures never replace the original runner error.
    return {result,summary:{command:safeCommand('docker',args),exitCode:result.status,signal:result.signal,error:result.error?.code??null,timeoutMs:15000,durationMs:Math.round(performance.now()-started),stderr:errorText(result.stderr)}};
  }
  function snapshot(reason) {
    const entry={reason,at:new Date().toISOString(),...data.context,host:{cpuCount:cpus().length,cpuTimes:cpus().map(c=>c.times),totalMemoryBytes:totalmem(),availableMemoryBytes:freemem(),processMemoryBytes:process.memoryUsage().rss},commands:[]};
    const disk=path=>{try{const s=statfsSync(path);return {totalBytes:s.blocks*s.bsize,availableBytes:s.bavail*s.bsize};}catch{return {unavailable:true};}};
    entry.host.workspaceDisk=disk(root);entry.host.temporaryDisk=disk(tmpdir());
    const info=diagnostic(['info','--format','{{json .}}']);entry.commands.push(info.summary);
    if(info.result.status===0) {
      try {const i=JSON.parse(info.result.stdout);entry.docker={serverVersion:i.ServerVersion,cpuCount:i.NCPU,memoryBytes:i.MemTotal,driver:i.Driver,operatingSystem:sanitizeText(i.OperatingSystem)};}catch{entry.docker={unparsed:true};}
    }
    if(owner?.containerId) {
      const state=diagnostic(['inspect',owner.containerId]);entry.commands.push(state.summary);
      if(state.result.status===0) {
        const item=JSON.parse(state.result.stdout)[0];
        if(item.Name!=='/supabase_db_'+owner.project||!Object.values(item.Config.Labels??{}).includes(owner.project))throw Error('Diagnostic container ownership lost');
        entry.container=safeInspection(state.result.stdout)[0];
        const stats=diagnostic(['stats','--no-stream','--format','{{json .}}',owner.containerId]);entry.commands.push(stats.summary);
        if(stats.result.status===0) {
          try {const s=JSON.parse(stats.result.stdout);entry.usage={cpuPercent:s.CPUPerc,memoryUsage:s.MemUsage,memoryPercent:s.MemPerc,pids:s.PIDs,blockIo:s.BlockIO};}catch{entry.usage={unparsed:true};}
        }
        const free=diagnostic(['exec',owner.containerId,'df','-Pk','/','/var/lib/postgresql/data']);entry.commands.push(free.summary);entry.filesystems=sanitizeText(free.result.stdout);
        const logs=diagnostic(['logs','--timestamps','--tail','100',owner.containerId]);entry.commands.push(logs.summary);
        entry.containerLogs=errorText(String(logs.result.stdout??'')+'\n'+String(logs.result.stderr??'')).split('\n')
          .filter(line=>/\b(?:ERROR|FATAL|PANIC|WARNING):|\bLOG:.*(?:OOM|signal|shutdown|ready to accept|database system|out of memory|No space)/i.test(line)).slice(-30);
        entry.logPolicy='Last 100 lines read in memory; only relevant status/error lines retained; SQL context and literals suppressed.';
      }
    }
    data.snapshots.push(entry);flush();return entry;
  }
  function remainingResources() {
    if(!owner)return {containers:[],networks:[],volumes:[]};
    const remaining={};
    for(const [kind,args] of [['containers',['ps','-a','--format','{{.ID}}|{{.Names}}']],['networks',['network','ls','--format','{{.ID}}|{{.Name}}']],['volumes',['volume','ls','--format','{{.Name}}']]]) {
      const read=diagnostic(args);
      if(read.result.status!==0)throw Error('Cannot verify remaining owned '+kind);
      remaining[kind]=String(read.result.stdout).trim().split(/\r?\n/).filter(line=>line.includes(owner.project));
    }
    return remaining;
  }
  return {data,setStage,bindOwner,record,snapshot,remainingResources};
}
