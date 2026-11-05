// Disposable Auth + PostgreSQL + PostgREST. No project env files or remote services.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { setTimeout as delay } from "node:timers/promises";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "frontend/package.json"));
const { build } = require("esbuild");
const { createClient } = require("@supabase/supabase-js");
const atrio = path.resolve(root, "../internal-chat");
const docker = (...args) =>
  execFileSync("docker", args, {
    encoding: "utf8",
    windowsHide: true,
    timeout: 60000,
  }).trim();
const containers = [];
let network, server, folder, pg;
const secret = "local-test-only-jwt-secret-012345678901234567890";
const jwt = (role) => {
  const encode = (v) => Buffer.from(JSON.stringify(v)).toString("base64url");
  const head = encode({ alg: "HS256", typ: "JWT" }),
    body = encode({
      role,
      iss: "supabase",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
  return `${head}.${body}.${createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url")}`;
};
const sql = (input) =>
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      pg,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-At",
    ],
    { input, encoding: "utf8", windowsHide: true, timeout: 30000 },
  ).trim();
const run = (image, args) => {
  const id = docker(
    "run",
    "--detach",
    "--rm",
    "--pull=never",
    "--network",
    network,
    ...args,
    image,
  );
  containers.push(id);
  return id;
};
const port = (id, p) => {
  const value = docker("port", id, String(p));
  assert.match(value, /^127\.0\.0\.1:\d+$/);
  return Number(value.split(":")[1]);
};
const wait = async (url) => {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {}
    await delay(500);
  }
  throw new Error(`Local fixture did not start: ${new URL(url).pathname}`);
};
let passed = 0;
const test = async (name, work) => {
  await work();
  console.log(`PASS A${++passed} ${name}`);
};
try {
  network = docker(
    "network",
    "create",
    `pbadmin-auth-test-${randomUUID().slice(0, 8)}`,
  );
  pg = run("postgres:17", [
    "--network-alias",
    "pg",
    "--env",
    "POSTGRES_PASSWORD=local-fixture-only",
  ]);
  for (let i = 0; i < 60; i++) {
    try {
      docker("exec", pg, "pg_isready", "-h", "127.0.0.1", "-U", "postgres");
      break;
    } catch {
      await delay(500);
    }
  }
  sql(
    "create schema auth;create role anon;create role authenticated;create role service_role bypassrls;grant usage on schema public,auth to anon,authenticated,service_role;",
  );
  const auth = run("public.ecr.aws/supabase/gotrue:v2.197.0", [
    "--publish",
    "127.0.0.1::9999",
    "--env",
    "GOTRUE_API_HOST=0.0.0.0",
    "--env",
    "GOTRUE_API_PORT=9999",
    "--env",
    "GOTRUE_DB_DRIVER=postgres",
    "--env",
    "GOTRUE_DB_DATABASE_URL=postgres://postgres:local-fixture-only@pg:5432/postgres?search_path=auth",
    "--env",
    "API_EXTERNAL_URL=http://localhost:9999",
    "--env",
    "GOTRUE_SITE_URL=http://localhost:9999",
    "--env",
    `GOTRUE_JWT_SECRET=${secret}`,
    "--env",
    "GOTRUE_JWT_EXP=3600",
    "--env",
    "GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated",
    "--env",
    "GOTRUE_JWT_ADMIN_ROLES=service_role",
    "--env",
    "GOTRUE_DISABLE_SIGNUP=true",
    "--env",
    "GOTRUE_EXTERNAL_EMAIL_ENABLED=true",
    "--env",
    "GOTRUE_MAILER_AUTOCONFIRM=true",
  ]);
  const authUrl = `http://127.0.0.1:${port(auth, 9999)}`;
  await wait(`${authUrl}/health`);
  sql(`create or replace function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
    create or replace function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
    create table profiles(id uuid primary key references auth.users(id),role text not null,nombre text unique,full_name text,email text unique,admin_id uuid,slug text unique,status text,whatsapp_channels jsonb default '[]');
    create table conversions_config(user_id uuid primary key,visible_columns jsonb,funnel_premium_threshold numeric,funnel_premium_thresholds jsonb,tracking_ranking_config jsonb,tracking_ranking_configs jsonb,show_logs boolean,show_ai_assistant boolean,show_promotions boolean,updated_at timestamptz);
    create table client_module_permissions(user_id uuid primary key,show_followups boolean default false,show_whatsapp_api boolean default false,show_notifications boolean default false,show_atrio boolean default false,show_kommo boolean default false,show_chatrace boolean default false);
    create table client_subscriptions(user_id uuid primary key,plan_code text,max_landings int,max_phones int,status text,starts_at timestamptz,expires_at timestamptz,grace_days int);
    create table integration_permissions(profile_id uuid,integration_key text,enabled boolean,config jsonb,created_by uuid,primary key(profile_id,integration_key));
    create table quick_starters(id uuid primary key,advisor_id uuid,label text,message text,message_options jsonb,behavior text,is_active boolean,sort_order int);
    create table quick_replies(id uuid primary key,advisor_id uuid,shortcut text,text text,type text);
    create function fixture_private_rpc() returns text language sql security definer as $$select 'private result'::text$$;
    revoke all on function fixture_private_rpc() from public;grant execute on function fixture_private_rpc() to authenticated;
    create table gerencias(id bigint primary key,gerencia_id bigint unique,nombre text,user_id uuid,workspace_currency text,source_type text,pbadmin_bots jsonb,pbadmin_bots_synced_at timestamptz);
    create table atrio_clients(atrio_id uuid primary key,slug text,user_id uuid,workspace_currency text,pbadmin_bots jsonb,pbadmin_bots_synced_at timestamptz);
    alter table profiles enable row level security;create policy own_profile on profiles for select to authenticated using(id=auth.uid());
    grant select on profiles to authenticated;grant all on all tables in schema public to service_role;`);
  sql(
    await readFile(
      path.join(
        root,
        "supabase/migrations/20260902154745_admin_signup_approvals.sql",
      ),
      "utf8",
    ),
  );
  sql(
    "create trigger fixture_profile after insert on auth.users for each row execute function public.handle_new_user();",
  );
  sql(
    await readFile(
      path.join(
        root,
        "supabase/migrations/20261105152221_pbadmin_extensions_identity.sql",
      ),
      "utf8",
    ),
  );
  const rest = run("public.ecr.aws/supabase/postgrest:v14.3", [
    "--publish",
    "127.0.0.1::3000",
    "--env",
    "PGRST_DB_URI=postgres://postgres:local-fixture-only@pg:5432/postgres",
    "--env",
    "PGRST_DB_SCHEMAS=public",
    "--env",
    "PGRST_DB_ANON_ROLE=anon",
    "--env",
    "PGRST_DB_PRE_REQUEST=public.pbadmin_check_session",
    "--env",
    `PGRST_JWT_SECRET=${secret}`,
  ]);
  const restUrl = `http://127.0.0.1:${port(rest, 3000)}`;
  await wait(restUrl);
  const registrations = [],
    validity = new Map();
  let directory = null;
  server = createServer(async (req, res) => {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks);
      if (req.url === "/api/gateway/bot-directory") {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(directory));
        return;
      }
      if (req.url.startsWith("/api/v1/extensions/")) {
        const data = JSON.parse(body.toString());
        if (req.url.endsWith("/register")) {
          registrations.push(data);
          res.setHeader("Content-Type", "application/json");
          res.end('{"registered":true}');
          return;
        }
        if (req.url.endsWith("/validate")) {
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              valid: validity.get(data.userId) !== false,
              role: data.userId === 202 ? 3 : 0,
            }),
          );
          return;
        }
      }
      const authPath = req.url.startsWith("/auth/v1/");
      const url =
        (authPath ? authUrl : restUrl) +
        req.url.replace(authPath ? "/auth/v1" : "/rest/v1", "");
      const headers = { ...req.headers };
      delete headers.host;
      delete headers.connection;
      delete headers["content-length"];
      const response = await fetch(url, {
        method: req.method,
        headers,
        ...(body.length ? { body } : {}),
        redirect: "manual",
      });
      res.writeHead(
        response.status,
        Object.fromEntries(
          [...response.headers].filter(
            ([key]) =>
              ![
                "content-encoding",
                "content-length",
                "transfer-encoding",
              ].includes(key),
          ),
        ),
      );
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch {
      res.writeHead(500);
      res.end("fixture error");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  Object.assign(process.env, {
    NEXT_PUBLIC_SUPABASE_URL: base,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt("anon"),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: jwt("anon"),
    SUPABASE_SERVICE_ROLE_KEY: jwt("service_role"),
    PBADMIN_EXTENSIONS_ENABLED: "true",
    PBADMIN_EXTENSIONS_SECRET:
      "synthetic-broker-secret-with-more-than-32-characters",
    PBADMIN_EXTENSIONS_API_ORIGIN: base,
    PBADMIN_EXTENSIONS_PANEL_ORIGIN: base,
    PBADMIN_EXTENSIONS_APP_ORIGIN: base,
  });
  process.env.INTERNAL_CHAT_ORIGIN = base;
  process.env.INTERNAL_CHAT_PLAYER_RESOLVE_KEY = "synthetic-local-key";
  folder = await mkdtemp(path.join(tmpdir(), "pbadmin-auth-test-"));
  async function bundle(entry, name, aliasRoot) {
    const outfile = path.join(folder, `${name}.mjs`);
    await build({
      entryPoints: [entry],
      outfile,
      platform: "node",
      format: "esm",
      bundle: true,
      banner: {
        js: `import { createRequire as fixtureRequire } from 'node:module';const require=fixtureRequire(${JSON.stringify(path.join(root, "frontend/package.json"))});`,
      },
      packages: "external",
      alias: {
        "@": aliasRoot,
        "@supabase/supabase-js": require.resolve("@supabase/supabase-js"),
      },
      plugins: [
        {
          name: "server-markers",
          setup(b) {
            b.onResolve({ filter: /^@\/lib\/supabase\/server$/ }, () => ({
              path: "context-session",
              namespace: "fixture",
            }));
            b.onResolve(
              { filter: /^(server-only|next\/headers)$/ },
              (args) => ({ path: args.path, namespace: "fixture" }),
            );
            b.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({
              contents:
                args.path === "context-session"
                  ? "export const createServerSupabaseClient = async () => globalThis.__fixtureSession;"
                  : 'export const cookies = async () => { throw new Error("No request cookies in provider test") };',
              loader: "js",
            }));
          },
        },
      ],
    });
    return import(pathToFileURL(outfile).href);
  }
  const builder = await bundle(
    path.join(root, "frontend/lib/pbadmin/provider.server.ts"),
    "builder",
    path.join(root, "frontend"),
  );
  const accounts = await bundle(
    path.join(root, "frontend/lib/pbadmin/accounts.server.ts"),
    "accounts",
    path.join(root, "frontend"),
  );
  const db = builder.adminDb(),
    authClient = builder.sessionClient();
  const create = async (email) => {
    const r = await db.auth.admin.createUser({
      email,
      password: "Only-local-fixture-password-47",
      email_confirm: true,
    });
    assert.ifError(r.error);
    return r.data.user.id;
  };
  const defaultsId = await create("defaults@example.test");
  await db.from("profiles").insert({ id: defaultsId, role: "admin" });
  process.env.PBADMIN_DEFAULTS_ADMIN_ID = defaultsId;
  const identity = (ownerId, userId = ownerId) => ({
    provider: "builder",
    ownerId,
    userId,
    role: 0,
    email: `user${userId}@example.test`,
    name: `User ${userId}`,
    ownerName: `Owner ${ownerId}`,
    currency: "ARS",
    accountId: null,
    accountEmail: null,
  });
  let result;
  await test("new Builder creates a client with normal defaults and an audited native Auth session", async () => {
    try {
      result = await builder.provision(identity(101), "synthetic-grant");
    } catch (error) {
      const check = await db.from("profiles").select("role,nombre");
      console.error("Local profile diagnostic", {
        error: check.error,
        rows: check.data,
        stored: sql("select role,nombre from public.profiles"),
      });
      throw error;
    }
    assert.equal(
      (await authClient.auth.getUser(result.session.access_token)).data.user.id,
      result.uid,
    );
    const profile = await db
      .from("profiles")
      .select("*")
      .eq("id", result.uid)
      .single();
    assert.equal(profile.data.role, "client");
    const defaults = await db
      .from("client_module_permissions")
      .select("*")
      .eq("user_id", result.uid)
      .single();
    assert.equal(defaults.data.show_atrio, false);
    assert.equal(
      (
        await db
          .from("client_subscriptions")
          .select("*")
          .eq("user_id", result.uid)
          .single()
      ).data.max_landings,
      1,
    );
  });
  await test("retry and second administrator keep one workspace and identify each person", async () => {
    const other = await builder.provision(
      identity(101, 102),
      "synthetic-grant",
    );
    assert.equal(other.uid, result.uid);
    const rows = await db
      .from("pbadmin_sessions")
      .select("user_id")
      .eq("owner_id", 101);
    assert.deepEqual(
      new Set(rows.data.map((r) => r.user_id)),
      new Set([101, 102]),
    );
    assert.equal(
      (
        await db
          .from("client_subscriptions")
          .select("*")
          .eq("user_id", result.uid)
      ).data.length,
      1,
    );
  });
  await test("a partial signup resumes the same reserved Auth UUID", async () => {
    sql(
      "alter table client_subscriptions add constraint fixture_fail_plan check (max_landings<>1) not valid;",
    );
    await assert.rejects(builder.provision(identity(105), "synthetic-grant"));
    const reserved = (
      await db
        .from("pbadmin_accounts")
        .select("account_id,ready")
        .eq("owner_id", 105)
        .single()
    ).data;
    assert.equal(reserved.ready, false);
    assert.ok((await db.auth.admin.getUserById(reserved.account_id)).data.user);
    sql("alter table client_subscriptions drop constraint fixture_fail_plan;");
    const resumed = await builder.provision(identity(105), "synthetic-grant");
    assert.equal(resumed.uid, reserved.account_id);
    assert.equal(
      (
        await db
          .from("client_subscriptions")
          .select("*")
          .eq("user_id", resumed.uid)
      ).data.length,
      1,
    );
  });
  await test("future module defaults apply automatically only to new clients", async () => {
    sql(
      "alter table client_module_permissions alter column show_atrio set default true;",
    );
    const fresh = await builder.provision(identity(106), "synthetic-grant");
    assert.equal(
      (
        await db
          .from("client_module_permissions")
          .select("show_atrio")
          .eq("user_id", fresh.uid)
          .single()
      ).data.show_atrio,
      true,
    );
    assert.equal(
      (
        await db
          .from("client_module_permissions")
          .select("show_atrio")
          .eq("user_id", result.uid)
          .single()
      ).data.show_atrio,
      false,
    );
  });
  const sync = await bundle(
    path.join(root, "frontend/lib/pbadmin/sync.server.ts"),
    "sync",
    path.join(root, "frontend"),
  );
  const bot = {
    manager_id: 9001,
    name: "Bot one",
    agency_id: 501,
    owner_id: 101,
    channel: "whatsapp",
    role: "mkt",
    active: true,
    phone: "5491111111111",
    advisor_id: null,
    advisor_slug: null,
  };
  directory = {
    scope: { kind: "owner", id: 101 },
    agencies: [
      { agency_id: 501, name: "Agency one", platform: 7, bots: [bot] },
    ],
    unassigned: [],
    advisors: [],
  };
  await test("initial import and edits update metadata without replacing landing configuration", async () => {
    assert.equal((await sync.syncBuilder(101, result.uid)).complete, true);
    await db
      .from("gerencias")
      .update({ nombre: "Custom display" })
      .eq("id", 501);
    bot.name = "Edited in PBAdmin";
    bot.active = false;
    assert.equal((await sync.syncBuilder(101, result.uid)).complete, true);
    const row = (await db.from("gerencias").select("*").eq("id", 501).single())
      .data;
    assert.equal(row.nombre, "Custom display");
    assert.equal(row.pbadmin_bots[0].name, "Edited in PBAdmin");
    assert.equal(row.pbadmin_bots[0].active, false);
  });
  await test("deleted bots clear only their snapshot; the linked landing resource survives", async () => {
    directory.agencies = [];
    await sync.syncBuilder(101, result.uid);
    const row = (await db.from("gerencias").select("*").eq("id", 501).single())
      .data;
    assert.equal(row.nombre, "Custom display");
    assert.deepEqual(row.pbadmin_bots, []);
  });
  await test("batched imports preserve complete advisor inventories without duplicates across currencies", async () => {
    const advisors = Array.from({ length: 201 }, (_, i) => ({
      id: randomUUID(),
      name: `Advisor ${i}`,
      slug: `advisor-${i}`,
    }));
    await db
      .from("atrio_clients")
      .insert({
        atrio_id: advisors[0].id,
        slug: advisors[0].slug,
        user_id: result.uid,
        workspace_currency: "PYG",
      });
    directory.advisors = advisors;
    directory.agencies = advisors.map((advisor, i) => {
      const agencyId = 10000 + i;
      const bots = [
        {
          ...bot,
          manager_id: 20000 + i,
          agency_id: agencyId,
          channel: "atrio",
          phone: null,
          advisor_id: advisor.id,
          advisor_slug: advisor.slug,
        },
      ];
      if (i < 101)
        bots.push({ ...bot, manager_id: 30000 + i, agency_id: agencyId });
      return { agency_id: agencyId, name: `Agency ${i}`, platform: 7, bots };
    });
    directory.agencies[200].bots.push({
      ...directory.agencies[0].bots[0],
      manager_id: 40000,
      agency_id: 10200,
    });
    assert.equal((await sync.syncBuilder(101, result.uid)).complete, true);
    const rows = await db
      .from("atrio_clients")
      .select("*")
      .eq("user_id", result.uid);
    assert.equal(rows.data.length, 201);
    const first = rows.data.find((row) => row.atrio_id === advisors[0].id);
    assert.equal(first.workspace_currency, "PYG");
    assert.deepEqual(
      first.pbadmin_bots.map((b) => b.manager_id),
      [20000, 40000],
    );
    assert.deepEqual(
      first.pbadmin_bots.map((b) => b.agency_name),
      ["Agency 0", "Agency 200"],
    );
    assert.equal(
      (
        await db
          .from("gerencias")
          .select("id")
          .eq("user_id", result.uid)
          .gte("id", 10000)
      ).data.length,
      101,
    );
    directory.agencies[0].bots = directory.agencies[0].bots.filter(
      (b) => b.channel === "atrio",
    );
    assert.equal((await sync.syncBuilder(101, result.uid)).complete, true);
    assert.deepEqual(
      (
        await db
          .from("gerencias")
          .select("pbadmin_bots")
          .eq("id", 10000)
          .single()
      ).data.pbadmin_bots,
      [],
    );
    directory.agencies = [];
    directory.advisors = [];
  });
  await test("transient write failures stay retryable and do not masquerade as ownership conflicts", async () => {
    directory.agencies = [
      {
        agency_id: 602,
        name: "Retry",
        platform: 7,
        bots: [{ ...bot, agency_id: 602 }],
      },
    ];
    sql(
      "alter table gerencias add constraint fixture_retry check (gerencia_id <> 602);",
    );
    try {
      await assert.rejects(
        sync.syncBuilder(101, result.uid),
        /pendientes de sincronizar/,
      );
    } finally {
      sql("alter table gerencias drop constraint fixture_retry;");
    }
    assert.equal((await sync.syncBuilder(101, result.uid)).complete, true);
  });
  await test("cross-workspace conflicts and the excluded Gera test link remain unchanged", async () => {
    await db.from("gerencias").insert({
      id: 601,
      gerencia_id: 601,
      nombre: "Other owner",
      user_id: defaultsId,
      workspace_currency: "ARS",
      source_type: "pbadmin",
    });
    const gera = "19817f1f-a0a4-4cd9-a8a9-d9c6733dda41";
    await db.from("atrio_clients").insert({
      atrio_id: gera,
      slug: "gera",
      user_id: defaultsId,
      workspace_currency: "ARS",
      pbadmin_bots: [{ test: true }],
    });
    directory.agencies = [
      {
        agency_id: 601,
        name: "Conflict",
        platform: 7,
        bots: [{ ...bot, agency_id: 601 }],
      },
    ];
    directory.advisors = [{ id: gera, name: "Gera", slug: "gera" }];
    directory.unassigned = [
      {
        ...bot,
        manager_id: 9002,
        agency_id: null,
        channel: "atrio",
        phone: null,
        advisor_id: gera,
        advisor_slug: "gera",
      },
    ];
    assert.equal((await sync.syncBuilder(101, result.uid)).complete, false);
    assert.equal(
      (await db.from("gerencias").select("user_id").eq("id", 601).single()).data
        .user_id,
      defaultsId,
    );
    assert.deepEqual(
      (
        await db
          .from("atrio_clients")
          .select("pbadmin_bots")
          .eq("atrio_id", gera)
          .single()
      ).data.pbadmin_bots,
      [{ test: true }],
    );
  });
  await test("legacy Builder credentials and existing settings survive linking", async () => {
    const id = await create("legacy@example.test");
    await db.from("profiles").insert({ id, role: "client", nombre: "legacy" });
    await db
      .from("client_subscriptions")
      .insert({ user_id: id, plan_code: "custom", max_landings: 99 });
    const linked = await builder.provision(
      { ...identity(103), accountId: id, accountEmail: "legacy@example.test" },
      "synthetic-grant",
    );
    assert.equal(linked.uid, id);
    assert.equal(
      (
        await builder.sessionClient().auth.signInWithPassword({
          email: "legacy@example.test",
          password: "Only-local-fixture-password-47",
        })
      ).error,
      null,
    );
    assert.equal(
      (
        await db
          .from("client_subscriptions")
          .select("max_landings")
          .eq("user_id", id)
          .single()
      ).data.max_landings,
      99,
    );
  });
  await test("wrong reviewed email cannot take over an existing Builder account", async () => {
    await assert.rejects(
      builder.provision(
        {
          ...identity(104),
          accountId: defaultsId,
          accountEmail: "wrong@example.test",
        },
        "synthetic-grant",
      ),
    );
    assert.equal(
      (await db.from("profiles").select("role").eq("id", defaultsId).single())
        .data.role,
      "admin",
    );
  });
  await test("central revocation blocks native database access for the delegated session", async () => {
    validity.set(101, false);
    await assert.rejects(
      accounts.validateSession(db, "builder", result.session.access_token),
    );
    const scoped = createClient(base, jwt("anon"), {
      global: {
        headers: { Authorization: `Bearer ${result.session.access_token}` },
      },
      auth: { persistSession: false },
    });
    assert.equal(
      (await scoped.from("profiles").select("*")).error?.code,
      "42501",
    );
    assert.equal(
      (await scoped.rpc("fixture_private_rpc")).error?.code,
      "42501",
    );
  });
  sql("drop trigger fixture_profile on auth.users;"); // Atrio has its own explicit profile creation.
  const atrioProvider = await bundle(
    path.join(atrio, "src/lib/pbadmin/provider.server.ts"),
    "atrio",
    path.join(atrio, "src"),
  );
  let atrioAdmin, atrioMarketer;
  await test("marketing can activate first; admin later reuses the administration and gets own advisor", async () => {
    const marketer = await atrioProvider.provision(
      { ...identity(201, 202), provider: "atrio", role: 3 },
      "synthetic-grant",
    );
    const admin = await atrioProvider.provision(
      { ...identity(201, 203), provider: "atrio" },
      "synthetic-grant",
    );
    atrioAdmin = admin;
    atrioMarketer = marketer;
    const marketerProfile = (
      await db
        .from("profiles")
        .select("*")
        .eq("id", marketer.advisorId)
        .single()
    ).data;
    const adminUser = (
      await authClient.auth.getUser(admin.session.access_token)
    ).data.user;
    assert.equal(marketerProfile.admin_id, adminUser.id);
    assert.notEqual(admin.advisorId, marketer.advisorId);
    assert.equal(
      (await db.from("profiles").select("role").eq("id", adminUser.id).single())
        .data.role,
      "admin",
    );
    const token = registrations.at(-1).advisorToken;
    assert.equal(typeof token, "string");
    assert.ok(token.length >= 32);
    const retry = await atrioProvider.provision(
      { ...identity(201, 203), provider: "atrio" },
      "synthetic-grant",
    );
    assert.equal(retry.advisorId, admin.advisorId);
    assert.equal(registrations.at(-1).advisorToken, token);
    assert.equal(
      (
        await db
          .from("quick_starters")
          .select("id")
          .eq("advisor_id", admin.advisorId)
      ).data.length,
      3,
    );
    assert.equal(
      (
        await db
          .from("quick_replies")
          .select("id")
          .eq("advisor_id", admin.advisorId)
      ).data.length,
      2,
    );
  });
  const contextRoute = await bundle(
    path.join(atrio, "src/app/api/pbadmin/context/route.ts"),
    "context",
    path.join(atrio, "src"),
  );
  let currentSession = atrioAdmin.session;
  globalThis.__fixtureSession = {
    auth: {
      getSession: async () => ({ data: { session: currentSession } }),
      setSession: async (value) => {
        currentSession = value;
        return { error: null };
      },
    },
  };
  const switchTo = (to) =>
    contextRoute.POST(
      new Request(base + "/api/pbadmin/context", {
        method: "POST",
        headers: { Origin: base, "Content-Type": "application/json" },
        body: JSON.stringify({ to }),
      }),
    );
  await test("Atrio admin can switch only to their personal advisor and back without a password", async () => {
    assert.equal((await (await contextRoute.GET()).json()).to, "advisor");
    assert.equal((await switchTo("advisor")).status, 200);
    assert.equal(
      (await authClient.auth.getUser(currentSession.access_token)).data.user.id,
      atrioAdmin.advisorId,
    );
    assert.equal((await (await contextRoute.GET()).json()).to, "admin");
    assert.equal((await switchTo("admin")).status, 200);
    assert.equal(
      (await authClient.auth.getUser(currentSession.access_token)).data.user.id,
      (await authClient.auth.getUser(atrioAdmin.session.access_token)).data.user
        .id,
    );
  });
  await test("marketing cannot switch to administration; foreign Origin and reparented advisors rejected", async () => {
    currentSession = atrioMarketer.session;
    assert.equal((await (await contextRoute.GET()).json()).to, null);
    assert.equal((await switchTo("admin")).status, 403);
    currentSession = atrioAdmin.session;
    const cross = await contextRoute.POST(
      new Request(base + "/api/pbadmin/context", {
        method: "POST",
        headers: {
          Origin: "https://foreign.example.invalid",
          "Content-Type": "application/json",
        },
        body: '{"to":"advisor"}',
      }),
    );
    assert.equal(cross.status, 403);
    await db
      .from("profiles")
      .update({ admin_id: defaultsId })
      .eq("id", atrioAdmin.advisorId);
    assert.equal((await switchTo("advisor")).status, 403);
  });
  console.log(`PASS ${passed} actual Auth/PostgreSQL/PostgREST scenarios`);
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  for (const id of containers.reverse()) {
    assert.match(id, /^[a-f0-9]{64}$/);
    try {
      docker("rm", "--force", id);
    } catch {}
  }
  if (network) {
    assert.match(network, /^[a-f0-9]{64}$/);
    docker("network", "rm", network);
  }
  if (folder) {
    assert.ok(
      path
        .resolve(folder)
        .startsWith(path.resolve(tmpdir()) + path.sep + "pbadmin-auth-test-"),
    );
    await rm(folder, { recursive: true, force: true });
  }
}
