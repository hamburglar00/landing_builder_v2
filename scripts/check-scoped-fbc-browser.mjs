// Actual generated collectors and official SDK/helper; all browser traffic is local fixtures.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(path.join(root,'frontend/package.json'));
const {chromium,webkit}=require(path.join(process.env.APPDATA,'npm/node_modules/playwright'));
const assets=JSON.parse(await readFile(path.join(root,'frontend/components/public-landing/template7RuntimeAssets.generated.json'),'utf8'));
const sdk=await readFile(path.join(root,'frontend/public/vendor/meta-capi-param-builder/1.3.1/clientParamBuilder.bundle.js'),'utf8');
const manifest=await readFile(path.join(root,'frontend/lib/meta/ebpAssetManifest.ts'),'utf8');
const helperPath=manifest.match(/"(\/vendor\/atrio-meta-click\/v1\/[^"\s]+)"/)[1];
const helper=await readFile(path.join(root,'frontend/public',helperPath),'utf8');
const config={landingId:'f0000000-0000-4000-8000-000000000001',slug:'diana',workspaceCurrency:'ARS',pixelId:'123456'};
const scope=[config.landingId,config.workspaceCurrency,config.pixelId].join(':'),key='landing-fbc:v2:'+scope;
const cases=['clean_direct','fresh_cookie_direct','old_cookie_direct','new_click_with_old_cookie','referrer_click',
 'other_landing_then_direct','other_subdomain_then_direct','fbp_only','local_storage_fbc_only',
 'scoped_return','other_landing_scope','other_currency_scope','other_pixel_scope','expired_scoped','future_scoped',
 'expired_click_url_replay','unknown_referrer','same_landing_referrer','native_with_legacy','native_url_priority','blocked_storage','sdk_fallback_cannot_rescue',
 'native_spa_other_landing','native_spa_new_click','native_late_navigation','native_card_query'];
const results=[];
for(const[browserName,engine]of[['Chromium',chromium],['WebKit',webkit]]){
 const browser=await engine.launch({headless:true});
 try{for(const[assetName,asset]of Object.entries(assets)){
  console.error(browserName+' '+assetName+' scoped FBC');
  const initStart=asset.source.indexOf('      var scopedFbc ='),initEnd=asset.source.indexOf('      var metaTracking =');
  const functionsStart=asset.source.indexOf('      function cookieValue('),functionsEnd=asset.source.indexOf('      function getOfficialMetaParamBuilder(');
  assert(initStart>=0&&initEnd>initStart&&functionsStart>=0&&functionsEnd>functionsStart);
  const fixture='var cfg='+JSON.stringify(config)+';'+asset.source.slice(initStart,initEnd)+'var metaTracking={};'+asset.source.slice(functionsStart,functionsEnd)+
   '\nwindow.auditCollect=()=>collectMetaTrackingParams(new URLSearchParams(location.search));window.auditNative=()=>scopedFbc.collectNative('+JSON.stringify(helperPath)+');'+
   '\nwindow.auditMerge=()=>mergeMetaTracking({fbc:"fb.1."+Date.now()+".WrongBaseClick"},{fbc:"fb.1."+Date.now()+".WrongSdkClick"});';
  for(const scenario of cases){
   const context=await browser.newContext();const page=await context.newPage();let requests=0;const errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await context.route('**/*',async route=>{requests++;return route.fulfill(new URL(route.request().url()).pathname===helperPath?
    {contentType:'text/javascript',body:helper}:{contentType:'text/html',body:'<!doctype html><title>Scoped attribution fixture</title>'});});
   const timestamp=Date.now()-2*86400000;
   if(['fresh_cookie_direct','old_cookie_direct','new_click_with_old_cookie','native_with_legacy','native_url_priority','sdk_fallback_cannot_rescue'].includes(scenario))
    await context.addCookies([{name:'_fbc',value:`fb.1.${scenario==='old_cookie_direct'?Date.now()-91*86400000:timestamp}.PriorSyntheticClick`,domain:'.example.com',path:'/',expires:Math.floor(Date.now()/1000)+86400}]);
   if(scenario==='fbp_only')await context.addCookies([{name:'_fbp',value:`fb.1.${timestamp}.123456789`,domain:'.example.com',path:'/'}]);
   if(scenario==='other_landing_then_direct'||scenario==='other_subdomain_then_direct'){
    await page.goto(`https://${scenario==='other_subdomain_then_direct'?'builder':'landing'}.example.com/other-client?fbclid=OtherLandingSyntheticClick`);
    await page.addScriptTag({content:sdk});await page.evaluate(()=>window.clientParamBuilder.processAndCollectParams(location.href));
   }
   const query=['new_click_with_old_cookie','native_url_priority','blocked_storage'].includes(scenario)?'?fbclid=CurrentSyntheticClick':scenario==='expired_click_url_replay'?'?fbclid=PersistedSyntheticClick':'';
   const referrer=scenario==='referrer_click'?'https://www.facebook.com/?fbclid=ReferrerSyntheticClick':scenario==='unknown_referrer'?'https://landing.example.com/other?fbclid=WrongReferrerClick':scenario==='same_landing_referrer'?'https://landing.example.com/diana?fbclid=SameLandingClick':null;
   await page.goto('https://landing.example.com/diana'+query,referrer?{referer:referrer}:{});
   if(['scoped_return','other_landing_scope','other_currency_scope','other_pixel_scope','expired_scoped','future_scoped','expired_click_url_replay'].includes(scenario)){
    let savedScope=scope;
    if(scenario==='other_landing_scope')savedScope=scope.replace(/000000000001/,'000000000002');
    if(scenario==='other_currency_scope')savedScope=scope.replace(':ARS:',':PYG:');
    if(scenario==='other_pixel_scope')savedScope=scope.replace(':123456',':999999');
    const at=scenario.startsWith('expired')?Date.now()-91*86400000:scenario==='future_scoped'?Date.now()+3600000:timestamp;
    await page.evaluate(({savedScope,at})=>localStorage.setItem('landing-fbc:v2:'+savedScope,JSON.stringify({version:2,scope:savedScope,fbc:'fb.1.'+at+'.PersistedSyntheticClick',source:'url',captured_at:at})),{savedScope,at});
   }
   if(scenario==='local_storage_fbc_only')await page.evaluate(()=>localStorage.setItem('_fbc','fb.1.'+Date.now()+'.StorageSyntheticClick'));
   if(scenario==='blocked_storage')await page.evaluate(()=>Object.defineProperty(window,'localStorage',{get(){throw Error('Fixture storage blocked')}}));
   if(scenario.startsWith('native_'))await page.evaluate(()=>Object.defineProperty(window,'webkit',{value:{messageHandlers:{browserProperties:{postMessage:()=>new Promise(resolve=>setTimeout(()=>resolve('NativeSyntheticClick'),50))}}},configurable:true}));
   await page.addScriptTag({content:fixture});
   const before=await page.evaluate(()=>window.auditCollect());
   await page.addScriptTag({content:sdk});await page.evaluate(()=>window.clientParamBuilder.processAndCollectParams(location.href));
   const cookiesBeforeNative=await context.cookies();
   if(['native_late_navigation','native_card_query'].includes(scenario))await page.evaluate(async scenario=>{
    const pending=window.auditNative();
    history.replaceState({},'',scenario==='native_late_navigation'?'/other-landing':'/diana?card_index=1&target_provider=multi_skin#selected');
    await pending;
   },scenario);
   else if(scenario.startsWith('native_'))await page.evaluate(()=>window.auditNative());
   if(['native_spa_other_landing','native_spa_new_click'].includes(scenario)){
    await page.evaluate(scenario=>history.replaceState({},'',scenario==='native_spa_other_landing'?'/other-landing':'/diana?fbclid=NextSyntheticClick'),scenario);
    await page.addScriptTag({content:scenario==='native_spa_other_landing'?fixture.replaceAll(config.landingId,'f0000000-0000-4000-8000-000000000002').replace('"slug":"diana"','"slug":"other-landing"'):fixture});
    await page.evaluate(()=>window.auditNative());
   }
   const value=await page.evaluate(()=>window.auditCollect());
   const merge=await page.evaluate(()=>window.auditMerge());
   assert.equal(merge.fbc,value.fbc,'SDK/global/base fallback cannot override scoped selection');
   const allowed=['new_click_with_old_cookie','referrer_click','scoped_return','same_landing_referrer','native_with_legacy','native_url_priority','blocked_storage','native_card_query','native_spa_new_click'].includes(scenario);
   assert.equal(Boolean(value.fbc),allowed,scenario);
   if(!allowed){assert.equal(value.landing_attribution.fbc_source,'none');assert.equal(value.landing_attribution.captured_at,null);}
   if(scenario==='scoped_return'){
    assert.equal(value.fbc,'fb.1.'+timestamp+'.PersistedSyntheticClick');assert.equal(value.landing_attribution.entry_source,'direct');
    assert.equal(value.landing_attribution.fbc_source,'persisted');assert.equal(value.landing_attribution.captured_at,timestamp);
   }
   if(['new_click_with_old_cookie','native_url_priority','blocked_storage'].includes(scenario)){
    assert.match(before.fbc,/CurrentSyntheticClick$/);assert.equal(value.fbc,before.fbc);assert.equal(value.landing_attribution.entry_source,'url');
   }
   if(scenario==='native_with_legacy'){
    assert.equal(before.fbc,'');assert.match(value.fbc,/NativeSyntheticClick$/);assert.equal(value.landing_attribution.entry_source,'sdk_fresh');
    assert.equal(value.landing_attribution.legacy_fbc_quarantined,true);
   }
   if(scenario==='native_card_query'){assert.match(value.fbc,/NativeSyntheticClick$/);assert.equal(value.landing_attribution.entry_source,'sdk_fresh');}
   if(scenario==='native_spa_new_click'){assert.match(value.fbc,/NextSyntheticClick$/);assert.equal(value.landing_attribution.entry_source,'url');}
   if(scenario.startsWith('native_'))assert.deepEqual(await context.cookies(),cookiesBeforeNative,'Official EBP helper leaves cookies unchanged');
   if(['fresh_cookie_direct','old_cookie_direct','other_landing_then_direct','other_subdomain_then_direct','sdk_fallback_cannot_rescue'].includes(scenario))assert.equal(value.landing_attribution.legacy_fbc_quarantined,true);
   assert.deepEqual(errors,[]);
   results.push({browser:browserName,asset:assetName,scenario,fbcPresent:!!value.fbc,metadata:value.landing_attribution,requestsFulfilledLocally:requests});
   await context.close();
  }
 }}finally{await browser.close();}
}
const output=path.join(root,'.vercel/audit-fbc-20261031');await mkdir(output,{recursive:true});
await writeFile(path.join(output,'scoped-browser-results.json'),JSON.stringify({scope:'Generated functions + actual official SDK and EBP helper; all network fulfilled locally',results},null,2));
console.log(JSON.stringify({passed:results.length,cases:cases.length,browsers:2,runtimes:4}));
