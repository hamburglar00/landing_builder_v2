import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync, spawn } from "node:child_process";
import { readFile } from "node:fs/promises";

const container = process.env.BUILDER_DESTINATION_TEST_CONTAINER;

test("destination context: real Postgres tenant/workspace checks, subscription guard and service-only read access", { skip: !container }, async () => {
  assert.match(container, /^builder-destination-validation-[a-z0-9-]+$/);
  const args = ["exec", "-i", container, "psql", "-U", "postgres", "-d", "validation", "-v", "ON_ERROR_STOP=1", "-Atq"];
  const sql = input => execFileSync("docker", args, { input, encoding: "utf8", windowsHide: true, stdio: ["pipe", "pipe", "pipe"] }).trim();
  // Only an isolated container with no network or host database port.
  const info = JSON.parse(execFileSync("docker", ["inspect", container], { encoding: "utf8", windowsHide: true }))[0];
  assert.equal(info.HostConfig.NetworkMode, "none");
  assert.equal(Object.keys(info.HostConfig.PortBindings || {}).length, 0);
  sql(`drop schema public cascade; create schema public;
    do $$begin
      if not exists(select from pg_roles where rolname='service_role') then create role service_role bypassrls;end if;
      if not exists(select from pg_roles where rolname='anon') then create role anon;end if;
      if not exists(select from pg_roles where rolname='authenticated') then create role authenticated;end if;
    end$$;
    grant usage on schema public to anon,authenticated,service_role;
    create table public.landings(id uuid primary key,name text,user_id uuid,workspace_currency text,config jsonb);
    create table public.atrio_clients(id uuid primary key,atrio_id text,slug text,user_id uuid,workspace_currency text);
    create table public.client_subscriptions(user_id uuid primary key,status text,expires_at timestamptz,grace_days integer);
    create index on public.atrio_clients(user_id,workspace_currency);
    alter table public.landings enable row level security;
    alter table public.atrio_clients enable row level security;
    alter table public.client_subscriptions enable row level security;
    grant select on all tables in schema public to service_role;`);
  const subscription = await readFile(new URL("../../supabase/migrations/20260403110000_client_subscriptions_plans.sql", import.meta.url), "utf8");
  const guard = subscription.match(/create or replace function public\.is_client_access_blocked\(p_user_id uuid\)[\s\S]*?\$\$;/)?.[0];
  assert.ok(guard);
  sql(guard);
  sql(await readFile(new URL("../../supabase/migrations/20261020044154_optimize_template7_destination_context.sql", import.meta.url), "utf8"));

  const id = n => `a0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const [owner, foreignOwner, landing, secondLanding, advisor, foreignAdvisor, otherWorkspace] =
    Array.from({ length: 7 }, (_, index) => id(index + 1));
  sql(`insert into public.landings values
    ('${landing}','example','${owner}','ARS','{"template":"template7","ctaDestination":"atrio","targetProvider":"ganamos_net"}'),
    ('${secondLanding}','other','${foreignOwner}','ARS','{"template":"template7","ctaDestination":"atrio","targetProvider":"rey_de_ases"}');
    insert into public.atrio_clients values
    ('${advisor}','${id(21)}','ana','${owner}','ARS'),
    ('${foreignAdvisor}','${id(22)}','beto','${foreignOwner}','ARS'),
    ('${otherWorkspace}','${id(23)}','carla','${owner}','PYG');`);
  const context = (landingId = landing, slug = "example") => JSON.parse(sql(
    `set role service_role; select public.resolve_template7_destination_context('${landingId}','${slug}'); reset role;`,
  ));
  let result = context();
  assert.equal(result.landing.id, landing);
  assert.equal(result.blocked, false);
  assert.deepEqual(result.advisors.map(row => row.id), [advisor], "other tenants and workspaces excluded");
  assert.deepEqual(context(landing, "other"), { landing: null, blocked: true, advisors: [] });
  assert.deepEqual(context(id(999)), { landing: null, blocked: true, advisors: [] });
  assert.deepEqual(context(landing, "bad/path"), { landing: null, blocked: true, advisors: [] });
  assert.equal(context(secondLanding, "other").advisors[0].id, foreignAdvisor);

  for (const provider of ["rey_de_ases", "ases_del_norte", "ganamos_net"]) {
    sql(`update public.landings set config=jsonb_set(config,'{targetProvider}','"${provider}"') where id='${landing}';`);
    assert.equal(context().landing.config.targetProvider, provider);
  }
  sql(`update public.landings set config=jsonb_set(config,'{template}','"template6"') where id='${landing}';`);
  assert.deepEqual(context().advisors, [], "other templates cannot expose the advisor directory");
  sql(`update public.landings set config=jsonb_set(config,'{template}','"template7"') where id='${landing}';`);

  for (const status of ["paused", "expired"]) {
    sql(`insert into public.client_subscriptions values('${owner}','${status}',null,5)
      on conflict(user_id) do update set status=excluded.status;`);
    result = context();
    assert.equal(result.blocked, true);
    assert.deepEqual(result.advisors, []);
  }
  sql(`update public.client_subscriptions set status='active',expires_at=now()-interval '7 days',grace_days=5 where user_id='${owner}';`);
  assert.equal(context().blocked, true);
  sql(`update public.client_subscriptions set expires_at=now()-interval '1 day' where user_id='${owner}';`);
  assert.equal(context().blocked, false, "existing grace period retained");
  const counts = () => sql("select (select count(*) from landings),(select count(*) from atrio_clients),(select count(*) from client_subscriptions);");
  const before = counts();
  for (let index = 0; index < 3; index++) context();
  assert.equal(counts(), before, "prewarm context creates no data");

  for (const role of ["anon", "authenticated"]) {
    assert.equal(sql(`select has_function_privilege('${role}','public.resolve_template7_destination_context(uuid,text)','EXECUTE');`), "f");
    assert.throws(() => sql(`set role ${role}; select public.resolve_template7_destination_context('${landing}','example');`), /permission denied for function/);
  }
  assert.equal(sql("select prosecdef::text||':'||provolatile::text from pg_proc where oid='public.resolve_template7_destination_context(uuid,text)'::regprocedure;"), "false:s");

  sql(await readFile(new URL("../../supabase/migrations/20261008203009_template7_rate_limits.sql", import.meta.url), "utf8"));
  sql(await readFile(new URL("../../supabase/migrations/20261020050059_consolidate_template7_destination_limits.sql", import.meta.url), "utf8"));
  const key = n => n.toString(16).padStart(64, "0");
  const scopeQuery = (ip, device, consumeDenied = true, landingId = landing, slug = "example") =>
    `set role service_role; select public.resolve_template7_limited_destination_context('${landingId}','${slug}','${key(ip)}','${key(device)}',${consumeDenied}); reset role;`;
  const scope = (...parameters) => JSON.parse(sql(scopeQuery(...parameters)));
  const hit = n => Number(sql(`select hits from public.template7_rate_limit_buckets where bucket_key='${key(n)}';`) || 0);
  const seed = (n, hits) => sql(`insert into public.template7_rate_limit_buckets(bucket_key,hits,expires_at)
    values('${key(n)}',${hits},now()+interval '1 minute')
    on conflict(bucket_key) do update set hits=excluded.hits,expires_at=excluded.expires_at;`);
  const snapshot = () => sql(`select md5(jsonb_build_object(
    'landings',(select jsonb_agg(l order by id) from public.landings l),
    'advisors',(select jsonb_agg(a order by id) from public.atrio_clients a),
    'subscriptions',(select jsonb_agg(s order by user_id) from public.client_subscriptions s))::text);`);
  const unchanged = snapshot();
  result = scope(101, 201);
  assert.equal(result.allowed, true);
  assert.equal(result.landing.id, landing);
  assert.deepEqual(result.advisors.map(row => row.id), [advisor]);
  assert.equal(hit(101), 1); assert.equal(hit(201), 1);
  assert.deepEqual(scope(102, 202, true, landing, "other"), { allowed: true, landing: null, blocked: true, advisors: [] });
  assert.equal(scope(103, 203, true, secondLanding, "other").advisors[0].id, foreignAdvisor);

  // Both dimensions independently retain their existing quota and namespace.
  seed(110, 59);
  assert.equal(scope(110, 210).allowed, true, "60th IP request is allowed");
  assert.equal(scope(110, 211).allowed, false, "61st IP request is denied");
  assert.equal(hit(110), 61);
  assert.equal(hit(211), 1, "constructor still consumes device quota when IP is exhausted");
  seed(220, 5);
  assert.equal(scope(120, 220).allowed, true, "6th device request is allowed");
  assert.equal(scope(121, 220).allowed, false, "7th device request is denied");
  assert.equal(hit(121), 1); assert.equal(hit(220), 7);
  seed(130, 60); seed(230, 6);
  assert.deepEqual(scope(130, 230), { allowed: false, landing: null, blocked: true, advisors: [] });
  assert.equal(hit(130), 61); assert.equal(hit(230), 7);
  seed(140, 60);
  assert.equal(scope(140, 240, false).allowed, false);
  assert.equal(hit(240), 0, "classic retains its prior device short-circuit on IP denial");
  seed(141, 59);
  assert.equal(scope(141, 241, false).allowed, true);
  assert.equal(hit(241), 1, "classic consumes device quota once IP is allowed");
  sql(`update public.template7_rate_limit_buckets set expires_at=now()-interval '1 second' where bucket_key in('${key(130)}','${key(230)}');`);
  assert.equal(scope(130, 230).allowed, true, "expired windows reset independently");
  assert.equal(hit(130), 1); assert.equal(hit(230), 1);

  // Run actual simultaneous database sessions: never allow more than six
  // requests for the same device, even when twelve requests arrive together.
  const sqlAsync = input => new Promise((resolve, reject) => {
    const child = spawn("docker", args, { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    let output = ""; let error = "";
    child.stdout.on("data", chunk => { output += chunk; });
    child.stderr.on("data", chunk => { error += chunk; });
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolve(output.trim()) : reject(new Error(error)));
    child.stdin.end(input);
  });
  const concurrent = await Promise.all(Array.from({ length: 12 }, () => sqlAsync(scopeQuery(150, 250))));
  assert.equal(concurrent.map(raw => JSON.parse(raw)).filter(value => value.allowed).length, 6);
  assert.equal(hit(150), 12); assert.equal(hit(250), 12);
  seed(160, 58);
  const ipConcurrent = await Promise.all(Array.from({ length: 8 }, (_, index) => sqlAsync(scopeQuery(160, 260 + index))));
  assert.equal(ipConcurrent.map(raw => JSON.parse(raw)).filter(value => value.allowed).length, 2);
  assert.equal(hit(160), 66);

  const beforeInvalid = sql("select count(*),sum(hits) from public.template7_rate_limit_buckets;");
  for (const bad of [
    `null,'${key(301)}',true`, `'not-a-hash','${key(301)}',true`,
    `'${key(300)}','${key(300)}',true`, `'${key(300)}','${key(301)}',null`,
    `'${key(300)}',null,true`,
  ]) {
    assert.throws(() => sql(`set role service_role;select public.resolve_template7_limited_destination_context('${landing}','example',${bad});`), /invalid destination rate limit keys/);
  }
  assert.equal(sql("select count(*),sum(hits) from public.template7_rate_limit_buckets;"), beforeInvalid);
  assert.equal(snapshot(), unchanged, "scope only writes the existing rate counters, never accounts, landings or advisors");
  for (const role of ["anon", "authenticated"]) {
    assert.equal(sql(`select has_function_privilege('${role}','public.resolve_template7_limited_destination_context(uuid,text,text,text,boolean)','EXECUTE');`), "f");
    assert.throws(() => sql(`set role ${role}; select public.resolve_template7_limited_destination_context('${landing}','example','${key(500)}','${key(600)}',true);`), /permission denied for function/);
  }
  assert.equal(sql("select prosecdef::text||':'||provolatile::text from pg_proc where oid='public.resolve_template7_limited_destination_context(uuid,text,text,text,boolean)'::regprocedure;"), "false:v");

  // A future NULL result from the existing subscription guard must fail closed.
  sql("create or replace function public.is_client_access_blocked(p_user_id uuid) returns boolean language sql stable as $$select null::boolean$$;");
  assert.equal(context().blocked, true);
  assert.deepEqual(context().advisors, []);
  assert.equal(scope(170, 270).blocked, true);
  assert.deepEqual(scope(171, 271).advisors, []);
});
