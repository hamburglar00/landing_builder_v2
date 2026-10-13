alter table public.atrio_clients
  add column if not exists display_name text,
  add column if not exists atrio_status text,
  add column if not exists directory_revision timestamptz,
  add column if not exists directory_synced_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'atrio_clients_display_name_not_blank_check'
      and conrelid = 'public.atrio_clients'::regclass
  ) then
    alter table public.atrio_clients
      add constraint atrio_clients_display_name_not_blank_check
      check (display_name is null or length(btrim(display_name)) > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'atrio_clients_atrio_status_check'
      and conrelid = 'public.atrio_clients'::regclass
  ) then
    alter table public.atrio_clients
      add constraint atrio_clients_atrio_status_check
      check (atrio_status is null or atrio_status in ('disponible', 'ausente'));
  end if;
end
$$;

comment on column public.atrio_clients.display_name is
  'Non-sensitive advisor display name synchronized from Atrio.';
comment on column public.atrio_clients.atrio_status is
  'Last synchronized Atrio availability state. It is informational and never authorizes a redirect.';
comment on column public.atrio_clients.directory_revision is
  'Atrio profile updated_at applied by the directory reconciliation job.';
comment on column public.atrio_clients.directory_synced_at is
  'Time at which Landing Builder last reconciled this advisor with Atrio.';

create or replace function public.resolve_landing_atrio_context(p_landing_name text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner_user_id uuid;
begin
  select landing.user_id
    into v_owner_user_id
  from public.landings as landing
  where landing.name = btrim(p_landing_name)
  limit 1;

  if v_owner_user_id is null then
    return jsonb_build_object('_status', 'not_found');
  end if;

  if public.is_client_access_blocked(v_owner_user_id) then
    return jsonb_build_object('_status', 'landing_unavailable');
  end if;

  return public.get_atrio_for_landing(btrim(p_landing_name));
end;
$$;

revoke all on function public.resolve_landing_atrio_context(text)
  from public, anon, authenticated;
grant execute on function public.resolve_landing_atrio_context(text)
  to service_role;

comment on function public.resolve_landing_atrio_context(text) is
  'Validates landing access and selects its local Atrio advisor in one server-side database operation.';

create or replace function public.apply_atrio_advisor_directory_snapshot(p_advisors jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_updated integer := 0;
begin
  if jsonb_typeof(p_advisors) <> 'array' or jsonb_array_length(p_advisors) > 500 then
    raise exception 'invalid Atrio advisor snapshot';
  end if;

  with incoming as (
    select
      entry ->> 'id' as atrio_id,
      nullif(btrim(entry ->> 'name'), '') as display_name,
      lower(nullif(btrim(entry ->> 'slug'), '')) as slug,
      nullif(btrim(entry ->> 'status'), '') as atrio_status,
      (entry ->> 'revision')::timestamptz as directory_revision
    from jsonb_array_elements(p_advisors) as item(entry)
    where entry ?& array['id', 'name', 'slug', 'status', 'revision']
  ), updated as (
    update public.atrio_clients as client
    set
      display_name = incoming.display_name,
      slug = incoming.slug,
      atrio_status = incoming.atrio_status,
      directory_revision = incoming.directory_revision,
      directory_synced_at = clock_timestamp()
    from incoming
    where client.atrio_id = incoming.atrio_id
      and incoming.atrio_id ~ '^[0-9a-fA-F-]{36}$'
      and incoming.slug ~ '^[a-z0-9][a-z0-9_-]{0,80}$'
      and incoming.atrio_status in ('disponible', 'ausente')
      and (
        client.directory_revision is null
        or incoming.directory_revision > client.directory_revision
        or client.display_name is distinct from incoming.display_name
        or client.slug is distinct from incoming.slug
        or client.atrio_status is distinct from incoming.atrio_status
      )
    returning client.id
  )
  select count(*)::integer into v_updated from updated;

  return v_updated;
end;
$$;

revoke all on function public.apply_atrio_advisor_directory_snapshot(jsonb)
  from public, anon, authenticated;
grant execute on function public.apply_atrio_advisor_directory_snapshot(jsonb)
  to service_role;

comment on function public.apply_atrio_advisor_directory_snapshot(jsonb) is
  'Applies a validated non-secret Atrio advisor directory snapshot only to advisors already linked to a Landing Builder owner.';

create or replace function public.cron_sync_atrio_advisor_directory()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_url text;
  sync_url text;
  secret text;
begin
  select value into base_url from public.cron_config where key = 'sync_phones_url';
  select value into secret from public.cron_config where key = 'sync_phones_cron_secret';
  if base_url is null or base_url like '%REPLACE_%' or secret is null then
    return;
  end if;

  sync_url := replace(base_url, '/functions/v1/sync-phones', '/functions/v1/sync-atrio-directory');
  perform net.http_post(
    url := sync_url,
    body := jsonb_build_object('cron_secret', secret),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 30000
  );
end;
$$;

revoke all on function public.cron_sync_atrio_advisor_directory()
  from public, anon, authenticated;

do $$
begin
  perform cron.unschedule('sync-atrio-advisors-every-5min');
exception when others then
  null;
end $$;

select cron.schedule(
  'sync-atrio-advisors-every-5min',
  '2-59/5 * * * *',
  $$select public.cron_sync_atrio_advisor_directory()$$
);
