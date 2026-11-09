import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
const require = createRequire(
  new URL("../frontend/package.json", import.meta.url),
);
const { chromium, webkit } = require("playwright");
const engineName = process.env.BOTS_TEST_BROWSER || "chromium";
const base = process.env.BUILDER_TEST_URL ?? "http://127.0.0.1:3137";
const browser = await (engineName === "webkit" ? webkit : chromium).launch();
const id = "92000000-0000-4000-8000-000000000001",
  advisor = "92000000-0000-4000-8000-000000000003";
const screenshots = new URL(
  "../docs/validation/bots-redesign-20261109/",
  import.meta.url,
);
await mkdir(screenshots, { recursive: true });
let checks = 0;
async function fixture(width, role = "client", enabled = true, fillers = 0) {
  const context = await browser.newContext({
      viewport: { width, height: 950 },
    }),
    expires = Math.floor(Date.now() / 1000) + 3600;
  const user = {
    id,
    email: "synthetic@example.invalid",
    aud: "authenticated",
    app_metadata: {},
    user_metadata: {},
  };
  const token = [
    Buffer.from("{}").toString("base64url"),
    Buffer.from(JSON.stringify({ sub: id, exp: expires })).toString(
      "base64url",
    ),
    "synthetic",
  ].join(".");
  const bot = {
    manager_id: 99,
    name: "Bot desconectado",
    agency_id: 10,
    owner_id: 2,
    channel: "whatsapp",
    role: "mkt",
    active: false,
    phone: null,
    advisor_id: null,
    advisor_slug: null,
  };
  const groups = [
    {
      id: 10,
      nombre: "Gerencia uno",
      gerencia_id: 10,
      source_type: "pbadmin",
      workspace_currency: "ARS",
      user_id: id,
      pbadmin_bots: [bot],
    },
    {
      id: 20,
      nombre: "Gerencia manual",
      gerencia_id: 20,
      source_type: "manual",
      workspace_currency: "ARS",
      user_id: id,
      pbadmin_bots: [],
    },
  ];
  const clients = [
    {
      id,
      atrio_id: advisor,
      user_id: id,
      workspace_currency: "ARS",
      slug: "gera",
      usage_count: 4,
    },
    {
      id: "92000000-0000-4000-8000-000000000004",
      atrio_id: "92000000-0000-4000-8000-000000000005",
      user_id: id,
      workspace_currency: "ARS",
      slug: "sin-bot",
      usage_count: 0,
      pbadmin_bots: [
        {
          ...bot,
          channel: "atrio",
          manager_id: 2000,
          agency_id: 50,
          agency_name: "Atrio pendiente",
          platform: 6,
          advisor_id: "92000000-0000-4000-8000-000000000005",
          advisor_slug: "sin-bot",
        },
      ],
    },
  ];
  const connection = {
    connection_id: id,
    advisor_id: advisor,
    advisor_slug: "gera",
    advisor_name: "Gera",
    manager_id: 1045,
    agency_id: 10,
    agency_name: "Gerencia uno",
    target_provider: "multi_skin",
    manager_type: "full_carga",
    active: true,
    verified_at: null,
    usage_count: 2,
    chats_started: 3,
    messages_received: 3,
    chats_started_total: 9,
  };
  const directory = {
    advisors: [
      {
        id: advisor,
        slug: "gera",
        name: "Gera",
        connections: [
          connection,
          {
            ...connection,
            connection_id: advisor,
            manager_id: 1046,
            agency_id: 30,
            agency_name: "Solo Atrio",
            active: false,
          },
        ],
      },
    ],
  };
  const phone = {
    id: 1,
    gerencia_id: 10,
    phone: "5493511234567",
    status: "active",
    source_available: true,
    usage_count: 5,
    kind: "mkt",
    assignment_role: "follow_up",
    pbadmin_manager_id: 99,
    comment: "",
    messages_reset_at: null,
    last_seen_at: "2026-11-04T10:00:00Z",
    created_at: "2026-11-04T10:00:00Z",
    updated_at: "2026-11-04T10:00:00Z",
  };
  const phones = [
    phone,
    { ...phone, id: 2, gerencia_id: 20, phone: "5493511234568", pbadmin_manager_id: null },
    { ...phone, id: 3, phone: "5491100000203", assignment_role: "acquisition", pbadmin_manager_id: 100 },
    { ...phone, id: 4, phone: "5491100000204", status: "inactive", source_available: false, assignment_role: "acquisition", pbadmin_manager_id: 100 },
  ];
  for(let i=0;i<fillers;i++)groups.push({id:100+i,nombre:`ZZ Gerencia ${String(i).padStart(2,"0")}`,gerencia_id:100+i,source_type:"pbadmin",workspace_currency:"ARS",user_id:id,pbadmin_bots:[]});
  const offPageClient="92000000-0000-4000-8000-000000000006";
  if(fillers>50){
    const offPageAdvisor="92000000-0000-4000-8000-000000000007";
    clients.push({id:offPageClient,atrio_id:offPageAdvisor,user_id:id,workspace_currency:"ARS",slug:"ultimo",usage_count:0});
    directory.advisors.push({id:offPageAdvisor,slug:"ultimo",name:"Último",connections:[{...connection,connection_id:offPageClient,advisor_id:offPageAdvisor,advisor_slug:"ultimo",manager_id:2099,agency_id:100+fillers-1,agency_name:`ZZ Gerencia ${String(fillers-1).padStart(2,"0")}`} ]});
  }
  let autoReset=false;
  const pageCalls=[];
  function directoryPage(input){
    const rows=groups.map(group=>({...group,atrioBots:[]}));
    const lookup=new Map(rows.filter(group=>group.source_type!=="manual").map(group=>[String(group.gerencia_id),group]));
    let virtual=-1;
    if(input.p_include_atrio)for(const client of clients){
      const live=directory.advisors.find(a=>a.id===client.atrio_id);
      const entries=(live?.connections??[]).map(connection=>({connection}));
      for(const inventory of client.pbadmin_bots??[])if(!entries.some(entry=>entry.connection?.manager_id===inventory.manager_id))entries.push({connection:null,inventory});
      if(!entries.length)entries.push({connection:null});
      for(const entry of entries){
        const agency=entry.connection?.agency_id??entry.inventory?.agency_id;
        const key=String(agency??client.atrio_id);
        let group=lookup.get(key);
        if(!group){group={id:virtual--,virtual:true,uiKey:key,user_id:id,nombre:entry.connection?.agency_name??entry.inventory?.agency_name??client.slug,gerencia_id:agency??null,atrioBots:[],source_type:"pbadmin"};lookup.set(key,group);rows.push(group)}
        group.atrioBots.push({...entry,client,name:live?.name??client.slug});
      }
    }
    const isActive=(group,channel)=>((channel!=="atrio")&&phones.some(phone=>phone.gerencia_id===group.id&&phone.status==="active"&&phone.source_available!==false))||((channel!=="whatsapp")&&group.atrioBots.some(entry=>entry.connection?.active||entry.inventory?.active));
    const counts={all:rows.length,whatsapp:rows.filter(g=>!g.virtual).length,atrio:rows.filter(g=>g.atrioBots.length).length};
    const search=input.p_search.toLowerCase(),digits=search.replace(/\D/g,"");
    const filtered=rows.filter(group=>(input.p_channel!=="whatsapp"||!group.virtual)&&(input.p_channel!=="atrio"||group.atrioBots.length)&&(!input.p_active||isActive(group,input.p_channel))&&(!search||JSON.stringify(group).toLowerCase().includes(search)||(digits&&phones.some(phone=>phone.gerencia_id===group.id&&phone.phone.includes(digits))))).sort((a,b)=>a.nombre.localeCompare(b.nombre));
    const page=Math.min(input.p_page,Math.max(1,Math.ceil(filtered.length/50)));
    const selected=filtered.slice((page-1)*50,page*50);
    const selectedPhones=phones.filter(phone=>selected.some(g=>g.id===phone.gerencia_id));
    pageCalls.push({input,ids:selected.map(g=>g.id)});
    return {groups:selected,phones:selectedPhones,metrics:selectedPhones.some(p=>p.id===1)?[{gerencia_phone_id:1,messages_received:7,messages_received_historical:14,calculated_at:"2026-11-04T10:00:00Z"}]:[],
      total:filtered.length,page,counts,activeCount:rows.filter(g=>isActive(g,input.p_channel)).length,activePhones:phones.filter(p=>p.status==="active"&&p.assignment_role==="acquisition").length,
      inactivePhones:phones.filter(p=>p.status!=="active").length,hasPbadmin:true,projectionPending:0};
  }
  const localCalls = [],
    writes = [],
    errors = [];
  await context.addInitScript(
    ({ session, id }) => {
      localStorage.setItem(
        "sb-fdkjkzpjqfbaavylapun-auth-token",
        JSON.stringify(session),
      );
      localStorage.setItem("constructor_setup_guide_hidden:" + id, "1");
    },
    {
      session: {
        access_token: token,
        refresh_token: "synthetic",
        expires_at: expires,
        expires_in: 3600,
        token_type: "bearer",
        user,
      },
      id,
    },
  );
  await context.route(url => url.origin !== base || url.pathname.startsWith("/api/"), async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      method = request.method();
    const json = (body) =>
      route.fulfill({
        json: body,
        headers: { "access-control-allow-origin": request.headers().origin || base, "access-control-allow-credentials": "true" },
      });
    if (url.origin === base) {
      if(url.pathname==="/api/bots/workspace"){
        const body=request.postDataJSON();localCalls.push({workspaceAction:body.action,...body});
        if(body.action==="gerencias")return json({gerencias:groups});
        if(body.action==="reset_atrio"){localCalls.push({managerAction:"reset",metric:body.metric,clientIds:clients.map(c=>c.id)});return json({ok:true})}
        if(body.action==="delete_inactive"){writes.push({path:"/rest/v1/gerencia_phones",method:"DELETE",filter:"workspace:ARS"});return json({deleted:phones.filter(p=>p.status!=="active").length})}
      }
      if (url.pathname === "/api/atrio/manager-destinations") {
        localCalls.push(url.pathname);
        const body = request.postDataJSON();
        if(body.action==="directory")localCalls.push({managerAction:"directory",clientIds:body.clientIds});
        if (body.action === "reset")
          localCalls.push({ managerAction: "reset", ...body });
        return json({advisors:directory.advisors.filter(a=>clients.some(c=>body.clientIds.includes(c.id)&&c.atrio_id===a.id))});
      }
      if (url.pathname === "/api/bots/import") {
        const body = request.postDataJSON();
        localCalls.push({ ...body });
        if (body.action === "refresh")
          return json({
            gerencias: 0,
            asesores: 0,
            existentes: 1,
            warnings: [],
          });
        if (body.action === "preview")
          return json({
            scope: { kind: body.kind, id: body.id },
            agencies: [
              {
                agency_id: 40,
                name: "Gerencia importada",
                platform: 2,
                bots: [
                  { ...bot, manager_id: 125, agency_id: 40, owner_id: body.id },
                ],
              },
            ],
            unassigned: [],
            advisors: [],
          });
        if (body.action === "import") {
          groups.push({
            id: 40,
            nombre: "Gerencia importada",
            gerencia_id: 40,
            source_type: "pbadmin",
            workspace_currency: "ARS",
            user_id: id,
            pbadmin_bots: [{ ...bot, agency_id: 40, manager_id: 125 }],
          });
          return json({
            gerencias: 1,
            asesores: 0,
            existentes: 0,
            warnings: [],
          });
        }
      }
      if (url.pathname.startsWith("/api/"))
        throw Error("Unapproved local API: " + url.pathname);
      return route.continue();
    }
    if (!url.hostname.endsWith(".supabase.co")) return route.abort();
    if (method === "OPTIONS")
      return route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": request.headers().origin || base,
          "access-control-allow-credentials": "true",
          "access-control-allow-headers": request.headers()["access-control-request-headers"] || "authorization,apikey,content-type,x-client-info,x-supabase-api-version",
          "access-control-allow-methods": "GET,POST,PATCH,DELETE,PUT,OPTIONS",
        },
      });
    if (url.pathname === "/auth/v1/user") return json(user);
    if(url.pathname==="/rest/v1/rpc/read_bots_directory_page")return json(directoryPage(request.postDataJSON()));
    if (url.pathname === "/rest/v1/profiles")
      return json({ id, role, nombre: "synthetic" });
    if (url.pathname === "/rest/v1/client_module_permissions")
      return json({ show_atrio: enabled });
    if (url.pathname === "/rest/v1/client_subscriptions")
      return json({ status: "active", plan_code: "scale", max_phones: 999 });
    if (url.pathname === "/rest/v1/conversions_config") {
      if(method!=="GET"){const body=request.postDataJSON();writes.push({path:url.pathname,method,body});autoReset=body.phone_auto_reset_daily;return json(null)}
      return json({
        user_id: id,
        show_promotions: false,
        phone_auto_reset_daily: autoReset,
      });
    }
    if (url.pathname === "/rest/v1/gerencias") {
      if (method === "GET")
        return json(
          url.searchParams.get("select") === "id"
            ? { id: Math.max(...groups.map((g) => g.id)) }
            : groups,
        );
      const body = request.postDataJSON();
      writes.push({ path: url.pathname, method, body });
      if (method === "PATCH") {
        Object.assign(
          groups.find(
            (g) =>
              g.id === Number(url.searchParams.get("id")?.replace("eq.", "")),
          ),
          body,
        );
        return json(null);
      }
      if (method === "POST") {
        groups.push(body);
        return json(body);
      }
    }
    if (url.pathname === "/rest/v1/gerencia_phones") {
      if(method==="GET")return json(phones);
      const body=request.postDataJSON();writes.push({path:url.pathname,method,body,filter:url.searchParams.get("id")});
      if(method==="PATCH")Object.assign(phones.find(p=>p.id===Number(url.searchParams.get("id")?.replace("eq.",""))),body);
      if(method==="POST")for(const row of body)phones.push({...phone,...row,id:Math.max(...phones.map(p=>p.id))+1,pbadmin_manager_id:null});
      return json(null);
    }
    if (url.pathname === "/rest/v1/phone_metrics")
      return json([
        {
          gerencia_phone_id: 1,
          messages_received: 7,
          messages_received_historical: 14,
          calculated_at: "2026-11-04T10:00:00Z",
        },
      ]);
    if (url.pathname === "/rest/v1/atrio_clients") {
      if(method==="GET")return json(clients);
      const body=request.postDataJSON();writes.push({path:url.pathname,method,body});
      const client=clients.find(c=>c.id===url.searchParams.get("id")?.replace("eq.",""));
      if(method==="PATCH"){Object.assign(client,body);return json(client)}
      return json(null);
    }
    if (url.pathname === "/rest/v1/gerencia_work_groups") return json([]);
    if (["/functions/v1/reset-phone-counters","/functions/v1/reset-phone-messages"].includes(url.pathname)){localCalls.push({path:url.pathname,body:request.postDataJSON()});return json({ok:true})}
    if (url.pathname === "/functions/v1/sync-phones") {
      localCalls.push("sync-phones");
      return json({ plan_cap: null });
    }
    throw Error("Unapproved external request: " + method + " " + url.pathname);
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  return { context, page, localCalls, writes, errors, phones, groups, pageCalls };
}

const row = (page, name) => page.locator('tbody tr[data-gerencia]').filter({ has: page.getByText(name, { exact: true }) });
async function openMenu(page, name) {
  await page.getByText("Cargando página de bots...",{exact:true}).waitFor({state:"hidden"});
  const trigger = page.getByRole("button", { name, exact: true });
  if (await trigger.getAttribute("aria-expanded") !== "true") await trigger.click();
  return page.getByRole("menu", { name, exact: true });
}
async function updateDirectory(page, action) {
  const response=page.waitForResponse(response=>new URL(response.url()).pathname==="/rest/v1/rpc/read_bots_directory_page");
  await action();await response;
  await page.getByText("Cargando página de bots...",{exact:true}).waitFor({state:"hidden"});
}
async function fillSearch(page,value){
  const search=page.getByRole("textbox",{name:"Buscar gerencia, asesor, bot o teléfono",exact:true});
  if(await search.inputValue()===value)return;
  await updateDirectory(page,()=>search.fill(value));
}
async function waitUntil(check) {
  for (let i = 0; i < 80; i++) {
    if (check()) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.ok(check(), "expected simulated request");
}
async function geometry(page, width) {
  const result = await page.getByRole("table", { name: "Bots por gerencia" }).evaluate(table => {
    const headers = [...table.querySelectorAll("th")].map(cell => cell.getBoundingClientRect());
    const overflow = [];
    for (const tr of table.querySelectorAll("tbody tr")) {
      if (tr.cells.length !== 11) continue;
      [...tr.cells].forEach((cell, index) => {
        const bounds = cell.getBoundingClientRect();
        if (Math.abs(bounds.left - headers[index].left) > 1) overflow.push("misaligned cell");
        const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const node = walker.currentNode;
          if (!node.textContent.trim() || node.parentElement.closest(".sr-only")) continue;
          const range = document.createRange(); range.selectNodeContents(node);
          for (const rect of range.getClientRects()) if (rect.right > bounds.right + 1 || rect.left < bounds.left - 1) overflow.push(node.textContent.trim());
        }
      });
    }
    return { headers: headers.length, overflow, page: document.documentElement.scrollWidth, scrollable: table.parentElement.scrollWidth > table.parentElement.clientWidth };
  });
  assert.equal(result.headers, 11);
  assert.deepEqual(result.overflow, [], "all text stays inside its column");
  assert.ok(result.page <= width, "horizontal scroll belongs to table, not page");
  if (width <= 1280) assert.equal(result.scrollable, true);
  checks++;
}

try {
  for (const width of [1440, 1280, 390]) {
    const f = await fixture(width);
    const { page } = f;
    try {
      await page.goto(base + "/dashboard/bots", { timeout: 120000 });
      await page.getByRole("heading", { name: "Redirección", exact: true }).waitFor();
      await row(page, "Solo Atrio").waitFor();
      console.log(`${engineName} ${width}: verifying presentation and current actions`);
      await page.screenshot({ path: new URL(`${engineName}-initial-${width}.png`, screenshots).pathname.replace(/^\/C:/, "C:"), fullPage: true });
      assert.equal(await page.locator('aside nav a[href="/dashboard/bots"]').count(), 1);
      assert.equal(await page.locator("table").count(), 1);
      assert.equal(await page.locator("thead").count(), 1);
      assert.equal(await page.getByText("Métricas de Atrio", { exact: true }).count(), 0);
      assert.equal(await row(page, "Solo Atrio").getByRole("button", { name: "Ver detalle" }).count(), 0, "one Atrio bot stays in one row");
      assert.equal(await row(page, "Solo Atrio").getByText("Bot 1046 · Full Carga", { exact: true }).count(), 1);
      checks++;

      const group = row(page, "Gerencia uno");
      await group.getByText("Gerencia uno", { exact: true }).click();
      await page.getByText("Bot 1045 · Full Carga", { exact: true }).waitFor();
      await page.getByText("Bot desconectado", { exact: true }).waitFor();
      const expanded = group.getByRole("button", { name: "Ver detalle" });
      assert.equal(await expanded.getAttribute("aria-expanded"), "true");
      await geometry(page, width);
      await page.screenshot({ path: new URL(`${engineName}-expanded-${width}.png`, screenshots).pathname.replace(/^\/C:/, "C:"), fullPage: true });
      assert.equal(await page.locator("table select").count(), 0, "usage is text in table");
      await openMenu(page, "Acciones de Gerencia uno");
      assert.equal(await expanded.getAttribute("aria-expanded"), "true", "menu does not toggle row");
      await page.keyboard.press("Escape");
      assert.equal(await page.getByRole("button", { name: "Acciones de Gerencia uno", exact: true }).evaluate(el => el === document.activeElement), true);
      checks++;

      const managed = page.getByRole("row").filter({ hasText: "54 9 3511 23-4567" });
      await managed.getByRole("button", { name: /^Acciones de / }).click();
      assert.equal(await page.getByRole("menuitem", { name: "Cambiar uso…", exact: true }).isDisabled(), true, "managed usage retains PBAdmin ownership");
      await page.keyboard.press("Escape");
      const unavailable = page.getByRole("row").filter({ hasText: "54 9 1100 00-0204" });
      await unavailable.getByRole("button", { name: /^Acciones de / }).click();
      assert.equal(await page.getByRole("menuitem", { name: "Activar teléfono", exact: true }).isDisabled(), true);
      await page.keyboard.press("Escape");
      assert.equal(f.writes.length, 0, "UI navigation never writes");
      checks++;

      await openMenu(page, "Acciones de Gerencia uno");
      await page.getByRole("menuitemradio", { name: "Mensajes", exact: true }).click();
      await waitUntil(() => f.writes.some(write => write.body.fair_criterion === "messages_received"));
      await page.keyboard.press("Escape");
      checks++;

      await openMenu(page, "Acciones de Gerencia uno");
      await page.getByRole("menuitem", { name: "Reiniciar contador…", exact: true }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Cancelar", exact: true }).click();
      assert.equal(f.localCalls.some(call => call.path === "/functions/v1/reset-phone-counters"), false);
      await openMenu(page, "Acciones de Gerencia uno");
      await page.getByRole("menuitem", { name: "Reiniciar contador…", exact: true }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Reiniciar", exact: true }).click();
      await waitUntil(() => f.localCalls.some(call => call.path === "/functions/v1/reset-phone-counters"));
      assert.deepEqual(f.localCalls.find(call => call.path === "/functions/v1/reset-phone-counters").body, { gerencia_id: 10 });
      checks++;

      const search = page.getByRole("textbox", { name: "Buscar gerencia, asesor, bot o teléfono", exact: true });
      await fillSearch(page, "2000");
      await row(page, "Atrio pendiente").getByText("Pendiente de vinculación", { exact: true }).waitFor();
      await openMenu(page, "Acciones de Atrio pendiente");
      assert.equal(await page.getByRole("menuitem", { name: "Abrir chat del bot", exact: true }).count(), 0);
      assert.equal(await page.getByRole("menuitem", { name: "Reiniciar asignaciones del asesor", exact: true }).isDisabled(), true);
      await page.keyboard.press("Escape");
      await fillSearch(page, "1046");
      assert.equal(await row(page, "Solo Atrio").count(), 1);
      assert.equal(await row(page, "Gerencia uno").count(), 0);
      await fillSearch(page, "");
      const channels = page.getByRole("group", { name: "Canal de los bots" });
      await updateDirectory(page,()=>channels.getByRole("button", { name: /^Atrio/ }).click());
      assert.equal(await row(page, "Gerencia manual").count(), 0);
      await updateDirectory(page,()=>channels.getByRole("button", { name: /^WhatsApp/ }).click());
      assert.equal(await row(page, "Solo Atrio").count(), 0);
      await updateDirectory(page,()=>channels.getByRole("button", { name: /^Todos/ }).click());
      await updateDirectory(page,()=>page.getByRole("switch", { name: "Solo activos", exact: true }).click());
      assert.equal(await row(page, "Solo Atrio").count(), 0);
      await updateDirectory(page,()=>page.getByRole("switch", { name: "Solo activos", exact: true }).click());
      checks++;

      await fillSearch(page, "1045");
      await openMenu(page, "Acciones de los bots");
      await page.getByRole("menuitem", { name: "Reiniciar asignaciones de Atrio", exact: true }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Reiniciar", exact: true }).click();
      await waitUntil(() => f.localCalls.some(call => call.managerAction === "reset"));
      assert.equal(f.localCalls.find(call => call.managerAction === "reset").clientIds.length, 2, "global scope ignores visual filters");
      await fillSearch(page, "");
      checks++;

      await openMenu(page, "Acciones de los bots");
      const auto = page.getByRole("menuitemcheckbox", { name: /Reinicio automático/ });
      await auto.click();
      await waitUntil(() => f.writes.some(write => write.body.phone_auto_reset_daily === true));
      assert.equal(await auto.getAttribute("aria-checked"), "true");
      await page.keyboard.press("End");
      assert.equal(await page.getByRole("menuitem", { name: "Borrar teléfonos inactivos…", exact: true }).evaluate(el => el === document.activeElement), true);
      await page.keyboard.press("Escape");
      await openMenu(page, "Acciones de los bots");
      await page.getByRole("menuitem", { name: "Borrar teléfonos inactivos…", exact: true }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Cancelar", exact: true }).click();
      assert.equal(f.writes.some(write => write.method === "DELETE"), false);
      checks++;

      await fillSearch(page, "Gerencia manual");
      await openMenu(page, "Acciones de Gerencia manual");
      await page.getByRole("menuitem", { name: "Cambiar uso…", exact: true }).click();
      await page.getByRole("dialog").getByLabel("Uso", { exact: true }).selectOption("acquisition");
      await waitUntil(() => f.writes.some(write => write.body.assignment_role === "acquisition"));
      await page.getByRole("dialog").getByRole("button", { name: "Cerrar", exact: true }).click();
      await openMenu(page, "Acciones de Gerencia manual");
      await page.getByRole("menuitem", { name: "Editar comentario…", exact: true }).click();
      await page.getByRole("dialog").getByLabel("Comentario", { exact: true }).fill("Comentario conservado");
      await page.getByRole("dialog").getByRole("button", { name: "Cerrar", exact: true }).click();
      await waitUntil(() => f.writes.some(write => write.body.comment === "Comentario conservado"));
      await openMenu(page, "Acciones de Gerencia manual");
      await page.getByRole("menuitem", { name: "Desactivar teléfono", exact: true }).click();
      await waitUntil(() => f.writes.some(write => write.body.status === "inactive"));
      checks++;

      await openMenu(page, "Acciones de Gerencia manual");
      await page.getByRole("menuitem", { name: "Añadir teléfonos", exact: true }).click();
      await page.getByPlaceholder("5493511234567", { exact: true }).fill("5491100000999");
      await page.getByRole("button", { name: "Guardar teléfono", exact: true }).click();
      await waitUntil(() => f.writes.some(write => Array.isArray(write.body) && write.body[0]?.phone === "5491100000999"));
      checks++;

      await fillSearch(page, "Solo Atrio");
      await openMenu(page, "Acciones de Solo Atrio");
      assert.match(await page.getByRole("menuitem", { name: "Abrir chat del bot", exact: true }).getAttribute("href"), /\/gera\/bot\/1046$/);
      await page.getByRole("menuitem", { name: "Editar vínculo", exact: true }).click();
      const slug = page.getByRole("dialog").getByLabel("Slug del asesor", { exact: true });
      await slug.fill("gera-editado");
      await slug.press("End");
      assert.equal(await slug.inputValue(), "gera-editado");
      await page.getByRole("dialog").getByRole("button", { name: "Guardar", exact: true }).click();
      await waitUntil(() => f.writes.some(write => write.body.slug === "gera-editado"));
      await openMenu(page, "Acciones de Solo Atrio");
      await page.getByRole("menuitem", { name: "Quitar asesor", exact: true }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Cancelar", exact: true }).click();
      assert.equal(f.writes.some(write => write.method === "DELETE"), false);
      checks++;

      await fillSearch(page, "");
      await openMenu(page, "Acciones de Gerencia uno");
      await page.getByRole("menuitem", { name: "Administrar gerencia", exact: true }).click();
      await page.getByRole("dialog").getByLabel("Nombre", { exact: true }).fill("Nombre conservado");
      await page.getByRole("dialog").getByRole("button", { name: "Guardar", exact: true }).click();
      await row(page, "Nombre conservado").waitFor();
      assert.equal(f.phones[0].usage_count, 5, "editing agency preserves counters");
      checks++;

      await page.getByRole("button", { name: "Vincular Bots", exact: true }).click();
      await page.getByRole("button", { name: "Vincular mediante", exact: true }).click();
      await page.getByRole("option", { name: "Owner ID · todas sus gerencias", exact: true }).click();
      await page.getByLabel("Owner ID", { exact: true }).fill("200");
      await page.getByRole("button", { name: "Buscar bots", exact: true }).click();
      await page.getByText("Gerencia importada · ID 40").waitFor();
      await page.getByRole("button", { name: "Importar bots", exact: true }).click();
      await row(page, "Gerencia importada").waitFor();
      assert.ok(f.localCalls.some(call => call.action === "import" && call.kind === "owner" && call.id === 200));
      checks++;

      await page.getByRole("button", { name: "Grupos de trabajo", exact: true }).click();
      await page.getByRole("dialog").getByRole("heading", { name: "Grupos de trabajo", exact: true }).first().waitFor();
      await page.getByRole("dialog").getByRole("button", { name: "Cerrar", exact: true }).click();
      await page.getByRole("button", { name: "Sincronizar ahora", exact: true }).click();
      await waitUntil(() => f.localCalls.includes("sync-phones"));
      checks++;

      await page.evaluate(() => { document.querySelector('[aria-label="Directorio de bots, desplazamiento horizontal"]').scrollLeft = 0; });
      await geometry(page, width);
      await page.screenshot({ path: new URL(`${engineName}-page-${width}.png`, screenshots).pathname.replace(/^\/C:/, "C:"), fullPage: true });
      assert.deepEqual(f.errors, [], "screen actions run without JavaScript errors");
      for (const path of ["telefonos", "gerencias", "atrio"]) {
        await page.waitForLoadState("networkidle");
        await page.goto(base + "/dashboard/" + path);
        await page.waitForURL("**/dashboard/bots");
        await page.getByRole("heading", { name: "Redirección", exact: true }).waitFor();
        await page.waitForLoadState("networkidle");
      }
      assert.deepEqual(f.errors, []);
      checks++;
    } catch (error) {
      await page.screenshot({ path: new URL(`${engineName}-failure-${width}.png`, screenshots).pathname.replace(/^\/C:/, "C:"), fullPage: true });
      console.error("Visible dialogs:", await page.getByRole("dialog").allTextContents());
      throw error;
    } finally { await f.context.close(); }
  }

  const pagination = await fixture(390, "client", true, 58);
  try {
    await pagination.page.goto(base + "/dashboard/bots");
    await row(pagination.page, "Solo Atrio").waitFor();
    assert.equal(await pagination.page.locator('tbody tr[data-gerencia]').count(), 50);
    assert.ok(pagination.pageCalls.every(call=>call.input.p_page===1&&call.ids.length<=50),"later pages are never requested eagerly");
    assert.equal(pagination.localCalls.some(call=>call.managerAction==="directory"&&call.clientIds.includes("92000000-0000-4000-8000-000000000006")),false,"off-page Atrio metrics are not requested");
    const firstIds=pagination.pageCalls.at(-1).ids;
    await updateDirectory(pagination.page,()=>pagination.page.getByRole("button", { name: "Página siguiente", exact: true }).click());
    assert.equal(pagination.pageCalls.at(-1).input.p_page,2);
    assert.ok(pagination.pageCalls.at(-1).ids.every(id=>!firstIds.includes(id)));
    assert.equal(pagination.localCalls.some(call=>call.managerAction==="directory"&&call.clientIds.includes("92000000-0000-4000-8000-000000000006")),true,"next-page metrics are requested on demand");
    assert.equal(await pagination.page.getByRole("button", { name: "Página 2", exact: true }).getAttribute("aria-current"), "page");
    await pagination.page.waitForTimeout(1300);
    assert.equal(await pagination.page.getByRole("button", { name: "Página 2", exact: true }).getAttribute("aria-current"), "page", "countdown does not reset pagination");
    await fillSearch(pagination.page, "Gerencia manual");
    await row(pagination.page, "Gerencia manual").waitFor();
    assert.equal(await pagination.page.getByRole("button", { name: "Página 1", exact: true }).getAttribute("aria-current"), "page");
    await fillSearch(pagination.page, "");
    assert.equal(await pagination.page.getByRole("button", { name: "Página 1", exact: true }).getAttribute("aria-current"), "page", "clearing search keeps pagination on the first page");
    checks++;
  } finally { await pagination.context.close(); }

  const actions = await fixture(1440);
  try {
    const { page, localCalls } = actions;
    await page.goto(base + "/dashboard/bots");
    await row(page, "Solo Atrio").waitFor();
    await openMenu(page, "Acciones de Gerencia uno");
    await page.getByRole("menuitem", { name: "Sincronizar", exact: true }).click();
    await waitUntil(() => localCalls.includes("sync-phones"));
    await waitUntil(() => localCalls.some(call => call.action === "refresh" && call.kind === "agency" && call.id === 10));
    checks++;
    for (const [label, path] of [["Reiniciar contadores de WhatsApp", "/functions/v1/reset-phone-counters"], ["Reiniciar mensajes de WhatsApp", "/functions/v1/reset-phone-messages"]]) {
      await openMenu(page, "Acciones de los bots");
      await page.getByRole("menuitem", { name: label, exact: true }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Reiniciar", exact: true }).click();
      await waitUntil(() => localCalls.some(call => call.path === path));
      assert.deepEqual(localCalls.find(call => call.path === path).body, {});
      checks++;
    }
    await openMenu(page, "Acciones de Gerencia uno");
    await page.getByRole("menuitem", { name: "Reiniciar mensajes…", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Reiniciar", exact: true }).click();
    await waitUntil(() => localCalls.some(call => call.path === "/functions/v1/reset-phone-messages" && call.body.gerencia_id === 10));
    checks++;
    for (const [label, metric] of [["Reiniciar asignaciones del asesor", "usage_count"], ["Reiniciar chats del asesor", "messages_received"]]) {
      await openMenu(page, "Acciones de Solo Atrio");
      await page.getByRole("menuitem", { name: label, exact: true }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Reiniciar", exact: true }).click();
      await waitUntil(() => localCalls.some(call => call.managerAction === "reset" && call.metric === metric));
      assert.deepEqual(localCalls.find(call => call.managerAction === "reset" && call.metric === metric).clientIds, [id]);
      checks++;
    }
    await openMenu(page, "Acciones de los bots");
    await page.getByRole("menuitem", { name: "Reiniciar chats de Atrio", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Reiniciar", exact: true }).click();
    await waitUntil(() => localCalls.some(call => call.managerAction === "reset" && call.metric === "messages_received" && call.clientIds.length === 2));
    checks++;
    await openMenu(page, "Acciones de Solo Atrio");
    await page.getByRole("menuitem", { name: "Quitar asesor", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Quitar asesor", exact: true }).click();
    await waitUntil(() => actions.writes.some(write => write.path === "/rest/v1/atrio_clients" && write.method === "DELETE"));
    checks++;
    await openMenu(page, "Acciones de los bots");
    await page.getByRole("menuitem", { name: "Borrar teléfonos inactivos…", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Eliminar teléfonos", exact: true }).click();
    await waitUntil(() => actions.writes.some(write => write.path === "/rest/v1/gerencia_phones" && write.method === "DELETE"));
    assert.equal(actions.writes.find(write => write.path === "/rest/v1/gerencia_phones" && write.method === "DELETE").filter, "workspace:ARS");
    checks++;
    assert.deepEqual(actions.errors, []);
  } finally { await actions.context.close(); }

  for (const [role, enabled] of [["client", false], ["admin", true]]) {
    const f = await fixture(1280, role, enabled);
    try {
      await f.page.goto(`${base}/${role === "admin" ? "admin" : "dashboard"}/bots`);
      await f.page.getByRole("heading", { name: "Redirección", exact: true }).waitFor();
      await row(f.page, "Gerencia uno").waitFor();
      assert.equal(await f.page.getByRole("group", { name: "Canal de los bots" }).count(), enabled ? 1 : 0);
      if (!enabled) assert.equal(f.localCalls.includes("/api/atrio/manager-destinations"), false);
      if (role === "admin") {
        assert.equal(await f.page.getByRole("button", { name: "Grupos de trabajo", exact: true }).count(), 0);
        await openMenu(f.page, "Acciones de los bots");
        assert.equal(await f.page.getByRole("menuitemcheckbox").count(), 0, "admin keeps original automatic reset permission");
      }
      assert.deepEqual(f.errors, []);
      checks++;
    } finally { await f.context.close(); }
  }
  console.log(`Unified Bots redesign (${engineName}): ${checks} checks passed with synthetic services; no production requests.`);
} finally { await browser.close(); }
