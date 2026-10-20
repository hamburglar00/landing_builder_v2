import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

const container = `codex-atrio-inbox-pg-${process.pid}`;
function docker(args: string[], input?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", args, { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.on("data", chunk => { stdout += chunk; });
    child.stderr.on("data", chunk => { stderr += chunk; });
    const timeout = setTimeout(() => { child.kill(); reject(new Error("Local Postgres command timed out")); }, 30_000);
    child.on("error", error => { clearTimeout(timeout); reject(error); });
    child.on("close", code => {
      clearTimeout(timeout);
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr.trim() || "Local Postgres command failed"));
    });
    child.stdin.end(input);
  });
}
const sql = (query: string) => docker(["exec", "-i", "--user", "postgres", container, "psql", "-h", "/tmp", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-At"], query);
const advisor = "a0000000-0000-4000-8000-000000000001";
const conversation = "a0000000-0000-4000-8000-000000000005";
const key = "local-rpc-idempotency-key";
function call(idempotencyKey = key, content = "Hola", type = "texto", advisorId = advisor) {
  assert.match(idempotencyKey, /^[a-z0-9-]+$/);
  assert.match(content, /^[a-zA-Z -]+$/);
  return `select status || ':' || coalesce(message_id::text, '') from public.insert_external_api_message(
    '${advisorId}', '${conversation}', '${type}', '${content}', '{}',
    '${type === "texto" ? "message.reply" : "message.file"}', '${idempotencyKey}', '{}');`;
}
async function main() {
  const index = process.argv.indexOf("--atrio-repo");
  assert.ok(index !== -1 && process.argv[index + 1], "Pass --atrio-repo <local Atrio checkout>");
  const image = "public.ecr.aws/supabase/postgres:17.11.0.004";
  await docker(["image", "inspect", image]); // Require an already cached image.
  await docker(["run", "-d", "--pull=never", "--name", container, "--label", "codex.task=atrio-inbox-validation", "--network", "none",
    "--tmpfs", "/tmp:rw,size=256m", "--user", "postgres", "--entrypoint", "/bin/bash", image, "-lc",
    "initdb -D /tmp/atrio-inbox-db -A trust --no-locale -E UTF8 > /tmp/init.log && exec postgres -D /tmp/atrio-inbox-db -k /tmp -c listen_addresses="]);
  try {
  // Only an explicitly owned, network-isolated disposable container is accepted.
  const [state] = JSON.parse(await docker(["inspect", container]));
  assert.equal(state.Config.Labels["codex.task"], "atrio-inbox-validation");
  assert.equal(state.HostConfig.NetworkMode, "none");
  assert.ok(state.HostConfig.Tmpfs["/tmp"]);
  assert.equal(state.State.Running, true);
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { await docker(["exec", "--user", "postgres", container, "pg_isready", "-h", "/tmp"]); ready = true; break; }
    catch { await new Promise(resolve => setTimeout(resolve, 250)); }
  }
  assert.ok(ready, "Disposable Postgres did not become ready");
  assert.equal(await sql("select count(*) from pg_tables where schemaname = 'public';"), "0", "Fixture database must be empty");
  const migration = await readFile(path.join(path.resolve(process.argv[index + 1]), "supabase/migrations/20261011012120_external_api_v1.sql"), "utf8");
  const start = migration.indexOf("create or replace function public.insert_external_api_message(");
  assert.ok(start > 0);
  const end = migration.indexOf("$$;", start) + 3;
  assert.ok(end > start);
  const functionSql = migration.slice(start, end);
  const grantsStart = migration.indexOf("revoke all on function public.insert_external_api_message(", end);
  const grantsEnd = migration.indexOf("to service_role;", grantsStart) + "to service_role;".length;
  assert.ok(grantsStart > end && grantsEnd > grantsStart);
  await sql(`begin;
    create role anon; create role authenticated; create role service_role;
    create type public.message_type as enum ('texto', 'archivo');
    create type public.message_sender as enum ('cliente', 'asesor');
    create type public.conversation_status as enum ('nuevo', 'abierto', 'cerrado');
    create type public.integration_event_action as enum ('EXTERNAL_REQUEST');
    create type public.integration_event_status as enum ('pending', 'sent', 'failed', 'skipped');
    create table public.profiles (id uuid primary key, role text, admin_id uuid);
    create table public.conversations (id uuid primary key, advisor_id uuid references public.profiles(id), player_id uuid, status public.conversation_status, updated_at timestamptz);
    create table public.messages (id uuid primary key default gen_random_uuid(), conversation_id uuid references public.conversations(id), sender public.message_sender, type public.message_type, content text, metadata jsonb);
    create table public.integration_event_deliveries (id uuid primary key default gen_random_uuid(), action public.integration_event_action, integration_key text,
      advisor_id uuid, admin_id uuid, player_id uuid, conversation_id uuid, idempotency_key text, status public.integration_event_status,
      payload jsonb, message_id uuid references public.messages(id), attempts integer, sent_at timestamptz);
    create unique index integration_event_deliveries_idempotency_key_idx on public.integration_event_deliveries(idempotency_key) where idempotency_key is not null;
    insert into public.profiles values ('${advisor}', 'advisor', null);
    insert into public.conversations values ('${conversation}', '${advisor}', 'a0000000-0000-4000-8000-000000000003', 'cerrado', null);
    grant select, insert, update on all tables in schema public to service_role;
    ${functionSql}
    ${migration.slice(grantsStart, grantsEnd)}
    commit;
  `);
  const checks: string[] = [];
  assert.equal(await sql("select prosecdef from pg_proc where proname = 'insert_external_api_message';"), "f");
  assert.equal(await sql("select has_function_privilege('anon', oid, 'EXECUTE') || ':' || has_function_privilege('authenticated', oid, 'EXECUTE') || ':' || has_function_privilege('service_role', oid, 'EXECUTE') from pg_proc where proname = 'insert_external_api_message';"), "false:false:true");
  checks.push("RPC invoker y ejecucion restringida a service_role");
  const first = await sql("set role service_role; " + call());
  const created = first.split("\n").at(-1)!;
  assert.ok(created.startsWith("created:"));
  assert.equal(await sql("select status from public.conversations;"), "abierto");
  checks.push("mensaje y entrega confirmados junto con la conversacion");
  const replay = await sql(call());
  assert.equal(replay, created.replace("created:", "duplicate:"));
  checks.push("replay recupera el mismo mensaje");
  assert.equal(await sql(call("wrong-advisor-request", "Hola", "texto", "a0000000-0000-4000-8000-000000000007")), "conversation_not_found:");
  checks.push("otro asesor no puede escribir en la conversacion");
  assert.ok((await sql(call("local-file-request-key", "Archivo", "archivo"))).startsWith("created:"));
  assert.equal(await sql("select count(*) from public.messages where type = 'archivo';"), "1");
  checks.push("respuesta de archivo persistida");
  await sql(`
    create sequence public.fail_once_sequence;
    create function public.fail_first_message() returns trigger language plpgsql as $$
    begin if new.content = 'fault-injection' and nextval('public.fail_once_sequence') = 1 then raise exception 'synthetic message failure'; end if; return new; end; $$;
    create trigger fixture_fail_message before insert on public.messages for each row execute function public.fail_first_message();
  `);
  await assert.rejects(sql(call("fault-injection-key", "fault-injection")), /synthetic message failure/);
  assert.equal(await sql("select count(*) from public.integration_event_deliveries where idempotency_key = 'fault-injection-key';"), "0");
  assert.equal(await sql("select count(*) from public.messages where content = 'fault-injection';"), "0");
  checks.push("fallo de mensaje revierte tambien la reserva de entrega");
  assert.ok((await sql(call("fault-injection-key", "fault-injection"))).startsWith("created:"));
  assert.ok((await sql(call("fault-injection-key", "fault-injection"))).startsWith("duplicate:"));
  assert.equal(await sql("select count(*) from public.messages where content = 'fault-injection';"), "1");
  checks.push("reintento tras rollback crea exactamente un mensaje");
  const parallel = await Promise.all(Array.from({ length: 12 }, () => sql(call("concurrent-response-key"))));
  assert.equal(parallel.filter(value => value.startsWith("created:")).length, 1);
  assert.equal(parallel.filter(value => value.startsWith("duplicate:")).length, 11);
  assert.equal(new Set(parallel.map(value => value.split(":")[1])).size, 1);
  checks.push("doce conexiones concurrentes insertan una sola respuesta");
  const outgoing = await Promise.all(Array.from({ length: 12 }, () => sql(`insert into public.integration_event_deliveries (idempotency_key, status)
    values ('concurrent-outbound-key', 'pending') on conflict (idempotency_key) where idempotency_key is not null do nothing returning id;`)));
  assert.equal(outgoing.filter(value => value.split("\n")[0].length === 36).length, 1);
  checks.push("doce reservas salientes tienen un solo ganador por indice unico");
  console.log(JSON.stringify({ postgres: await sql("show server_version;"), passed: checks.length, total: checks.length,
    externalNetwork: 0, productionWrites: 0, realMoneyOperations: 0, checks }, null, 2));
  } finally {
    const [owned] = JSON.parse(await docker(["inspect", container]));
    assert.equal(owned.Config.Labels["codex.task"], "atrio-inbox-validation");
    assert.equal(owned.HostConfig.NetworkMode, "none");
    assert.ok(owned.HostConfig.Tmpfs["/tmp"]);
    await docker(["stop", "--timeout", "5", container]);
    await docker(["rm", container]);
  }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Local Postgres verification failed"); process.exitCode = 1; });
