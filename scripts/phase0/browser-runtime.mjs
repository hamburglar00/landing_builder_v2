import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { delay } from './local-runtime.mjs';

export function findBrowser(){
  const candidates=[process.env.PHASE0_BROWSER];
  for(const base of [process.env.PROGRAMFILES,process.env['PROGRAMFILES(X86)'],process.env.LOCALAPPDATA].filter(Boolean))
    candidates.push(join(base,'Microsoft/Edge/Application/msedge.exe'),join(base,'Google/Chrome/Application/chrome.exe'));
  candidates.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/chromium','/usr/bin/chromium-browser','/usr/bin/google-chrome');
  const browser=candidates.filter(Boolean).find(existsSync);
  if(!browser) throw new Error('Set PHASE0_BROWSER to a local Chromium executable');
  return browser;
}
export function removeTemporary(dir,prefix){
  const rel=relative(resolve(tmpdir()),resolve(dir));
  if(!rel || isAbsolute(rel) || rel.startsWith('..') || !rel.startsWith(prefix)) throw new Error('Unsafe temporary profile path');
  rmSync(resolve(dir),{recursive:true,force:true,maxRetries:5,retryDelay:200});
}
export async function chromium(){
  const dir=mkdtempSync(join(tmpdir(),'phase0-browser-'));
  const proc=spawn(findBrowser(),['--headless','--disable-gpu','--no-first-run','--disable-background-networking',
    '--remote-debugging-port=0',`--user-data-dir=${dir}`,'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
  let stderr='';proc.stderr.on('data',d=>stderr+=d);
  let wsUrl;
  for(let i=0;i<120;i++){wsUrl=stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/)?.[1];if(wsUrl)break;await delay(250);}
  if(!wsUrl){proc.kill();removeTemporary(dir,'phase0-browser-');throw new Error('Chromium did not start');}
  const port=new URL(wsUrl).port;
  const tabs=await (await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(10000)})).json();
  const tab=tabs.find(t=>t.type==='page'&&t.url==='about:blank')??tabs.find(t=>t.type==='page');
  const ws=new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
  let sequence=0;const pending=new Map(),listeners=new Map();
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);clearTimeout(p?.timer);m.error?p?.reject(new Error(m.error.message)):p?.resolve(m.result);}else{for(const cb of listeners.get(m.method)??[])cb(m.params);}};
  ws.onclose=()=>{for(const p of pending.values()){clearTimeout(p.timer);p.reject(new Error('Chromium debugger disconnected'));}pending.clear();};
  const send=(method,params={})=>new Promise((resolveResult,reject)=>{const id=++sequence;
    const timer=setTimeout(()=>{pending.delete(id);reject(new Error(`Chromium debugger timeout: ${method}`));},30000);
    pending.set(id,{resolve:resolveResult,reject,timer});ws.send(JSON.stringify({id,method,params}));});
  const on=(name,fn)=>{if(!listeners.has(name))listeners.set(name,[]);listeners.get(name).push(fn);};
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text);return r.result.value;};
  return {send,on,evaluate,close:async()=>{try{await Promise.race([send('Browser.close'),delay(1000)]);}catch{}ws.close();await delay(1000);if(proc.exitCode===null){
    if(process.platform==='win32')spawnSync('taskkill',['/PID',String(proc.pid),'/T','/F'],{windowsHide:true});else proc.kill();
  }
  for(let i=0;i<8;i++){
    try{removeTemporary(dir,'phase0-browser-');return;}catch(e){if(!['EBUSY','EPERM','ENOTEMPTY'].includes(e.code))throw e;await delay(500);}
  }
  // Windows can briefly keep Chromium cache handles open after process exit.
  // A cleanup delay must not discard valid measurements or affect other profiles.
  console.error('Disposable synthetic browser profile remained temporarily locked');
  }};
}
