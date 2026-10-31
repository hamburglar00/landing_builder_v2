// Compiled gateway UI, mocked .invalid transport only. No provider or conversion calls.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const workspace=fileURLToPath(new URL('../../',import.meta.url));
const require=createRequire(new URL('../frontend/package.json',import.meta.url));
const {build}=require('esbuild');
const {chromium,webkit}=require(path.join(process.env.APPDATA,'npm/node_modules/playwright'));
async function compiled(repo){
  const cwd=path.join(workspace,repo);
  const output=await build({absWorkingDir:cwd,stdin:{resolveDir:cwd,loader:'ts',contents:'export{renderPreparationPage}from"./src/lib/preparation-page";export{renderGatewayEntryTransition,GATEWAY_ENTRY_TRANSITION_RUNTIME}from"./src/lib/gateway-entry-transition";'},bundle:true,write:false,platform:'node',format:'cjs',minify:true,target:'es2020'});
  const module={exports:{}};new Function('module','exports',output.outputFiles[0].text)(module,module.exports);return module.exports;
}
const gateways=[['landing-autologuin','rey_de_ases'],['ases-gateway','ases_del_norte'],['ganamos-gateway','ganamos_net'],['multi-skin-gateway','multi_skin']];
const theme={title:'Fixture',canvasColor:'#101010',logo:'/fixture.svg',logoAlt:'Fixture',background:'#101010',accent:'#ffe000',accentText:'#101010',text:'#ffffff',muted:'#cccccc',panel:'#202020',panelBorder:'#303030',spinnerTrack:'#444444',shadow:'0 0 0 transparent'};
const assets=await Promise.all(gateways.map(async([repo,provider])=>({repo,provider,...await compiled(repo)})));
const checks=[];
for(const [browserName,engine] of [['Chromium',chromium],['WebKit',webkit]]){
  const browser=await engine.launch({headless:true});
  try{for(const asset of assets){
    for(const mode of ['prepared','handoff'])for(const scenario of ['renew','expired']){
      if(process.env.ENTRY_META_SCOPE==='iframe')continue;
      console.error(`${browserName} ${asset.repo} ${mode} ${scenario}`);
      const context=await browser.newContext(),page=await context.newPage();
      await page.addInitScript(()=>{const original=window.fetch;window.__fixtureRequests=[];window.fetch=function(input,init){window.__fixtureRequests.push({path:new URL(String(input),location.href).pathname,credentials:init&&init.credentials});return original.apply(this,arguments)};});
      await page.clock.install();
      const requests=[],errors=[];page.on('pageerror',error=>errors.push(error.message));
      let capturedNonce='',starts=0;
      const html=asset.renderPreparationPage(mode==='prepared'?'p1.original':'original',theme);
      await page.route('**/*',async route=>{
        const req=route.request(),url=new URL(req.url());let body={};try{body=req.postDataJSON()||{}}catch{}
        const headers=await req.allHeaders();
        requests.push({path:url.pathname,body,url:url.href,headers});
        if(url.pathname==='/prepare')return route.fulfill({contentType:'text/html',body:html});
        if(url.pathname==='/api/preparations/complete'){
          capturedNonce=body.nonce;
          return route.fulfill({headers:{'set-cookie':'gateway_entry_retry_v1=private-receipt; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=1800'},json:{username:'same-player',continuation_token:'c1.original',entry_token:'ge1.original',handoff_url:'https://gateway.invalid/start?t=original'}});
        }
        if(url.pathname==='/start'){
          starts++;
          if(!capturedNonce)capturedNonce=headers['x-gateway-retry'];
          if(starts===1)return route.fulfill({status:400,headers:{'set-cookie':'gateway_entry_retry_v1=private-receipt; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=1800'},json:{error:'login_failed',retryable:false}});
          if(mode==='handoff'&&url.searchParams.get('t')==='original')return route.fulfill({status:410,json:{error:'expired',retryable:false}});
          assert.equal(url.searchParams.get('t'),'renewed-pass');
          assert.equal(headers['x-gateway-entry'],'ge1.renewed');
          assert.equal(headers['x-gateway-retry'],capturedNonce);
          return route.fulfill({json:{username:'same-player',password:'fixture-only',entry_confirmation:'ge1.confirmed',entry_id:'same-entry',redirect_url:'https://gateway.invalid/home',entry_wait:{enabled:true,seconds:60}}});
        }
        if(url.pathname==='/api/entry/renew'){
          assert.match(capturedNonce,/^[a-f0-9]{64}$/);assert.deepEqual(body,{nonce:capturedNonce});
          const stored=(await context.cookies()).find(cookie=>cookie.name==='gateway_entry_retry_v1');
          assert.ok(stored?.httpOnly&&stored.secure&&stored.domain==='gateway.invalid');
          // WebKit's intercepted requests omit the Cookie header even while its
          // cookie jar contains it. Check real fetch credentials in both engines.
          assert.equal(await page.evaluate(()=>window.__fixtureRequests.filter(r=>r.path==='/api/entry/renew').at(-1).credentials),'same-origin');
          if(browserName==='Chromium')assert.match(headers.cookie||'',/gateway_entry_retry_v1=private-receipt/);
          return route.fulfill(scenario==='expired'?{status:410,json:{error:'entry_recovery_expired',retryable:false}}:{json:{username:'same-player',handoff_url:'https://gateway.invalid/start?t=renewed-pass',entry_token:'ge1.renewed'}});
        }
        if(url.pathname==='/api/preparations/finalize')return route.fulfill({status:410,json:{error:'expired',retryable:false}});
        if(url.pathname==='/api/session/recover')return route.fulfill({json:{active:true,entry_confirmed:true,entry_id:'same-entry'}});
        if(url.pathname==='/home')return route.fulfill({contentType:'text/html',body:'<main data-login-ready>Same player</main>'});
        return route.fulfill({body:''});
      });
      await page.goto('https://gateway.invalid/prepare');
      await page.locator('main[data-view="error"]').waitFor();
      assert.equal(await page.evaluate(()=>document.cookie.includes('private-receipt')),false,'receipt is HttpOnly');
      await page.clock.fastForward(301000);
      const renewed=page.waitForRequest(req=>new URL(req.url()).pathname==='/api/entry/renew');
      await page.locator('#retry').click();await renewed;
      if(scenario==='renew'){
        if(mode==='prepared')await page.locator('[data-login-ready]').waitFor();
        else await page.locator('#password').filter({hasText:'fixture-only'}).waitFor();
      }
      else {await page.locator('main[data-view="error"]').waitFor();assert.equal(starts,mode==='prepared'?1:2);}
      assert.equal(requests.filter(r=>r.path==='/api/preparations/complete').length,mode==='prepared'?1:0,'never create or complete another account');
      assert.equal(requests.filter(r=>r.path==='/api/preparations/finalize').length,mode==='prepared'&&scenario==='expired'?1:0,'legacy continuation fallback is attempted only if receipt expired');
      assert.deepEqual(errors,[]);checks.push({browser:browserName,repo:asset.repo,mode,scenario});await context.close();
    }
    if(process.env.ENTRY_META_SCOPE==='receipt')continue;
    console.error(`${browserName} ${asset.repo} iframe renewal`);
    const context=await browser.newContext(),page=await context.newPage();await page.clock.install();
    const requests=[],errors=[];page.on('pageerror',error=>errors.push(error.message));let allowRenew=false;
    const chatOrigin='https://chat.invalid',oldUrl=chatOrigin+'/embed?token=old-session',newUrl=chatOrigin+'/embed?token=renewed-session';
    const html='<!doctype html><html><body>'+asset.renderGatewayEntryTransition(asset.provider,{active:true,...(asset.provider==='multi_skin'?{brand:{name:'Bet30',logo:'/bet30.svg',background:'#123456'}}:{})})+'<iframe id="chat" src="'+oldUrl+'"></iframe><script>'+asset.GATEWAY_ENTRY_TRANSITION_RUNTIME+'var transition=createGatewayEntryTransition(document.getElementById("gateway-entry-transition"));transition.start("connecting");transition.bind(document.getElementById("chat"),"'+chatOrigin+'",true);</script></body></html>';
    await context.addCookies([{name:'fixture-session',value:'same-account-bet30',domain:'gateway.invalid',path:'/',httpOnly:true,secure:true}]);
    await page.route('**/*',async route=>{
      const req=route.request(),url=new URL(req.url());let body={};try{body=req.postDataJSON()||{}}catch{}requests.push({path:url.pathname,body,url:url.href});
      if(url.origin==='https://gateway.invalid'&&url.pathname==='/home')return route.fulfill({contentType:'text/html',body:html});
      if(url.pathname==='/api/chat/renew'){
        assert.deepEqual(body,{token:'old-session'});assert.ok((await context.cookies()).some(cookie=>cookie.name==='fixture-session'&&cookie.httpOnly));
        if(browserName==='Chromium')assert.match((await req.allHeaders()).cookie||'',/fixture-session=same-account-bet30/);
        return route.fulfill(allowRenew?{json:{chat_url:newUrl}}:{status:503,json:{error:'temporarily_unavailable'}});
      }
      if(url.origin===chatOrigin){
        const ready=url.href===newUrl?'<script>parent.postMessage({source:"atrio-widget",type:"atrio.widget.entry-ready",walletReady:true,walletRequestCompleted:true},"https://gateway.invalid")</script>':'';
        return route.fulfill({contentType:'text/html',body:'<main>Same account/skin fixture</main>'+ready});
      }
      return route.fulfill({body:''});
    });
    await page.goto('https://gateway.invalid/home');
    await page.clock.fastForward(20001);await page.clock.fastForward(751);
    await page.locator('#gateway-entry-transition[data-stage="error"]').waitFor();
    await page.clock.fastForward(301000);allowRenew=true;
    await page.locator('[data-entry-retry]').click();
    await page.locator('#gateway-entry-transition[hidden]').waitFor({state:'attached'});
    assert.equal(await page.locator('#chat').getAttribute('src'),newUrl);
    assert.equal(requests.filter(r=>r.url===oldUrl).length,1,'expired iframe URL is not reloaded');
    assert.equal(requests.filter(r=>r.path==='/api/preparations/complete'||r.path==='/start').length,0);
    if(asset.provider==='multi_skin')assert.equal(await page.locator('[data-entry-logo]').getAttribute('alt'),'Bet30');
    assert.deepEqual(errors,[]);checks.push({browser:browserName,repo:asset.repo,mode:'iframe',scenario:'renew'});await context.close();
  }}finally{await browser.close();}
}
console.log(JSON.stringify({passed:checks.length,checks},null,2));
