// Render actual panel pages with local fixtures. No production sessions or writes.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../frontend/", import.meta.url));
const require = createRequire(path.join(root, "package.json"));
const { build } = require("esbuild");
const postcss = require("postcss");
const tailwindcss = require("@tailwindcss/postcss");
let playwright;
try { playwright = require(path.join(process.env.APPDATA, "npm/node_modules/playwright")); }
catch { playwright = require(path.join(process.env.APPDATA, "npm/node_modules/playwright")); }
const focus=process.argv.find(arg=>arg.startsWith("--focus="))?.slice(8);
const onlyEngine=process.argv.find(arg=>arg.startsWith("--engine="))?.slice(9);
const artifact = fileURLToPath(new URL(`../.vercel/validation-editor-preview-fit${focus?"-"+focus:""}/`, import.meta.url));
const reportName=onlyEngine?`report-${onlyEngine.toLowerCase()}.json`:"report.json";
await mkdir(artifact, { recursive: true });
const provinces=await readFile(path.join(root,"public/argentina-provinces.json"),"utf8");
const routes = [];
const pageImports = routes.flatMap((route, i) => ["dashboard", "admin"].map(mode => `import P_${mode}_${i} from "./app/(panel)/${mode}/${route}/page";`)).join("\n");
const entries = routes.flatMap((route, i) => ["dashboard", "admin"].map(mode => `"/${mode}/${route}":P_${mode}_${i}`)).join(",");
const extraRoutes = {
  "/dashboard/landing/fixture/editar":"dashboard/landing/[id]/editar",
  "/admin/landings/fixture/editar":"admin/landings/[id]/editar",
};
const mocks = {
  navigation: `const router={push(){},replace(){},refresh(){},prefetch(){}},search=new URLSearchParams(location.search),params={id:"fixture"};export const useRouter=()=>router; export const usePathname=()=>location.pathname; export const useSearchParams=()=>search; export const useParams=()=>params;`,
  link: `import React from "react";export default function Link({href,prefetch,...props}){return <a href={href} {...props}/>}`,
  dynamic: `import React,{lazy,Suspense}from"react";export default function dynamic(loader,options={}){const C=lazy(async()=>{const m=await loader();return typeof m==="function"?{default:m}:m});return function Dynamic(props){const F=options.loading;return <Suspense fallback={F?<F/>:null}><C {...props}/></Suspense>}}`,
  supabase: `
    const user={id:"fixture-user",email:"responsive@example.test",app_metadata:{},user_metadata:{}};
    const now=new Date().toISOString();
    const singles={profiles:{id:user.id,nombre:"Workspace de prueba con un nombre extenso",role:location.pathname.startsWith("/admin")?"admin":"client"},client_subscriptions:{plan_code:"scale",status:"active",expires_at:new Date(Date.now()+86400000).toISOString(),max_landings:100,max_phones:100},client_module_permissions:{show_followups:true,show_whatsapp_api:true,show_atrio:true,show_kommo:true,show_chatrace:true},conversions_config:{show_promotions:true,show_inbox:true,show_logs:true}};
    function query(table){let single=false;const q=new Proxy({}, {get(_t,key){if(key==="then")return resolve=>resolve({data:single?(singles[table]??window.fixtureTables?.[table]?.[0]??null):(window.fixtureTables?.[table]??[]),error:null,count:0});return(...args)=>{if(key==="single"||key==="maybeSingle")single=true;return q}}});return q}
    const channel={on(){return channel},subscribe(){return channel},unsubscribe(){}};
    export const supabase={from:query,rpc:()=>Promise.resolve({data:[],error:null}),channel:()=>channel,removeChannel(){},realtime:{setAuth(){}},auth:{getUser:async()=>({data:{user},error:null}),getSession:async()=>({data:{session:{access_token:"fixture",user}},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},functions:{invoke:async()=>({data:{},error:null})}};
  `,
};
const bundle = await build({
  absWorkingDir: root, tsconfig: path.join(root, "tsconfig.json"),
  stdin: { resolveDir: root, loader: "tsx", contents: `
    import React from "react";import{createRoot}from"react-dom/client";
    import Login from "./app/(panel)/login/page";
    import Dashboard from "./app/(panel)/dashboard/layout";
    import Admin from "./app/(panel)/admin/layout";
    import{CurrencyScopeProvider}from"./components/currency/CurrencyScope";
    import{generateDemoConversions}from"./lib/demoData";
    import{switchLandingTemplate}from"./lib/landing/templateVariants";
    import{DEFAULT_CONFIG}from"./lib/landing/mocks";
    ${pageImports}
    ${Object.values(extraRoutes).map((route,i)=>`import E_${i} from "./app/(panel)/${route}/page";`).join("\n")}
    const pages={${Object.keys(extraRoutes).map((route,i)=>`${JSON.stringify(route)}:E_${i}`).join(",")}};
    const now=new Date().toISOString();
    const rows=generateDemoConversions(12).map((r,i)=>({...r,id:i+1,created_at:now,contact_date:now,lead_date:now,purchase_date:now,currency:"ARS",workspace_currency:"ARS"}));
    const landing={id:"fixture",user_id:"fixture-user",workspace_currency:"ARS",name:"Landing de prueba con un nombre largo",landing_tag:"prueba",comment:"",config:{...switchLandingTemplate(DEFAULT_CONFIG,new URLSearchParams(location.search).get("template")||"template9"),targetProvider:new URLSearchParams(location.search).get("provider")||"rey_de_ases",template7WhatsappEnabled:true}};
    const gerencia={id:1,gerencia_id:278,nombre:"Gerencia con nombre extenso",workspace_currency:"ARS",user_id:"fixture-user",source_type:"pbadmin",fair_criterion:"usage_count"};
    window.fixtureTables={settings:[{id:1,url_base:"https://fixture.test",show_client_landing_preview:true}],client_template_permissions:[{template7_enabled:true}],conversions:rows,landings:[landing],gerencias:[gerencia],atrio_clients:[{id:"fixture",user_id:"fixture-user",workspace_currency:"ARS",slug:"asesor-de-prueba",atrio_id:"11111111-1111-4111-8111-111111111111",usage_count:12}],gerencia_phones:[{id:1,gerencia_id:1,phone:"5493516772507",status:"active",source_available:true,usage_count:32,kind:"mkt",last_seen_at:now,created_at:now,updated_at:now,comment:""}],profiles:[{id:"fixture-user",nombre:"Cliente de prueba",email:"responsive@example.test",role:"client"}]};
    localStorage.setItem("constructor_setup_guide_hidden:fixture-user","1");
    const P=pages[location.pathname]||Login, Layout=location.pathname.startsWith("/admin")?Admin:Dashboard;
    createRoot(document.getElementById("root")).render(<CurrencyScopeProvider>{location.pathname==="/login"?<Login/>:<Layout><P/></Layout>}</CurrencyScopeProvider>);
  ` },
  bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
  define: { "process.env": '{}', "process.env.NODE_ENV": '"production"', "process.env.NEXT_PUBLIC_SUPABASE_URL": '"https://fixture.test"', "process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY": '"fixture"' },
  plugins: [{ name: "panel-fixtures", setup(b) {
    // The documentation page reads Markdown on the server; inline the same local
    // content for this fixture while keeping its real JSX and Markdown renderer.
    b.onLoad({filter:/admin[\\/]documentacion[\\/]page\.tsx$/}, async args=>{
      const source=await readFile(args.path,"utf8");
      const content=await readFile(path.join(root,"README.md"),"utf8");
      return {contents:source.replace(/^import (fs|path) from .+;\r?\n/gm,"").replace("async function AdminDocumentacionPage","function AdminDocumentacionPage").replace(/  const readmePath[\s\S]*?  return \(/,`  const content=${JSON.stringify(content)};\n  return (`),loader:"tsx",resolveDir:path.dirname(args.path)};
    });
    for (const [name, pattern] of [["navigation", /^next\/navigation$/], ["link", /^next\/link$/], ["dynamic", /^next\/dynamic$/], ["supabase", /(?:^@\/lib\/supabaseClient$|\/supabaseClient$|^\.\/supabaseClient$)/]]) {
      b.onResolve({ filter: pattern }, () => ({ path: name, namespace: "fixture" }));
    }
    b.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ contents: mocks[args.path], loader: "tsx", resolveDir: root }));
  } }],
});
const cssPath = path.join(root, "app/globals.css");
const css = await postcss([tailwindcss()]).process(await readFile(cssPath, "utf8"), { from: cssPath });
const html = `<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css.css}</style></head><body><div id="root"></div><script>${bundle.outputFiles[0].text.replaceAll("</script", "<\\/script")}</script></body></html>`;
const checks=[];
for (const [engine,type] of [["chromium",playwright.chromium],["webkit",playwright.webkit]]) {
  const browser=await type.launch({headless:true});
  try {
    for (const viewport of [{width:1366,height:635},{width:1366,height:768},{width:1920,height:1080},{width:390,height:844},{width:320,height:568}]) {
      const page=await browser.newPage({viewport});
      page.setDefaultTimeout(15000);
      const errors=[];page.on("pageerror",e=>errors.push(String(e)));
      await page.route("**/*",async route=>{
        const url=new URL(route.request().url());
        if(route.request().isNavigationRequest())return route.fulfill({contentType:"text/html",body:html});
        if(url.pathname.startsWith("/public-assets/template9/"))return route.fulfill({contentType:"image/webp",body:await readFile(path.join(root,"public",url.pathname))});
        if(url.pathname==="/argentina-provinces.json")return route.fulfill({contentType:"application/json",body:provinces});
        return route.fulfill({json:{ok:true,clients:[],advisors:[],managers:[],bots:[],data:[]}});
      });
      for(const mode of ["dashboard/landing","admin/landings"]) {
        const providers=viewport.width===1366&&viewport.height===635?["rey_de_ases","ases_del_norte","ganamos_net","multi_skin"]:["rey_de_ases"];
        for(const provider of providers) {
        for(const template of (provider==="rey_de_ases"&&viewport.width===1366&&viewport.height===635?["template1","template2","template3","template4","template5","template6","template7","template8","template9"]:["template9"])) {
          await page.goto(`https://fixture.test/${mode}/fixture/editar?provider=${provider}&template=${template}`);
          if(template!=="template9") {
            const mockup=page.locator('[data-editor-preview-frame]:visible');await mockup.waitFor();
            await page.waitForTimeout(300);
            const fitting=await mockup.evaluate(el=>{const r=el.getBoundingClientRect(),inner=el.firstElementChild.getBoundingClientRect();return{width:r.width,height:r.height,innerWidth:inner.width,innerHeight:inner.height,scrolling:[...el.querySelectorAll('*')].filter(n=>['auto','scroll'].includes(getComputedStyle(n).overflowY)&&n.scrollHeight>n.clientHeight+1).map(n=>n.className)}});
            assert.ok(fitting.innerWidth<=fitting.width+1&&fitting.innerHeight<=fitting.height+1,JSON.stringify({template,fitting}));
            assert.deepEqual(fitting.scrolling,[],`${template}: no internal scrollers`);
            assert.deepEqual(errors,[]);checks.push({engine,viewport,mode,template,...fitting});continue;
          }
          const iframe=page.locator('iframe[title="Vista previa de Plantilla 9"]:visible');
          try { await iframe.waitFor(); } catch (error) { console.log(JSON.stringify({errors,body:await page.locator("body").innerText()},null,2)); throw error; }
          const frame=await iframe.elementHandle().then(h=>h.contentFrame());
          await frame.locator('.template9__logo').evaluate(img=>img.decode());
          const dims=await iframe.evaluate(el=>{
            const box=el.getBoundingClientRect();let scaled=false;
            for(let node=el;node;node=node.parentElement)if(getComputedStyle(node).transform!=="none")scaled=true;
            return{width:box.width,height:box.height,scaled,documentWidth:document.documentElement.scrollWidth};
          });
          assert.ok(dims.scaled,"Mockup uses one proportional scale");
          assert.ok(dims.width>100 && dims.height<=Math.max(220,Math.min(640,viewport.height-215))+2,JSON.stringify(dims));
          assert.ok(dims.documentWidth<=viewport.width+1,"No horizontal page overflow");
          const form=await frame.locator('.template9__card').evaluate(el=>({width:el.getBoundingClientRect().width,fontSize:parseFloat(getComputedStyle(el.querySelector('input')).fontSize),title:parseFloat(getComputedStyle(el.querySelector('h1')).fontSize),viewport:innerWidth,overflow:document.documentElement.scrollWidth}));
          assert.ok(form.fontSize>=16&&form.title>=22,"Native text sizes");
          assert.ok(form.width>=form.viewport-44,"Form uses viewport width");
          assert.ok(form.overflow<=form.viewport,"No horizontal preview overflow");
          await frame.locator('.template9__cookies').waitFor({state:'visible'});
          const wrap=await frame.locator('.template9__wrap').evaluate(el=>{const f=el.querySelector('.template9__footer').getBoundingClientRect();return{footerBottom:f.bottom,wrapBottom:el.getBoundingClientRect().bottom}});
          assert.ok(wrap.footerBottom<=wrap.wrapBottom+1,"Full legal footer fits without scrolling");
          assert.ok(await frame.locator("html").evaluate(el=>el.scrollHeight<=innerHeight+1),"Whole mockup fits its iframe");
          await frame.locator('.template9__wrap').evaluate(el=>el.scrollTop=0);
          let gap=null;
          if(viewport.width>=1280) {
            const aside=page.locator('aside[aria-label="Vista previa y gerencias asignadas"]');
            await page.evaluate(()=>window.scrollTo(0,0));
            gap=await aside.evaluate(el=>innerHeight-el.getBoundingClientRect().bottom);
            assert.ok(await aside.evaluate(el=>el.scrollHeight<=el.clientHeight+1),"No nested aside scroller");
            const scroller=aside.locator('[aria-label="Contenido de la vista previa"]');
            await scroller.evaluate(el=>el.scrollTop=0);
            if(engine==='chromium'&&viewport.height===635)await aside.screenshot({path:path.join(artifact,`${mode.replaceAll('/','-')}-${provider}.png`)});
            if(engine==='chromium'&&viewport.height===635&&provider==='rey_de_ases'&&mode==='dashboard/landing')await page.screenshot({path:path.join(artifact,'desktop.png')});
            await aside.evaluate(el=>el.scrollTop=el.scrollHeight);
            const bottom=await aside.evaluate(el=>({content:el.lastElementChild.getBoundingClientRect().bottom,bottom:el.getBoundingClientRect().bottom}));
            assert.equal(await aside.locator('section[aria-label="Vista previa"]').getByRole("heading",{name:"RESUMEN DE GERENCIAS ASIGNADAS"}).count(),0,"Summary is outside preview card");
            assert.ok(bottom.content<bottom.bottom-10,"Assignment summary has breathing room");
            await page.evaluate(()=>window.scrollTo(0,400));
            assert.ok(await scroller.evaluate(el=>el.scrollHeight<=el.clientHeight+1),"No internal preview scroll");
          } else {
            await iframe.scrollIntoViewIfNeeded();
            if(engine==='chromium'&&viewport.width===390&&mode==='dashboard/landing')await page.screenshot({path:path.join(artifact,'mobile.png')});
          }
          assert.deepEqual(errors,[]);
          checks.push({engine,mode,viewport,provider,...dims,form,gap});
        }
        }
      }
      console.log(engine,viewport.width,viewport.height,'OK');
      await page.close();
    }
  } finally {await browser.close();}
}
await writeFile(path.join(artifact,'report.json'),JSON.stringify(checks,null,2));
console.log(`PASS: ${checks.length} editor preview checks. ${artifact}`);
