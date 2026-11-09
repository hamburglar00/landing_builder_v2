import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
const require = createRequire(
  new URL("../frontend/package.json", import.meta.url),
);
const { chromium } = require("playwright");
const base = process.env.BUILDER_TEST_URL ?? "http://127.0.0.1:3137";
const browser = await chromium.launch();
const id = "92000000-0000-4000-8000-000000000001",
  advisor = "92000000-0000-4000-8000-000000000003";
const screenshots = new URL(
  "../docs/validation/bots-table-20261107/",
  import.meta.url,
);
await mkdir(screenshots, { recursive: true });
let checks = 0;
async function fixture(width, role = "client", enabled = true) {
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
  await context.route("**/*", async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      method = request.method();
    const json = (body) =>
      route.fulfill({
        json: body,
        headers: { "access-control-allow-origin": "*" },
      });
    if (url.origin === base) {
      if (url.pathname === "/api/atrio/manager-destinations") {
        localCalls.push(url.pathname);
        const body = request.postDataJSON();
        if (body.action === "reset")
          localCalls.push({ managerAction: "reset", ...body });
        return json(directory);
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
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "*",
          "access-control-allow-methods": "*",
        },
      });
    if (url.pathname === "/auth/v1/user") return json(user);
    if (url.pathname === "/rest/v1/profiles")
      return json({ id, role, nombre: "synthetic" });
    if (url.pathname === "/rest/v1/client_module_permissions")
      return json({ show_atrio: enabled });
    if (url.pathname === "/rest/v1/client_subscriptions")
      return json({ status: "active", plan_code: "scale", max_phones: 999 });
    if (url.pathname === "/rest/v1/conversions_config")
      return json({
        user_id: id,
        show_promotions: false,
        phone_auto_reset_daily: false,
      });
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
    if (url.pathname === "/rest/v1/gerencia_phones") return json(phones);
    if (url.pathname === "/rest/v1/phone_metrics")
      return json([
        {
          gerencia_phone_id: 1,
          messages_received: 7,
          messages_received_historical: 14,
          calculated_at: "2026-11-04T10:00:00Z",
        },
      ]);
    if (url.pathname === "/rest/v1/atrio_clients") return json(clients);
    if (url.pathname === "/rest/v1/gerencia_work_groups") return json([]);
    if (url.pathname === "/functions/v1/sync-phones") {
      localCalls.push("sync-phones");
      return json({ plan_cap: null });
    }
    throw Error("Unapproved external request: " + method + " " + url.pathname);
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  return { context, page, localCalls, writes, errors, phones };
}
try {
  for (const width of [1348, 1280, 390]) {
    const f = await fixture(width);
    try {
      await f.page.goto(base + "/dashboard/bots");
      await f.page
        .getByRole("heading", { name: "BOTS", exact: true })
        .waitFor();
      await f.page.getByRole("button", { name: /Solo Atrio/ }).waitFor();
      assert.equal(
        await f.page.locator('aside nav a[href="/dashboard/bots"]').count(),
        1,
      );
      for (const old of ["telefonos", "gerencias", "atrio"])
        assert.equal(
          await f.page.locator(`aside nav a[href="/dashboard/${old}"]`).count(),
          0,
        );
      checks++;
      await f.page
        .getByRole("button", { name: /Gerencia uno \(ID 10\)/ })
        .click();
      await f.page.getByText("Bot 1045 · Full Carga").waitFor();
      await f.page.getByText("Bot desconectado", { exact: false }).waitFor();
      checks++;
      const table = f.page.locator("table").filter({ has: f.page.locator("thead th").getByText("Uso", { exact: true }) });
      await table.getByRole("combobox").first().waitFor();
      assert.equal(await table.getByRole("combobox").count(), 3);
      assert.equal(await table.getByRole("combobox").first().inputValue(), "follow_up");
      for (const select of await table.getByRole("combobox").all()) {
        assert.equal(await select.isDisabled(), true, "PBAdmin retains ownership of managed usage");
      }
      assert.equal(await f.page.getByText(/Se administra en PBAdmin/).count(), 0);
      const geometry = await table.evaluate((element) => {
        const container = element.parentElement;
        const textRects = [];
        for (const cell of element.querySelectorAll("th,td")) {
          const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
          while (walker.nextNode()) {
            const node = walker.currentNode;
            if (!node.textContent.trim() || node.parentElement.closest("select")) continue;
            const range = document.createRange();
            range.selectNodeContents(node);
            textRects.push({ text: node.textContent.trim(), lines: range.getClientRects().length });
          }
        }
        return {
          containerWidth: container.clientWidth,
          tableWidth: element.getBoundingClientRect().width,
          documentWidth: document.documentElement.scrollWidth,
          textRects,
        };
      });
      assert.ok(geometry.textRects.every(({ lines }) => lines <= 1), "phones, states, dates and headers stay on one line: " + JSON.stringify(geometry.textRects));
      assert.ok(geometry.documentWidth <= width, "table overflow stays inside its scroll container");
      if (width >= 1280) {
        assert.ok(geometry.tableWidth <= geometry.containerWidth + 1, "all columns fit desktop: " + JSON.stringify(geometry));
      }
      await table.screenshot({ path: new URL(`table-${width}.png`, screenshots).pathname.replace(/^\/C:/, "C:") });
      checks++;
      const search = f.page.getByRole("textbox", {
        name: "Buscar gerencia, bot, asesor o teléfono",
      });
      await search.fill("2000");
      await f.page.getByRole("button", { name: /Atrio pendiente/ }).click();
      await f.page
        .getByText("Pendiente de vinculación", { exact: true })
        .waitFor();
      assert.equal(
        await f.page
          .getByRole("link", { name: "Abrir chat del bot", exact: true })
          .count(),
        0,
      );
      checks++;
      await search.fill("1046");
      assert.equal(
        await f.page.getByRole("button", { name: /Solo Atrio/ }).count(),
        1,
      );
      assert.equal(
        await f.page
          .getByRole("button", { name: /Gerencia uno \(ID 10\)/ })
          .count(),
        0,
      );
      checks++;
      await search.fill("");
      await f.page
        .getByRole("group", { name: "Canal de los bots" })
        .getByRole("button", { name: "Atrio", exact: true })
        .click();
      assert.equal(
        await f.page.getByRole("button", { name: /Gerencia manual/ }).count(),
        0,
      );
      checks++;
      await f.page
        .getByRole("group", { name: "Canal de los bots" })
        .getByRole("button", { name: "WhatsApp", exact: true })
        .click();
      assert.equal(
        await f.page.getByRole("button", { name: /Solo Atrio/ }).count(),
        0,
      );
      checks++;
      await f.page
        .getByRole("group", { name: "Canal de los bots" })
        .getByRole("button", { name: "Todos", exact: true })
        .click();
      await f.page.getByRole("button", { name: /Solo activas/ }).click();
      assert.equal(
        await f.page.getByRole("button", { name: /Solo Atrio/ }).count(),
        0,
      );
      checks++;
      await f.page.getByRole("button", { name: /Mostrando activas/ }).click();
      await search.fill("1045");
      await f.page.getByText("Métricas de Atrio", { exact: true }).click();
      await f.page
        .getByRole("button", {
          name: "Reiniciar asignaciones de Atrio",
          exact: true,
        })
        .click();
      await f.page
        .getByRole("button", { name: "Reiniciar", exact: true })
        .click();
      assert.equal(
        f.localCalls.find((call) => call.managerAction === "reset").clientIds
          .length,
        2,
        "filters must not reduce a global metric reset",
      );
      checks++;
      await search.fill("");
      await f.page.getByText("Métricas de Atrio", { exact: true }).click();
      await f.page
        .getByRole("button", { name: "Vincular Bots", exact: true })
        .click();
      await f.page.getByRole("button", { name: "Vincular mediante", exact: true }).click();
      await f.page.getByRole("option", { name: "Owner ID · todas sus gerencias", exact: true }).click();
      await f.page.getByLabel("Owner ID", { exact: true }).fill("200");
      await f.page
        .getByRole("button", { name: "Buscar bots", exact: true })
        .click();
      await f.page.getByText("Gerencia importada · ID 40").waitFor();
      await f.page
        .getByRole("button", { name: "Importar bots", exact: true })
        .click();
      await f.page
        .getByRole("button", { name: /Gerencia importada \(ID 40\)/ })
        .waitFor();
      assert.ok(
        f.localCalls.some(
          (call) =>
            call.action === "import" &&
            call.kind === "owner" &&
            call.id === 200,
        ),
      );
      checks++;
      await f.page
        .getByRole("button", { name: /Gerencia uno \(ID 10\)/ })
        .click();
      // Toggle if the original agency remained expanded across the import.
      if (
        !(await f.page
          .getByRole("button", { name: "Administrar gerencia", exact: true })
          .count())
      )
        await f.page
          .getByRole("button", { name: /Gerencia uno \(ID 10\)/ })
          .click();
      await f.page
        .getByRole("button", { name: "Administrar gerencia", exact: true })
        .click();
      await f.page
        .getByLabel("Nombre", { exact: true })
        .fill("Nombre conservado");
      await f.page
        .getByRole("button", { name: "Guardar", exact: true })
        .click();
      await f.page
        .getByRole("button", { name: /Nombre conservado \(ID 10\)/ })
        .waitFor();
      assert.equal(f.phones[0].usage_count, 5);
      assert.deepEqual(f.writes[0].body, {
        nombre: "Nombre conservado",
        source_type: "pbadmin",
        id: 10,
        gerencia_id: 10,
      });
      checks++;
      assert.equal(
        await f.page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        "page fits viewport",
      );
      await f.page.evaluate(() => window.scrollTo(0, 0));
      await f.page.screenshot({
        path: new URL(
          `page-${width}.png`,
          screenshots,
        ).pathname.replace(/^\/C:/, "C:"),
        fullPage: true,
      });
      checks++;
      for (const path of ["telefonos", "gerencias", "atrio"]) {
        await f.page.goto(base + "/dashboard/" + path);
        await f.page.waitForURL("**/dashboard/bots");
      }
      checks++;
      assert.deepEqual(f.errors, []);
    } finally {
      await f.context.close();
    }
  }
  const hidden = await fixture(1280, "client", false);
  try {
    await hidden.page.goto(base + "/dashboard/bots");
    await hidden.page
      .getByRole("heading", { name: "BOTS", exact: true })
      .waitFor();
    assert.equal(
      await hidden.page
        .getByRole("group", { name: "Canal de los bots" })
        .count(),
      0,
    );
    assert.equal(
      hidden.localCalls.includes("/api/atrio/manager-destinations"),
      false,
    );
    checks++;
  } finally {
    await hidden.context.close();
  }
  const admin = await fixture(1280, "admin");
  try {
    await admin.page.goto(base + "/admin/bots");
    await admin.page
      .getByRole("heading", { name: "BOTS", exact: true })
      .waitFor();
    assert.equal(
      await admin.page.locator('aside nav a[href="/admin/bots"]').count(),
      1,
    );
    for (const path of ["telefonos", "gerencias", "atrio"]) {
      assert.equal(
        await admin.page.locator(`aside nav a[href="/admin/${path}"]`).count(),
        0,
      );
      await admin.page.goto(base + "/admin/" + path);
      await admin.page.waitForURL("**/admin/bots");
    }
    checks++;
  } finally {
    await admin.context.close();
  }
  console.log(
    `Unified Bots: ${checks} browser checks passed with synthetic services; no production requests.`,
  );
} finally {
  await browser.close();
}
