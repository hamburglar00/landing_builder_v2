/* eslint-disable @typescript-eslint/no-explicit-any -- Execute the actual two-repository boundary with isolated fixtures. */
import assert from "node:assert/strict";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { loadApi2Inbox,loadAtrioInbox } from "./atrio-inbox-local/source-loader";
import { InboxFixture,ids,type Row } from "./atrio-inbox-local/fixture";
import { LocalHttp } from "./template7-local-flow/local-http";

async function main() {
  const arg=process.argv.indexOf("--api2-repo");assert.ok(arg>=0);
  process.env.ATRIO_EXTERNAL_REQUEST_SECRET="local-confirmed-load-fixture-only";
  process.env.PBADMIN_PLAYER_OPERATIONS_ENABLED="true";
  process.env.OPENAI_API_KEY="local-openai-fixture-only";
  const api2:any=await loadApi2Inbox(path.resolve(process.argv[arg+1]));
  const atrio:any=await loadAtrioInbox(path.resolve(process.cwd(),"../../internal-chat"));
  const http=new LocalHttp(),checks:string[]=[],proofs=new Map<string,Row>(),events:Row[]=[];
  const builderClient="e000376d-b56e-452b-ad17-63f45d41658c";
  const advisorToken="atrio-confirmed-local-token-000000000000";
  let fixture:InboxFixture,controller:any,builderFail=false,contextUnavailable=false;
  function reset() {
    fixture=new InboxFixture(api2,atrio.encryptExternalSecret);
    fixture.manager.atrioToken=advisorToken;
    fixture.db.tables.get("integration_permissions")!.find(row=>row.profile_id===ids.advisor)!.config.encryptedAtrioToken=atrio.encryptExternalSecret(advisorToken);
    (globalThis as Row).__ATRIO_INBOX_LOCAL__=fixture;
    Object.assign(fixture.contact,{landing_atrio_id:builderClient,landing_promo_code:"LAND-12345678",device_id:"fixture-device"});
    Object.assign(fixture.contact,{email:"client@example.test",phone_e164:"+5491112345678"});
    fixture.db.tables.get("player_provider_accounts")![0].provider_username="local-player";
    fixture.db.tables.get("integration_permissions")!.push(
      {profile_id:ids.admin,integration_key:"meta_tracking",enabled:true,config:{eventUrl:"https://builder.local.test/conversions"}},
      {profile_id:ids.advisor,integration_key:"meta_tracking",enabled:true,config:{}});
    fixture.db.tables.set("receipt_analyses",[]);
    (fixture as any).notifications={find:async(manager:number,source:string,id:number)=>
      manager===fixture.manager.id ? proofs.get(source+":"+id)??null : null};
    controller=new api2.Controller();controller.operationService=new api2.Service({playerService:fixture.playerService,
      credentialService:fixture.credentialService,managerService:fixture.managerService,operationRepository:fixture.operations,platformService:fixture.platformService});
    proofs.clear();events.length=0;builderFail=false;contextUnavailable=false;
  }
  const money=()=>fixture.db.tables.get("pbadmin_confirmed_loads")!.reduce((n,r)=>n+r.amount,0);
  const drain=async()=>{while(fixture.background.length) await fixture.background.shift()!();};
  const perform=(key="local-confirmed-0001",operation="load",amount=1000)=>atrio.performPlayerOperationAction({conversationId:ids.conversation,operation,amount,idempotencyKey:key});
  const payload=(source="automatic",operation_id=42,amount=2000)=>({event:"load.confirmed",status:"succeeded",source,operation_id,
    player_id:ids.player,external_user_id:ids.player,amount,currency:"ARS",confirmed_at:new Date().toISOString()});
  const prove=(source="automatic",id=42,amount=2000)=>proofs.set(source+":"+id,{id,source,source_operation_id:id,
    manager_id:1035,player_id:71,atrio_advisor_id:ids.advisor,atrio_conversation_id:ids.conversation,external_user_id:ids.player,amount,confirmed_at:new Date()});
  const notify=(body:Row=payload(),token=advisorToken)=>fetch("https://atrio.local.test/api/external/pbadmin/loads",{
    method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify(body)});
  async function check(name:string,test:()=>Promise<void>) {reset();await test();await http.idle();checks.push(name);}
  reset();
  await http.serve("https://api2.local.test",async request=>{
    assert.equal(request.headers.get("apikey"),"local-key");assert.equal(request.headers.get("apisecret"),"local-secret");
    const url=new URL(request.url),parts=url.pathname.split("/").filter(Boolean);
    if(url.pathname.startsWith("/api/v2/atrio/webhooks/")) return Response.json({success:true},{status:202});
    let status=200,body:any;const response:Row={status:(code:number)=>{status=code;return response;},send:(v:any)=>{body=v;return response;}};
    const data=request.method==="POST"?await request.json():{};
    const params={atrio_advisor_id:parts[5],external_user_id:parts[7],source:parts[7],operation_id:parts[8]};
    const ctx={request:{param:(key:string)=>(params as Row)[key],all:()=>data},response};
    if(url.pathname.endsWith("/tracking-context") && contextUnavailable) return Response.json({error:"not_available"},{status:404});
    if(url.pathname.endsWith("/tracking-context")) await controller.trackingContextByAdvisor(ctx);
    else if(url.pathname.includes("/loads/")) await controller.confirmedLoadByAdvisor(ctx);
    else if(url.pathname.endsWith("/load")) await controller.loadByAdvisor(ctx);
    else if(url.pathname.endsWith("/withdraw")) await controller.withdrawByAdvisor(ctx);
    else if(url.pathname.endsWith("/balance")) await controller.balanceByAdvisor(ctx);
    else throw new Error("Unknown fixture endpoint");
    if(contextUnavailable && url.pathname.endsWith("/load") && body) {
      for(const key of ["manager_id","agency_id","player_username","confirmed_at"]) delete body[key];
    }
    return Response.json(body,{status});
  });
  await http.serve("https://atrio.local.test",request=>atrio.receiveConfirmedLoad(new atrio.NextRequest(request)));
  await http.serve("https://builder.local.test",async request=>{const data=await request.json();events.push(data);return Response.json({ok:!builderFail},{status:builderFail?503:200});});
  await http.serve("https://api.openai.com",async()=>Response.json({output_text:JSON.stringify({detected:true,amount:999999,currency:"ARS",transaction_id:"receipt-1"})}));
  http.install();
  try {
    await check("a successful manual load counts once and emits the confirmed amount",async()=>{
      assert.equal((await perform()).ok,true);assert.equal(money(),1000);await drain();
      const event=events.find(e=>e.action==="PURCHASE")!;assert.equal(event.amount,1000);
      assert.equal(event.atrio_id,ids.advisor);assert.equal(event.players_id,ids.player);
      assert.equal(event.atrio_client_id,builderClient);assert.equal(event.emitter_platform,"atrio");
      assert.equal(event.manager_id,1035);assert.equal(event.agency_id,21);assert.equal(event.player_username,"local-player");
      assert.equal(event.email,"client@example.test");assert.equal(event.timestamp,Date.parse(event.dateTime));
      assert.equal(event.promo_code_prefix,"LAND");assert.equal(event.promo_code_suffix,"12345678");
      assert.equal("bot_phone" in event,false);assert.equal(event.transaction_id,null);
    });
    await check("an older API2 without tracking context keeps confirmed money and leaves unavailable IDs null",async()=>{
      contextUnavailable=true;assert.equal((await perform()).ok,true);await drain();
      assert.equal(money(),1000);assert.equal(events[0].manager_id,null);assert.equal(events[0].agency_id,null);
    });
    await check("automatic PURCHASE carries frozen API2 bank data and ignores forged callback metadata",async()=>{
      prove();proofs.get("automatic:42")!.tracking_data=JSON.stringify({agency_id:21,player_username:"local-player",
        full_name:"Verified sender",is_valid_receipt:true,transaction_id:"BANK-123",coelsa_id:"COELSA-123",
        receipt_file_url:"https://files.local.test/receipt.png",bot_phone:"ignored",password:"ignored"});
      assert.equal((await notify({...payload(),full_name:"Forged",transaction_id:"Forged",manager_id:999})).status,200);await drain();
      assert.equal(events[0].manager_id,1035);assert.equal(events[0].agency_id,21);
      assert.equal(events[0].full_name,"Verified sender");assert.equal(events[0].transaction_id,"BANK-123");
      assert.equal(events[0].coelsa_id,"COELSA-123");assert.equal(events[0].is_valid_receipt,true);
      assert.equal("bot_phone" in events[0],false);assert.equal("password" in events[0],false);
      assert.equal("receipt_file_url" in events[0],false);
    });
    await check("an idempotent manual replay never increments total or repeats PURCHASE",async()=>{
      await perform();await drain();await perform();await drain();
      assert.equal(money(),1000);assert.equal(events.length,1);assert.equal(fixture.providerCalls.load,1);
    });
    await check("a provider rejection cannot add money or PURCHASE",async()=>{
      fixture.providerReject=true;assert.equal((await perform()).ok,false);await drain();assert.equal(money(),0);assert.equal(events.length,0);
    });
    await check("a withdrawal does not change gross loaded total or emit PURCHASE",async()=>{
      await perform();await drain();assert.equal((await perform("local-withdraw-0001","withdraw",100)).ok,true);await drain();
      assert.equal(money(),1000);assert.equal(events.length,1);
    });
    await check("a tracking outage preserves money and reuses the same event identity",async()=>{
      builderFail=true;await perform();await drain();assert.equal(money(),1000);const eventId=events[0].action_event_id;
      builderFail=false;await atrio.dispatchConfirmedPurchases({advisorId:ids.advisor});assert.equal(money(),1000);assert.equal(events[1].action_event_id,eventId);
      assert.equal(fixture.providerCalls.load,1);
    });
    await check("an advisor token alone cannot forge a credited load",async()=>{
      assert.equal((await notify()).status,409);assert.equal(money(),0);assert.equal(events.length,0);
    });
    await check("an automatic load is verified against API2 before counting",async()=>{
      prove();assert.equal((await notify()).status,200);assert.equal(money(),2000);await drain();assert.equal(events[0].amount,2000);
    });
    await check("API2's actual delivery client uses the authenticated confirmation endpoint",async()=>{
      prove();const client=new api2.AtrioClient({baseUrl:"https://atrio.local.test"});
      assert.equal((await client.sendConfirmedLoad(advisorToken,payload())).ok,true);
      await drain();assert.equal(money(),2000);assert.equal(events.length,1);
    });
    await check("the outbox worker delivers a real confirmation through API2 and Atrio HTTP boundaries",async()=>{
      prove();const row=proofs.get("automatic:42")!;let claimed=false;let completed=false;
      Object.assign((fixture as any).notifications,{claim:async()=>claimed?null:(claimed=true,row),finish:async(_row:Row,delivered:boolean)=>{completed=delivered;}});
      const worker=new api2.AtrioConfirmedLoadDeliveryService();assert.equal(await worker.flush(),1);
      assert.equal(completed,true);await drain();assert.equal(money(),2000);assert.equal(events.length,1);
    });
    await check("a reassigned advisor blocks delivery of an older confirmed load",async()=>{
      prove();const row=proofs.get("automatic:42")!;let claimed=false;let failure:string|null=null;
      Object.assign((fixture as any).notifications,{claim:async()=>claimed?null:(claimed=true,row),finish:async(_row:Row,delivered:boolean,code:string)=>{assert.equal(delivered,false);failure=code;}});
      fixture.manager.atrioAdvisorId=ids.otherAdvisor;
      await new api2.AtrioConfirmedLoadDeliveryService().flush();assert.equal(failure,"manager_binding_changed");assert.equal(money(),0);assert.equal(events.length,0);
    });
    await check("repeated automatic callbacks share one load and one PURCHASE",async()=>{
      prove();await Promise.all([notify(),notify(),notify()]);await drain();assert.equal(money(),2000);assert.equal(events.length,1);
    });
    await check("a player with multiple provider accounts keeps the original credited conversation",async()=>{
      const account=randomUUID(),conversation=randomUUID();
      fixture.db.tables.get("player_provider_accounts")!.push({id:account,player_id:ids.player,target_provider:"multi_skin",provider_external_account_id:ids.player});
      fixture.db.tables.get("conversations")!.push({id:conversation,advisor_id:ids.advisor,player_id:ids.player,player_provider_account_id:account});
      prove();assert.equal((await notify()).status,200);assert.equal(money(),2000);
      assert.equal(fixture.db.tables.get("pbadmin_confirmed_loads")![0].account_id,ids.account);
    });
    await check("a confirmation cannot retarget another conversation",async()=>{
      prove();proofs.get("automatic:42")!.atrio_conversation_id=ids.otherConversation;
      assert.equal((await notify()).status,409);assert.equal(money(),0);
    });
    await check("manual response and API2 callback deduplicate the same operation",async()=>{
      await perform();prove("manual",1,1000);assert.equal((await notify(payload("manual",1,1000))).status,200);await drain();
      assert.equal(money(),1000);assert.equal(events.length,1);
    });
    await check("a modified amount cannot overwrite the API2 proof",async()=>{
      prove();assert.equal((await notify(payload("automatic",42,3000))).status,409);assert.equal(money(),0);
    });
    await check("pending events and another advisor token cannot create money",async()=>{
      prove();assert.equal((await notify({...payload(),status:"processing"})).status,400);
      assert.equal((await notify(payload(),"invalid-token")).status,401);assert.equal(money(),0);
    });
    await check("a receipt still extracts its amount but never creates money or PURCHASE",async()=>{
      const msg={id:randomUUID(),conversation_id:ids.conversation,sender:"cliente",type:"imagen",content:"https://files.local.test/receipt.png"};
      const result=await atrio.handleClientMessageIntegrations({supabase:fixture.db,advisor:fixture.advisor,contact:fixture.contact,conversation:fixture.conversation,message:msg,intent:"carga"});
      assert.ok(result.some((r:Row)=>r.integration==="openai"&&r.status==="analyzed"&&r.analysis.amount===999999));
      assert.equal(money(),0);assert.ok(events.every(e=>e.action!=="PURCHASE"));
      const lead=events.find(e=>e.action==="LEAD");assert.ok(lead);assert.equal(lead.atrio_id,ids.advisor);assert.equal(lead.players_id,ids.player);
      assert.equal(lead.manager_id,1035);assert.equal(lead.agency_id,21);assert.equal(lead.player_username,"local-player");
      assert.equal(lead.amount,0);assert.equal(lead.timestamp,Date.parse(lead.dateTime));assert.equal("bot_phone" in lead,false);
    });
    console.log(JSON.stringify({confirmedLoadIntegrationChecks:checks.length,checks,externalNetwork:0,realMoneyOperations:0},null,2));
  } finally {await http.close();delete (globalThis as Row).__ATRIO_INBOX_LOCAL__;}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
