// Real client/advisor shells and shared gestures, with isolated HTTP fixtures.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root=fileURLToPath(new URL("../../",import.meta.url)),atrio=path.join(root,"internal-chat");
const require=createRequire(new URL("../frontend/package.json",import.meta.url));
const appRequire=createRequire(path.join(atrio,"package.json"));
const {build}=require("esbuild"),{chromium,webkit}=require(path.join(process.env.APPDATA,"npm/node_modules/playwright"));
const stickerMode=process.argv.includes("--stickers");
const out=new URL(stickerMode?"../.vercel/validation-chat-stickers/":"../.vercel/validation-chat-interactions/",import.meta.url);await mkdir(out,{recursive:true});
const stickerImage=await appRequire("sharp")({create:{width:64,height:64,channels:4,background:{r:130,g:40,b:200,alpha:.5}}}).webp().toBuffer();
const cssPath=path.join(atrio,"src/app/globals.css");
const css=(await appRequire("postcss")([appRequire("@tailwindcss/postcss")({base:atrio})]).process(await readFile(cssPath,"utf8"),{from:cssPath})).css;
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`,player=id(1),advisor=id(2),conversation=id(3);
const date="2026-10-28T12:00:00.000Z";
const contact={id:player,displayName:"Cliente fixture",email:null,phone:null,telegramId:null,lastSeenAt:null,hasPushNotifications:false,notes:null,tags:[],targetProvider:null,providerSkinCode:null,providerUsername:null,providerExternalAccountId:null,platform:"android",appInstalledStatus:"unknown",totalLoadedAmount:0};
const shared={id:conversation,status:"abierto",playerId:player,advisorId:advisor,createdAt:date,updatedAt:date,contact,advisor:{id:advisor,fullName:"Asesor fixture",slug:"fixture"},unreadCount:0,lastMessage:null};
const compiled=await build({absWorkingDir:atrio,tsconfig:path.join(atrio,"tsconfig.json"),stdin:{resolveDir:atrio,loader:"tsx",contents:`
import React from"react";import{createRoot}from"react-dom/client";
import{ClientChatShell}from"./src/components/client-chat-shell";import{AdvisorInboxShell}from"./src/components/advisor-inbox-shell";
const state=window.fixture;
createRoot(document.getElementById("root")).render(state.kind==="client"?<ClientChatShell advisorSlug="fixture" deviceId="fixture-device" embedded embeddedParentOrigin="https://fixture.test" embeddedInitialWalletReady conversationSessionToken="synthetic" widgetTemplate={state.theme} widgetTheme={state.palette} initialMessages={state.messages} quickStarters={[]} session={state.session}/>:<AdvisorInboxShell conversations={[state.conversation]} initialMessagesByConversation={{[state.conversation.id]:state.messages}} loadError={null} profile={state.profile} quickReplies={[]}/>);`},
  bundle:true,write:false,platform:"browser",format:"iife",jsx:"automatic",define:{"process.env":"{}","process.env.NODE_ENV":'"production"',"process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY":"undefined"},plugins:[{name:"fixture-db",setup(build){
    build.onResolve({filter:/app\/dashboard\/(manual-request-actions|player-operations-actions)$/},args=>({path:args.path,namespace:"fixture-actions"}));
    build.onLoad({filter:/.*/,namespace:"fixture-actions"},()=>({loader:"js",contents:`export const loadPendingManualRequestAction=async()=>({ok:true,request:null});export const getConversationManagerAction=async()=>({ok:true,manager:null});export const getPlayerBalanceAction=async()=>({ok:true,balance:null});export const processManualRequestAction=async()=>{throw Error('Financial operations disabled in fixture')};export const completeManualWithdrawalAction=processManualRequestAction;export const dismissManualRequestAction=processManualRequestAction;export const performPlayerOperationAction=processManualRequestAction;`}));
    build.onResolve({filter:/lib\/supabase\/(client|anon)$/},args=>({path:args.path,namespace:"fixture-db"}));
    build.onLoad({filter:/.*/,namespace:"fixture-db"},()=>({loader:"js",contents:`
const result=(op,payload)=>{let promise;const run=()=>promise??=fetch('/fixture-db',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op,...payload})}).then(r=>r.json());const q={then:(...a)=>run().then(...a),maybeSingle:()=>run().then(r=>({...r,data:Array.isArray(r.data)?r.data[0]??null:r.data})),single:()=>run()};for(const name of ['select','eq','in','is','not','order','limit','range','update','insert','delete'])q[name]=(...args)=>{payload[name]=args;return q};return q};
const channel={on(){return this},subscribe(){return this}};
const db={rpc:(name,args)=>result('rpc',{name,args}),from:table=>result('table',{table}),channel:()=>channel,removeChannel:()=>Promise.resolve()};export const createBrowserSupabaseClient=()=>db;export const createAnonSupabaseClient=()=>db;`}));
  }}]});
const checks=[];
for(const [engine,type] of [["Chromium",chromium],["WebKit",webkit]]){
  const browser=await type.launch({headless:true});
  try{for(const theme of ["atrio","whatsapp","page"])for(const width of [390,1280]){
    if(process.env.CHAT_TEST_FAST && (engine!=="Chromium"||theme!=="atrio"||width!==390))continue;
    let messages=[{id:id(11),conversation_id:conversation,sender:"asesor",type:"texto",content:"*Hola*, te ayudo con tu cuenta",metadata:{},created_at:date,read_at:null,delivered_at:null},
      {id:id(12),conversation_id:conversation,sender:"asesor",type:"texto",content:"Segunda burbuja",metadata:{},created_at:date,read_at:null,delivered_at:null},
      {id:id(13),conversation_id:conversation,sender:"cliente",type:"texto",content:"Quiero consultar algo",metadata:{},created_at:date,read_at:null,delivered_at:null}];
    let serial=20,failNext=false,failStickerSend=true,otherDevice;const errors=[],requests=[],stickerRequests=[];
    const libraries={client:[],advisor:[]};const asset="a".repeat(64);
    const context=await browser.newContext({viewport:{width,height:900},hasTouch:true});
    const palette={code:"fixture",colors:{primary:"#9637c4",primaryHover:"#a748d5",accent:"#e8b6ff",background:"#11001f",surface:"#270538",surfaceAlt:"#31074d",bubble:"#270538",avatar:"#31074d",text:"#ffffff",mutedText:"#d0b4db",border:"#9637c4",success:"#4ade80",danger:"#ef4444"}};
    async function route(route){const url=new URL(route.request().url());
      if(url.hostname!=="fixture.test")return route.fulfill({json:{}});
      if(url.pathname==="/client.js")return route.fulfill({contentType:"application/javascript",body:compiled.outputFiles[0].text});
      if(url.pathname==="/sticker.webp")return route.fulfill({contentType:"image/webp",body:stickerImage});
      if(url.pathname==="/"){
        const kind=url.searchParams.get("kind")||"client";
        if(kind==='host')return route.fulfill({contentType:'text/html',body:`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><iframe src="/?kind=client" style="border:0;width:100vw;height:100dvh"></iframe><script>addEventListener('message',event=>{const frame=document.querySelector('iframe');if(event.origin===location.origin&&event.source===frame.contentWindow&&event.data?.source==='atrio-widget'&&event.data.type==='atrio.widget.maximize')frame.contentWindow.postMessage({source:'reydeases-gateway',type:'gateway.chat.visibility',open:true,maximized:event.data.maximized},location.origin);});</script></body></html>`});
        const fixture={kind,theme,palette,messages,conversation:{...shared,lastMessage:messages.at(-1)},profile:{id:advisor,role:"advisor",fullName:"Asesor fixture",slug:"fixture",status:"disponible"},session:{advisor_id:advisor,advisor_name:"Asesor fixture",advisor_avatar_url:null,advisor_status:"disponible",player_id:player,conversation_id:conversation,player_display_name:"Cliente fixture",player_platform:"android",app_installed_status:"unknown",whatsapp_url:null,telegram_url:null}};
        return route.fulfill({contentType:"text/html",body:`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script>window.fixture=${JSON.stringify(fixture)}</script><script src="/client.js"></script></body></html>`});
      }
      const raw=route.request().postData();const body=raw&&route.request().headers()['content-type']?.includes('application/json')?JSON.parse(raw):{};
      if(url.pathname==="/api/chat/stickers"){
        const kind=route.request().headers().authorization?'client':'advisor',library=libraries[kind];
        if(route.request().method()==='GET')return route.fulfill({json:{stickers:library}});
        const add=()=>{let row=library.find(row=>row.asset===asset);if(!row){row={id:id(kind==='client'?50:51),asset,name:'Sticker',url:'https://fixture.test/sticker.webp',animated:false,favorite:true,lastUsedAt:null};library.push(row);}row.favorite=true;return row;};
        if(route.request().headers()['content-type']?.includes('multipart/form-data')||body.action==='save')return route.fulfill({json:{sticker:add()}});
        if(body.action==='favorite'){const sticker=library.find(row=>row.id===body.stickerId);sticker.favorite=body.favorite;return route.fulfill({json:{sticker}});}
        if(body.action==='send'){
          stickerRequests.push(body);const sticker=library.find(row=>row.id===body.stickerId);let message=messages.find(row=>row.id===body.requestId);
          if(!message){message={id:body.requestId,conversation_id:conversation,sender:kind==='client'?'cliente':'asesor',type:'imagen',content:sticker.url,metadata:{source:'chat_sticker',file_name:'Sticker',mime_type:'image/webp',size:stickerImage.length,sticker:{v:1,asset,animated:false}},created_at:new Date(Date.parse(date)+serial++*1000).toISOString(),delivered_at:null,read_at:null};messages.push(message);sticker.lastUsedAt=message.created_at;}
          if(failStickerSend){failStickerSend=false;return route.fulfill({status:503,json:{error:'No se pudo enviar. Reintentá.'}});}
          return route.fulfill({json:{message,sticker}});
        }
      }
      if(url.pathname==="/api/gateway/chat"){
        if(route.request().method()==="GET")return route.fulfill({json:{messages}});
        if(body.action==="reaction"||body.action==="message"){
          requests.push(body);if(failNext){failNext=false;return route.fulfill({status:503,json:{error:"unavailable"}})}
          const message=interact("client",body.action,body.messageId||body.replyToMessageId,body.emoji,body.content);return route.fulfill({json:{message}});
        }return route.fulfill({json:{ok:true}});
      }
      if(url.pathname==="/fixture-db"){
        const {op,name,args,table}=body;let data=[];
        if(op==="rpc"){
          if(name==="advisor_message_interaction")data=interact("advisor",args.interaction_action,args.target_message_id,args.reaction_emoji,args.message_content);
          if(name==="send_advisor_message")data=[interact("advisor","message",null,null,args.message_content)];
          if(name==="list_advisor_inbox")data=[{conversation_id:conversation,player_id:player,advisor_id:advisor,status:"abierto",created_at:date,updated_at:date,unread_count:0,last_message:messages.at(-1)}];
          if(name==="get_advisor_inbox_pagination")data={page:1,page_size:40,total_count:1,total_unread_count:0,total_pages:1,has_next_page:false,has_previous_page:false};
        }else{
          if(table==="messages")data=messages;
          if(table==="players")data=[{id:player,display_name:contact.displayName,email:null,phone:null,tags:[],platform:"android",app_installed_status:"unknown"}];
          if(table==="profiles")data=[{id:advisor,full_name:"Asesor fixture",slug:"fixture"}];
          if(table==="conversations")data=[{id:conversation,player_provider_account_id:null,provider_skin_code:null}];
        }return route.fulfill({json:{data,error:null}});
      }return route.fulfill({json:{ok:true}});
    }
    function interact(kind,action,target,emoji,content){
      const actor=`${kind}:${kind==="client"?player:advisor}`,sender=kind==="client"?"cliente":"asesor";
      if(action==="reaction"){
        const message=messages.find(m=>m.id===target);message.metadata={...message.metadata,reactions:{...message.metadata.reactions}};
        if(emoji)message.metadata.reactions[actor]={sender,emoji};else delete message.metadata.reactions[actor];return message;
      }
      const source=target&&messages.find(m=>m.id===target);
      const message={id:id(serial++),conversation_id:conversation,sender,type:"texto",content,metadata:source?{reply:{id:source.id,sender:source.sender,type:source.type,text:source.content}}:{},created_at:new Date(Date.parse(date)+serial*1000).toISOString(),delivered_at:null,read_at:null};messages.push(message);return message;
    }
    await context.route("**/*",route);const hostPage=await context.newPage();hostPage.on("pageerror",e=>errors.push(e.message));
    await hostPage.goto("https://fixture.test/?kind=host");const page=hostPage.frames().find(frame=>frame.parentFrame());
    const first=page.locator(`[data-chat-message-id="${id(11)}"]`),second=page.locator(`[data-chat-message-id="${id(12)}"]`);
    try { await second.waitFor({timeout:10000}); } catch(error) { console.log(JSON.stringify({errors,body:(await page.locator('body').innerText()).slice(0,1500)})); throw error; } await page.waitForTimeout(200);
    await page.getByRole('button',{name:'Maximizar chat',exact:true}).click();
    await page.getByRole('button',{name:'Restaurar tamaño del chat',exact:true}).waitFor();
    await page.getByRole('button',{name:'Restaurar tamaño del chat',exact:true}).click();
    await page.getByRole('button',{name:'Maximizar chat',exact:true}).waitFor();
    const gaps=await page.locator('[data-chat-message-row]').evaluateAll(rows=>rows.slice(1).map((el,i)=>Math.round(el.getBoundingClientRect().top-rows[i].getBoundingClientRect().bottom)));
    assert.deepEqual(gaps.slice(0,2),[3,6]);
    await first.evaluate(el=>el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:1,isPrimary:true,pointerType:'touch',clientX:100,clientY:300})));
    await page.getByRole('dialog',{name:'Opciones del mensaje'}).waitFor();
    await first.evaluate(el=>el.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:1,isPrimary:true,pointerType:'touch',clientX:100,clientY:300})));
    failNext=true;await page.getByRole('button',{name:'Reaccionar con ❤️',exact:true}).click();await page.getByRole('alert').filter({hasText:'No se pudo guardar'}).waitFor();
    await page.getByRole('button',{name:'Reaccionar con ❤️',exact:true}).click();
    await first.locator('.chat-message-reactions button[aria-pressed=true]').waitFor();
    // A second real shell sees the persisted client reaction and can add its own.
    const peer=await context.newPage();peer.on('pageerror',e=>errors.push(e.message));await peer.goto('https://fixture.test/?kind=advisor');
    await peer.getByRole('button').filter({hasText:'Cliente fixture'}).first().click();
    const peerFirst=peer.locator(`[data-chat-message-id="${id(11)}"]:visible`);await peerFirst.waitFor();
    await peerFirst.dispatchEvent('contextmenu');await peer.getByRole('button',{name:'Reaccionar con 👍',exact:true}).click();
    await first.locator('.chat-message-reactions button',{hasText:'👍'}).waitFor();
    // Horizontal swipe quotes; vertical movement cancels the gesture without a reply.
    await second.evaluate(el=>{for(const [type,x,y] of [['pointerdown',100,300],['pointermove',103,345],['pointerup',103,345]])el.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:2,isPrimary:true,pointerType:'touch',clientX:x,clientY:y}));});
    assert.equal(await page.locator('.chat-reply-composer').count(),0);
    await second.evaluate(el=>el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:3,isPrimary:true,pointerType:'touch',clientX:100,clientY:300})));
    await second.evaluate(el=>el.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerId:3,isPrimary:true,pointerType:'touch',clientX:165,clientY:302})));
    await page.waitForTimeout(30);
    await second.evaluate(el=>el.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:3,isPrimary:true,pointerType:'touch',clientX:165,clientY:302})));
    await page.locator('.chat-reply-composer').waitFor();
    await page.getByPlaceholder('Escribi un mensaje...').fill('Respuesta citada del cliente');await page.getByRole('button',{name:'Enviar mensaje',exact:true}).click();
    await page.locator('.chat-reply-preview').waitFor();await page.locator('.chat-reply-composer').waitFor({state:'hidden'});
    await peerFirst.dispatchEvent('contextmenu');await peer.getByRole('button',{name:'Responder',exact:true}).click();
    await peer.getByPlaceholder('Escribi un mensaje...').filter({visible:true}).fill('Respuesta citada del asesor');await peer.getByRole('button',{name:'Enviar respuesta',exact:true}).filter({visible:true}).click();
    await page.getByText('Respuesta citada del asesor',{exact:true}).waitFor();
    await first.locator('.chat-message-reactions button',{hasText:'❤️'}).click();await page.waitForFunction(id=>!document.querySelector(`[data-chat-message-id="${id}"]`).querySelector('.chat-message-reactions button[aria-pressed=true]'),id(11));
    await page.waitForLoadState('networkidle');await page.goto(page.url());await page.locator('.chat-reply-preview').first().waitFor();assert.equal(await page.locator('.chat-reply-preview').count(),2);
    assert.equal(await page.locator('.chat-reply-preview a').count(),0,'Quote previews cannot nest links inside buttons');
    assert.equal(await page.locator('.chat-reply-preview strong').filter({hasText:'Hola'}).count(),1,'Quote previews preserve WhatsApp formatting');
    if(stickerMode){
      await page.getByRole('button',{name:'Stickers',exact:true}).click();const picker=page.getByRole('dialog',{name:'Stickers',exact:true});await picker.waitFor();
      await picker.getByRole('tab',{name:'Mis stickers',exact:true}).click();
      await picker.getByLabel('Imagen para sticker').setInputFiles({name:'fixture.webp',mimeType:'image/webp',buffer:stickerImage});
      const send=picker.getByRole('button',{name:'Enviar Sticker',exact:true});await send.waitFor();await send.click();
      await picker.getByRole('alert').filter({hasText:'Reintentá'}).waitFor();await send.click();
      await page.locator('.chat-sticker-message').waitFor();assert.equal(stickerRequests[0].requestId,stickerRequests[1].requestId,'A lost response retries the same send');
      assert.equal(messages.filter(m=>m.metadata?.sticker).length,1,'Retry cannot duplicate a sticker');
      await picker.getByRole('button',{name:'Cerrar stickers',exact:true}).click();
      const received=peer.locator('.chat-sticker-message:visible');await received.waitFor();await received.getByRole('button',{name:'Ver opciones del sticker',exact:true}).click();
      await received.getByRole('button',{name:'Añadir a mis stickers',exact:true}).click();await received.getByRole('button',{name:'Añadido a mis stickers',exact:true}).waitFor();
      await peer.getByRole('button',{name:'Stickers',exact:true}).filter({visible:true}).click();const peerPicker=peer.getByRole('dialog',{name:'Stickers',exact:true}).filter({visible:true});
      await peerPicker.getByRole('tab',{name:'Mis stickers',exact:true}).click();
      try { await peerPicker.getByRole('button',{name:'Enviar Sticker',exact:true}).waitFor({timeout:10000}); } catch(error) { console.log(JSON.stringify({libraries,errors,picker:(await peer.locator('body').innerText()).slice(-1600)})); throw error; }
      await peerPicker.getByRole('button',{name:'Enviar Sticker',exact:true}).click();
      await page.waitForFunction(()=>document.querySelectorAll('.chat-sticker-message').length===2);
      await peerPicker.getByRole('button',{name:'Cerrar stickers',exact:true}).click();
      await page.getByRole('button',{name:'Stickers',exact:true}).click();
      await picker.getByRole('tab',{name:'Recientes',exact:true}).click();await picker.getByRole('button',{name:'Enviar Sticker',exact:true}).waitFor();
      await picker.getByRole('button',{name:'Quitar de mis stickers',exact:true}).click();await picker.getByRole('tab',{name:'Mis stickers',exact:true}).click();
      await picker.getByText('Añadí tus stickers o guardá los que recibas.',{exact:true}).waitFor();
      await page.waitForLoadState('networkidle');await page.goto(page.url());await page.locator('.chat-sticker-message').first().waitFor();assert.equal(await page.locator('.chat-sticker-message').count(),2);
      await page.getByRole('button',{name:'Stickers',exact:true}).click();await page.getByRole('dialog',{name:'Stickers',exact:true}).getByRole('button',{name:'Enviar Sticker',exact:true}).waitFor();
      assert.equal(await page.locator('.chat-sticker-message').first().evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)');
      assert.equal(libraries.client.length,1);assert.equal(libraries.advisor.length,1);
      otherDevice=await browser.newContext({viewport:{width,height:900}});await otherDevice.route('**/*',route);
      const newPage=await otherDevice.newPage();newPage.on('pageerror',e=>errors.push(e.stack||e.message));await newPage.goto('https://fixture.test/?kind=host');const newFrame=newPage.frames().find(frame=>frame.parentFrame());
      await newFrame.getByRole('button',{name:'Stickers',exact:true}).click();await newFrame.getByRole('dialog',{name:'Stickers',exact:true}).getByRole('button',{name:'Enviar Sticker',exact:true}).waitFor();
    }
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
    if(width===390)await hostPage.screenshot({path:fileURLToPath(new URL(`${engine}-${theme}.png`,out))});
    checks.push({engine,theme,width,realClientAndAdvisorShells:true,gaps:[3,6],longPress:true,swipeReply:true,verticalScrollPreserved:true,reactionFailureRetry:true,twoParticipants:true,replyReload:true,maximizeRestoreHeader:true,...(stickerMode?{stickerUpload:true,stickerRetryDeduplicated:true,receivedStickerSaved:true,advisorStickerSend:true,recentStickersAfterReload:true,stickerCollectionsIsolated:true,stickersOnAnotherDevice:true}: {})});
    await context.close();await otherDevice?.close();console.log(JSON.stringify(checks.at(-1)));
  }}finally{await browser.close();}
}
await writeFile(new URL('report.json',out),JSON.stringify({checks,productionWrites:0,physicalTouchGesturesVerified:false},null,2));
console.log(JSON.stringify({passed:checks.length,productionWrites:0}));
