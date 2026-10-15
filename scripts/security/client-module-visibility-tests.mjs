import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

// Standalone local PostgreSQL fixture; no ports, project credentials or production data.
const nonce = randomUUID();
const container = `client-module-test-${nonce}`;
function docker(args, input) {
  const result = spawnSync('docker', args, { input, encoding: 'utf8', timeout: 60000, windowsHide: true });
  if (result.status !== 0) throw new Error(result.stderr || result.error?.message || result.stdout);
  return result.stdout;
}
let started = false;
try {
  const endpoint = docker(['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}']).trim();
  assert.match(endpoint, /^(npipe:\/\/\/\/\.\/pipe\/|unix:\/\/\/)/);
  docker(['run', '--rm', '-d', '--name', container, '--label', `client-module-test=${nonce}`, '--network', 'none',
    '--user', 'postgres', '--entrypoint', 'sh', 'public.ecr.aws/supabase/postgres:17.6.1.063', '-c',
    'initdb -D /tmp/module-test-db -A trust -U postgres >/dev/null && exec postgres -D /tmp/module-test-db -c listen_addresses= -c unix_socket_directories=/tmp']);
  started = true;
  let ready = false;
  for (let i = 0; i < 60; i++) {
    const probe = spawnSync('docker', ['exec', container, 'pg_isready', '-h', '/tmp', '-U', 'postgres'], { windowsHide: true, timeout: 10000 });
    if (probe.status === 0) { ready = true; break; }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.ok(ready, 'isolated PostgreSQL ready');
  const sql = query => docker(['exec', '-i', container, 'psql', '-h', '/tmp', '-X', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-Atq'], query);
  sql(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
    grant usage on schema auth, public to authenticated, anon, service_role;`);
  sql(readFileSync(new URL('../../supabase/migrations/20261015181921_client_module_visibility.sql', import.meta.url), 'utf8'));
  const result = sql(`
    insert into auth.users values ('92000000-0000-4000-8000-000000000001'), ('92000000-0000-4000-8000-000000000002');
    set role service_role;
    insert into public.client_module_permissions(user_id, show_atrio, show_kommo) values ('92000000-0000-4000-8000-000000000001', false, false);
    insert into public.client_module_permissions(user_id) values ('92000000-0000-4000-8000-000000000002');
    insert into public.client_module_permissions(user_id, show_followups) values ('92000000-0000-4000-8000-000000000001', false)
      on conflict(user_id) do update set show_followups=excluded.show_followups;
    reset role;
    do $$ begin
      if not exists(select 1 from public.client_module_permissions where user_id='92000000-0000-4000-8000-000000000002'
        and show_followups and show_whatsapp_api and show_atrio and show_kommo and show_chatrace) then raise exception 'Defaults changed'; end if;
      if not exists(select 1 from public.client_module_permissions where user_id='92000000-0000-4000-8000-000000000001'
        and not show_followups and not show_atrio and not show_kommo and show_chatrace and show_whatsapp_api) then raise exception 'Partial update reset flags'; end if;
    end $$;
    set role authenticated;
    select set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000001',false);
    do $$ begin
      if (select count(*) from public.client_module_permissions) <> 1 then raise exception 'RLS did not isolate clients'; end if;
      if exists(select 1 from public.client_module_permissions where user_id='92000000-0000-4000-8000-000000000002') then raise exception 'Other client exposed'; end if;
      begin
        update public.client_module_permissions set show_atrio=true;
        raise exception 'Client could update permissions';
      exception when insufficient_privilege then null; end;
      begin
        insert into public.client_module_permissions(user_id) values ('92000000-0000-4000-8000-000000000001');
        raise exception 'Client could insert permissions';
      exception when insufficient_privilege then null; end;
      begin
        delete from public.client_module_permissions;
        raise exception 'Client could delete permissions';
      exception when insufficient_privilege then null; end;
      begin
        truncate public.client_module_permissions;
        raise exception 'Client could truncate permissions';
      exception when insufficient_privilege then null; end;
    end $$;
    select set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000002',false);
    do $$ begin
      if (select count(*) from public.client_module_permissions) <> 1 or not (select show_atrio from public.client_module_permissions) then raise exception 'Second client permissions lost'; end if;
    end $$;
    reset role; set role anon;
    do $$ begin
      begin
        perform 1 from public.client_module_permissions;
        raise exception 'Anonymous read allowed';
      exception when insufficient_privilege then null; end;
    end $$;
    reset role;
    delete from auth.users where id='92000000-0000-4000-8000-000000000001';
    do $$ begin
      if exists(select 1 from public.client_module_permissions where user_id='92000000-0000-4000-8000-000000000001') then raise exception 'Permissions not cascaded'; end if;
    end $$;
    select 'MODULE_PERMISSIONS_OK';
  `);
  assert.match(result, /MODULE_PERMISSIONS_OK/);
  console.log('PASS: module defaults, partial updates, service-role management, tenant RLS, read-only clients, anonymous denial and cascade');
} finally {
  if (started) {
    const state = JSON.parse(docker(['inspect', container]))[0];
    assert.equal(state.Name, '/' + container);
    assert.equal(state.Config.Labels['client-module-test'], nonce);
    docker(['rm', '-f', '-v', container]);
  }
}
