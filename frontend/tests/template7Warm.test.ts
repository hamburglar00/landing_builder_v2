import assert from 'node:assert/strict';
import test from 'node:test';
import { createTemplate7WarmHandler } from '../lib/reyDeAses/warm.server';

const landing='11111111-1111-4111-8111-111111111111',advisor='22222222-2222-4222-8222-222222222222',client='33333333-3333-4333-8333-333333333333',device='44444444-4444-4444-8444-444444444444';
const body={landing_id:landing,landing_slug:'test',atrio_client_id:client,advisor_id:advisor,advisor_slug:'gera'};
function request(value: object=body, origin='https://builder.test', cookie=true) {
  return new Request('https://builder.test/api/template7/warm',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:`lb_cid=${device}`}:{})},body:JSON.stringify(value)});
}
function setup(owner='owner',blocked=false,allowed=true,existing=false) {
  const calls:unknown[]=[];
  const handler=createTemplate7WarmHandler({
    env:{REY_GATEWAY_ORIGIN:'https://casino.test'},allow:async()=>allowed,prepare:async input=>{calls.push(input);if(existing)return {existing_name:'Existing player',promo_code:'TEST-123456'};},
    recover:async(_request,payload)=>{calls.push(payload);return Response.json({handoff_url:'https://casino.test/prepare?t=encrypted-existing'})},
    db:{landing:async()=>({id:landing,name:'test',user_id:'owner',workspace_currency:'ARS',config:{template:'template7',ctaDestination:'atrio',targetProvider:'rey_de_ases'},landing_config:{}}),
      assignment:async()=>({landing_id:landing,atrio_client_id:client,user_id:owner}),
      advisor:async()=>({id:client,user_id:owner,workspace_currency:'ARS',slug:'gera',atrio_id:advisor}),blocked:async()=>blocked},
  });
  return {handler,calls};
}
test('prewarm validates scope and reserves without a name or credentials',async()=>{
  const {handler,calls}=setup();const response=await handler(request());assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{ready:true,gateway_origin:'https://casino.test'});
  assert.deepEqual(calls,[{advisor_id:advisor,advisor_slug:'gera',device_id:device,landing_id:landing,target_provider:'rey_de_ases'}]);
  assert.equal(response.headers.get('set-cookie'),null);
});

test('an existing linked account is recovered without asking for another name or creating one',async()=>{
  const {handler,calls}=setup('owner',false,true,true);
  const response=await handler(request());
  assert.deepEqual(await response.json(),{ready:true,handoff_url:'https://casino.test/prepare?t=encrypted-existing'});
  assert.equal(calls.length,2);
  assert.equal((calls[1] as {name:string}).name,'Existing player');
  assert.equal((calls[1] as {promo_code:string}).promo_code,'TEST-123456');
});
test('prewarm rejects a different tenant, blocked owner, bad scope, missing identity, CSRF and excessive requests',async()=>{
  for(const [owner,blocked,allowed,status] of [['other',false,true,403],['owner',true,true,403],['owner',false,false,429]] as const){
    const {handler,calls}=setup(owner,blocked,allowed);assert.equal((await handler(request())).status,status);assert.equal(calls.length,0);
  }
  const {handler,calls}=setup();
  assert.equal((await handler(request(body,'https://evil.test'))).status,400);
  assert.equal((await handler(request(body,undefined,false))).status,409);
  assert.equal((await handler(request({...body,advisor_id:client}))).status,403);
  assert.equal((await handler(request({...body,name:'not allowed'}))).status,400);
  assert.equal(calls.length,0);
});

// Execute the generated browser program: parsing a helper file alone would miss
// accidental removal of the warm function when trimming other templates.
test('the generated early runtime remains executable before React hydration', async()=>{
  const {buildTemplate7FastRuntime}=await import('../components/public-landing/template7FastRuntime');
  const {Script}=await import('node:vm');
  const source=buildTemplate7FastRuntime('test',{id:landing,name:'test',layout:{template:7}} as never);
  new Script(source);
  assert.equal((source.match(/function warmTemplate7Entry\(/g)||[]).length,1);
  assert.equal((source.match(/warmTemplate7Entry\(\);/g)||[]).length,1);
});
