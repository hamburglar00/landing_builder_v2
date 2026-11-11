import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const image = "postgres:17-alpine";
const name = `codex-phone-preflight-${randomUUID().slice(0, 8)}`;
const migration = readFileSync(new URL("../supabase/migrations/20261111002218_landing_phone_preflight.sql", import.meta.url), "utf8");
const docker = (args, options = {}) => execFileSync("docker", args, { encoding: "utf8", windowsHide: true, ...options });
const sql = (source) => docker(["exec", "-i", name, "psql", "-X", "-q", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], { input: source });

// No production data or network. This fixture reproduces the columns and plan
// function used by the new RPC; the existing selector is intentionally absent.
const fixture = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create table public.landings (name text primary key, user_id uuid, publish_target text);
create table public.profiles (nombre text primary key, id uuid);
create table public.client_subscriptions (user_id uuid primary key, status text, expires_at timestamptz, grace_days integer);
create function public.is_client_access_blocked(p_user_id uuid) returns boolean
language plpgsql stable as $$
declare v_status text; v_expires_at timestamptz; v_grace_days integer;
begin
  select status, expires_at, grace_days into v_status, v_expires_at, v_grace_days
  from public.client_subscriptions where user_id = p_user_id;
  if not found then return false; end if;
  if v_status in ('paused', 'expired') then return true; end if;
  if v_expires_at is null then return false; end if;
  return now() > (v_expires_at + make_interval(days => coalesce(v_grace_days, 5)));
end; $$;
grant select on public.landings, public.profiles, public.client_subscriptions to service_role;
insert into public.landings values
  ('active-classic', '11111111-1111-4111-8111-111111111111', 'classic'),
  ('active-constructor', '22222222-2222-4222-8222-222222222222', 'constructor'),
  ('blocked', '33333333-3333-4333-8333-333333333333', 'classic'),
  ('grace-expired', '44444444-4444-4444-8444-444444444444', 'classic');
insert into public.profiles values
  ('chatrace-active', '55555555-5555-4555-8555-555555555555'),
  ('chatrace-blocked', '33333333-3333-4333-8333-333333333333');
insert into public.client_subscriptions values
  ('33333333-3333-4333-8333-333333333333', 'paused', null, 5),
  ('44444444-4444-4444-8444-444444444444', 'active', now() - interval '10 days', 5);
`;

const assertions = `
do $$
declare f oid := 'public.landing_phone_preflight(text,text)'::regprocedure;
begin
  if (select prosecdef from pg_proc where oid=f) then raise exception 'unexpected security definer'; end if;
  if not (select 'search_path=""' = any(proconfig) from pg_proc where oid=f) then raise exception 'search_path not fixed'; end if;
  if has_function_privilege('anon',f,'EXECUTE') or has_function_privilege('authenticated',f,'EXECUTE') then
    raise exception 'browser role can execute preflight';
  end if;
  if not has_function_privilege('service_role',f,'EXECUTE') then raise exception 'service role cannot execute preflight'; end if;
end; $$;
set role service_role;
do $$
declare v jsonb;
begin
  v := public.landing_phone_preflight(' active-classic ', null);
  if v->>'status' <> 'ok' or v->>'ownerUserId' <> '11111111-1111-4111-8111-111111111111' or v->>'publishTarget' <> 'classic' then
    raise exception 'classic owner mismatch: %', v;
  end if;
  v := public.landing_phone_preflight('active-constructor', null);
  if v->>'status' <> 'ok' or v->>'publishTarget' <> 'constructor' then raise exception 'constructor mismatch: %', v; end if;
  v := public.landing_phone_preflight('active-classic', 'warmup');
  if v->>'status' <> 'ok' then raise exception 'warmup mismatch: %', v; end if;
  v := public.landing_phone_preflight('chatrace-active', 'chatrace');
  if v->>'status' <> 'ok' or v->>'ownerUserId' <> '55555555-5555-4555-8555-555555555555' then
    raise exception 'chatrace mismatch: %', v;
  end if;
  v := public.landing_phone_preflight('blocked', null);
  if v <> '{"status":"blocked"}'::jsonb then raise exception 'blocked leaked owner or selected: %', v; end if;
  v := public.landing_phone_preflight('grace-expired', null);
  if v <> '{"status":"blocked"}'::jsonb then raise exception 'expired plan mismatch: %', v; end if;
  v := public.landing_phone_preflight('chatrace-blocked', 'chatrace');
  if v <> '{"status":"blocked"}'::jsonb then raise exception 'chatrace block mismatch: %', v; end if;
  v := public.landing_phone_preflight('missing', null);
  if v <> '{"status":"not_found"}'::jsonb then raise exception 'missing landing mismatch: %', v; end if;
  v := public.landing_phone_preflight('missing', 'chatrace');
  if v <> '{"status":"not_found"}'::jsonb then raise exception 'missing chatrace mismatch: %', v; end if;
end; $$;
reset role;
select 'landing_phone_preflight: passed' as result;
`;

docker(["image", "inspect", image], { stdio: "ignore" });
let started = false;
try {
  docker(["run", "-d", "--rm", "--network", "none", "--name", name, "-e", "POSTGRES_PASSWORD=fixture-only", image], { stdio: "ignore" });
  started = true;
  let ready = false;
  for (let i = 0; i < 40; i++) {
    try { docker(["exec", name, "pg_isready", "-U", "postgres"], { stdio: "ignore" }); ready = true; break; }
    catch { await new Promise(resolve => setTimeout(resolve, 250)); }
  }
  assert.ok(ready, "disposable PostgreSQL did not start");
  // The image briefly starts a bootstrap server and restarts it after init.
  await new Promise(resolve => setTimeout(resolve, 1000));
  assert.equal(docker(["exec", name, "psql", "-X", "-t", "-A", "-U", "postgres", "-d", "postgres", "-c", "select 1"]).trim(), "1");
  sql(fixture);
  sql(migration);
  sql(migration);
  process.stdout.write(sql(assertions));
} finally {
  if (started) docker(["stop", name], { stdio: "ignore" });
}
