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
try { playwright = require("playwright"); }
catch { playwright = require(path.join(process.env.APPDATA, "npm/node_modules/playwright")); }
const focus=process.argv.find(arg=>arg.startsWith("--focus="))?.slice(8);
const onlyEngine=process.argv.find(arg=>arg.startsWith("--engine="))?.slice(9);
const artifact = fileURLToPath(new URL(`../.vercel/validation-panel-responsive${focus?"-"+focus:""}/`, import.meta.url));
const reportName=onlyEngine?`report-${onlyEngine.toLowerCase()}.json`:"report.json";
await mkdir(artifact, { recursive: true });
const provinces=await readFile(path.join(root,"public/argentina-provinces.json"),"utf8");
const routes = ["inicio", "landings", "atrio", "conversiones", "seguimiento", "gerencias", "telefonos", "integraciones", "notificaciones", "plan", "whatsapp-cloud-api", "whatsapp-cloud-api/configuracion", "whatsapp-cloud-api/contactos", "whatsapp-cloud-api/inbox", "whatsapp-cloud-api/logs"];
const pageImports = routes.flatMap((route, i) => ["dashboard", "admin"].map(mode => `import P_${mode}_${i} from "./app/(panel)/${mode}/${route}/page";`)).join("\n");
const entries = routes.flatMap((route, i) => ["dashboard", "admin"].map(mode => `"/${mode}/${route}":P_${mode}_${i}`)).join(",");
const extraRoutes = {
  "/dashboard/promociones":"dashboard/promociones",
  "/dashboard/landing/fixture/editar":"dashboard/landing/[id]/editar",
  "/admin/landings/fixture/editar":"admin/landings/[id]/editar",
  "/admin/clientes":"admin/clientes",
  "/admin/clientes/nuevo":"admin/clientes/nuevo",
  "/admin/clientes/fixture/administrar":"admin/clientes/[id]/administrar",
  "/admin/clientes/fixture/landings":"admin/clientes/[id]/landings",
  "/admin/settings":"admin/settings",
  "/admin/tests":"admin/tests",
  "/admin/documentacion":"admin/documentacion",
};
const mocks = {
  navigation: `const router={push(){},replace(){},refresh(){},prefetch(){}},search=new URLSearchParams(location.search),params={id:"fixture"};export const useRouter=()=>router; export const usePathname=()=>location.pathname; export const useSearchParams=()=>search; export const useParams=()=>params;`,
  link: `import React from "react";export default function Link({href,prefetch,...props}){return <a href={href} {...props}/>}`,
  dynamic: `import React,{lazy,Suspense}from"react";export default function dynamic(loader,options={}){const C=lazy(async()=>{const m=await loader();return typeof m==="function"?{default:m}:m});return function Dynamic(props){const F=options.loading;return <Suspense fallback={F?<F/>:null}><C {...props}/></Suspense>}}`,
  supabase: `
    const user={id:"fixture-user",email:"responsive@example.test"};
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
    import{DEFAULT_CONFIG}from"./lib/landing/mocks";
    ${pageImports}
    ${Object.values(extraRoutes).map((route,i)=>`import E_${i} from "./app/(panel)/${route}/page";`).join("\n")}
    const pages={${entries},${Object.keys(extraRoutes).map((route,i)=>`${JSON.stringify(route)}:E_${i}`).join(",")}};
    const now=new Date().toISOString();
    const rows=generateDemoConversions(12).map((r,i)=>({...r,id:i+1,created_at:now,contact_date:now,lead_date:now,purchase_date:now,currency:"ARS",workspace_currency:"ARS"}));
    const landing={id:"fixture",user_id:"fixture-user",workspace_currency:"ARS",name:"Landing de prueba con un nombre largo",landing_tag:"prueba",comment:"",config:{...DEFAULT_CONFIG,template:"template7",targetProvider:"ganamos_net"}};
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
const checks = [], failures = [];
const audit = async (page, label) => {
  const result = await page.evaluate(() => {
    const width = innerWidth;
    const main = document.querySelector("main") || document.querySelector(".panel-shell");
    const bounds = main?.getBoundingClientRect();
    const escaped = [...(main?.querySelectorAll("*") || [])].filter(el => {
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height || getComputedStyle(el).position === "fixed") return false;
      if (rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1) return false;
      for (let parent = el.parentElement; parent && parent !== main; parent = parent.parentElement) {
        if (/(auto|scroll)/.test(getComputedStyle(parent).overflowX)) return false;
      }
      return true;
    }).map(el => ({ tag: el.tagName, classes: el.className, text: el.textContent?.slice(0,80), width: Math.round(el.getBoundingClientRect().width) })).slice(0,12);
    const tabs = document.querySelector('[aria-label="Secciones de conversiones"]');
    const scroll = tabs && { client: tabs.clientWidth, scroll: tabs.scrollWidth, scrollbar: getComputedStyle(tabs).scrollbarWidth };
    return { width, documentWidth: document.documentElement.scrollWidth, heading:main?.querySelector("h1")?.textContent, text:main?.textContent?.slice(0,240), escaped, scroll };
  });
  result.viewportWidth=page.viewportSize().width;
  checks.push({ label, ...result });
  if (result.documentWidth > result.viewportWidth + 1 || result.escaped.length) failures.push({ label, ...result });
};
for (const [engine, type] of [["Chromium", playwright.chromium], ["WebKit", playwright.webkit]]) {
  if(onlyEngine&&engine!==onlyEngine)continue;
  const browser = await type.launch({ headless: true });
  try {
    const widths = engine === "Chromium" ? [320,390,768,1024,1366] : [390];
    for (const width of widths) {
      const page = await browser.newPage({ viewport: { width, height: 844 },isMobile:width<768,hasTouch:width<=1024 });
      page.setDefaultTimeout(15000);
      const errors = [];
      page.on("pageerror", error => errors.push(String(error)));
      await page.route("**/*", route => {
        const req = route.request();
        if (req.isNavigationRequest()) return route.fulfill({ contentType: "text/html", body: html });
        if(new URL(req.url()).pathname==="/argentina-provinces.json")return route.fulfill({contentType:"application/json",body:provinces});
        if (new URL(req.url()).pathname === "/api/atrio/manager-destinations") return route.fulfill({json:{advisors:[{
          id:"11111111-1111-4111-8111-111111111111",slug:"asesor-de-prueba",name:"Asesor con nombre extenso",connections:[1,2].map(i=>({connection_id:"connection-"+i,advisor_id:"11111111-1111-4111-8111-111111111111",advisor_slug:"asesor-de-prueba",advisor_name:"Asesor con nombre extenso",manager_id:1040+i,agency_id:278,agency_name:"Gerencia de prueba",target_provider:"ganamos_net",manager_type:i===1?"mkt":"full",active:true,usage_count:32,chats_started:21,messages_received:42}))
        }],configuration:null}});
        return route.fulfill({ json: { ok:true,clients:[],advisors:[],managers:[],bots:[],data:[] } });
      });
      for (const route of ["/login", ...routes.flatMap(r => ["/dashboard/"+r,"/admin/"+r]),...Object.keys(extraRoutes)].filter(route=>!focus||route.includes(focus))) {
        await page.goto("https://fixture.test" + route);
        await page.locator(".panel-shell").waitFor();
        await page.waitForTimeout(180);
        if (route.endsWith("/editar")) {
          await page.getByRole("button",{name:/^Redirección/}).waitFor();
          await page.getByRole("button",{name:/^Redirección/}).click();
          await page.waitForTimeout(90);
          // Focused editor checks also inspect the remaining expandable forms.
          if (focus==="editar") {
            for (let i=0;i<25;i++) {
              const closed=page.locator('main section > button[aria-expanded="false"]');
              if (!await closed.count()) break;
              await closed.first().click();
            }
          }
        }
        await audit(page, `${engine} ${width} ${route}`);
        if (route.endsWith("/conversiones")) {
          const scroll = await page.getByRole("tablist").evaluate(el=>{el.scrollLeft=el.scrollWidth;const result={width:el.clientWidth,content:el.scrollWidth,moved:el.scrollLeft,scrollbar:getComputedStyle(el).scrollbarWidth};el.scrollLeft=0;return result});
          if (!process.argv.includes("--audit")) {
            assert.equal(scroll.scrollbar,"none");
            if (scroll.content>scroll.width) assert.ok(scroll.moved>0,"Conversion tabs must scroll");
          }
          const labels=await page.getByRole("tab").allTextContents();
          for (const label of labels.filter(label=>label!=="Funnel")) {
            try {
              await page.getByRole("tab", {name:label,exact:true}).click({force:process.argv.includes("--audit")});
            } catch(error) {
              await writeFile(path.join(artifact,"interaction-error.json"),JSON.stringify({engine,width,route,label,errors,body:await page.locator("body").innerText(),url:page.url()},null,2));
              await page.screenshot({path:path.join(artifact,"interaction-error.png"),fullPage:true});
              throw error;
            }
            await page.waitForTimeout(90);
            await audit(page, `${engine} ${width} ${route} ${label}`);
          }
          await page.getByRole("tab",{name:"Tabla",exact:true}).click();
          const tableScrolls=await page.locator("main .overflow-x-auto").evaluateAll(els=>els.filter(el=>el.querySelector("table")).map(el=>{el.scrollLeft=el.scrollWidth;const result={width:el.clientWidth,content:el.scrollWidth,moved:el.scrollLeft,scrollbar:getComputedStyle(el).scrollbarWidth};el.scrollLeft=0;return result}));
          if (!process.argv.includes("--audit")) for (const s of tableScrolls) {
            assert.equal(s.scrollbar,"none");if(s.content>s.width)assert.ok(s.moved>0,"Conversion table must scroll");
          }
          checks.push({label:`${engine} ${width} ${route} horizontal controls`,scroll,tableScrolls});
        }
        if (route.endsWith("/atrio")) {
          await page.getByRole("button",{name:/agregar asesor/i}).click();
          await audit(page,`${engine} ${width} ${route} advisor modal`);
          await page.keyboard.press("Escape");
        }
        if (route === "/login") {
          await page.locator("#email").focus();
          checks.push({label:`${engine} ${width} login focus`,fontSize:await page.locator("#email").evaluate(el=>getComputedStyle(el).fontSize),scale:await page.evaluate(()=>visualViewport.scale)});
          if (!process.argv.includes("--audit") && width < 1024) assert.ok(parseFloat(await page.locator("#email").evaluate(el=>getComputedStyle(el).fontSize))>=16);
        }
        if (engine === "Chromium" && width === 390 && ["/login","/dashboard/conversiones","/dashboard/atrio"].includes(route)) await page.screenshot({ path:path.join(artifact,route.replaceAll("/","_")+".png"),fullPage:true });
      }
      if (errors.length) failures.push({label:`${engine} ${width} runtime`,errors:[...new Set(errors)]});
      await writeFile(path.join(artifact,reportName),JSON.stringify({checks,failures},null,2)+"\n");
      console.log(JSON.stringify({engine,width,checks:checks.length,failures:failures.length}));
      await page.close();
    }
  } finally { await browser.close(); }
}
await writeFile(path.join(artifact,reportName),JSON.stringify({at:new Date().toISOString(),fixtureOnly:true,checks,failures},null,2)+"\n");
console.log(JSON.stringify({checks:checks.length,failures:failures.length,report:path.join(artifact,reportName)}));
if (!process.argv.includes("--audit")) assert.equal(failures.length,0,"Responsive regressions: see report.json");
