create schema if not exists app_private;
create sequence app_private.entry_catalog_revision_seq;
create table app_private.entry_catalog_outbox(
 landing_id uuid primary key,revision bigint not null default nextval('app_private.entry_catalog_revision_seq'),changed_at timestamptz not null default now()
);
create index entry_catalog_outbox_revision_idx on app_private.entry_catalog_outbox(revision);
alter table app_private.entry_catalog_outbox enable row level security;
revoke all on app_private.entry_catalog_outbox from public,anon,authenticated;
grant usage on schema app_private to service_role;
grant select,insert,update,delete on app_private.entry_catalog_outbox to service_role;
grant usage,select on sequence app_private.entry_catalog_revision_seq to service_role;

create function app_private.enqueue_entry_catalog_change() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='landings' then
  if not(coalesce(new.config->>'template','') in ('template7','template8','template9') or coalesce(old.config->>'template','') in ('template7','template8','template9'))then return null;end if;
  insert into app_private.entry_catalog_outbox(landing_id) values(coalesce(new.id,old.id))
   on conflict(landing_id) do update set revision=nextval('app_private.entry_catalog_revision_seq'),changed_at=now();
 elsif tg_table_name='landings_atrio_clients' then
  insert into app_private.entry_catalog_outbox(landing_id)
   select distinct x from unnest(array[new.landing_id,old.landing_id]) x where x is not null
   on conflict(landing_id) do update set revision=nextval('app_private.entry_catalog_revision_seq'),changed_at=now();
 else
  insert into app_private.entry_catalog_outbox(landing_id)
   select distinct landing_id from public.landings_atrio_clients where atrio_client_id=coalesce(new.id,old.id)
   on conflict(landing_id) do update set revision=nextval('app_private.entry_catalog_revision_seq'),changed_at=now();
 end if;
 return null;
end $$;
revoke all on function app_private.enqueue_entry_catalog_change() from public,anon,authenticated;
create trigger entry_catalog_change after insert or delete or update of config,landing_config,name,user_id,workspace_currency on public.landings
 for each row execute function app_private.enqueue_entry_catalog_change();
create trigger entry_catalog_change after insert or update or delete on public.landings_atrio_clients
 for each row execute function app_private.enqueue_entry_catalog_change();
create trigger entry_catalog_change after update of atrio_id,slug,user_id,workspace_currency or delete on public.atrio_clients
 for each row execute function app_private.enqueue_entry_catalog_change();

create function public.read_entry_catalog_changes(p_limit integer default 100) returns setof jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('landing_id',q.landing_id,'revision',q.revision,'configuration',case when l.id is null or coalesce(l.config->>'template','') not in ('template7','template8','template9') then null else
  jsonb_build_object('landing_id',l.id,'slug',l.name,'workspace_currency',l.workspace_currency,
   'template',coalesce(l.config->>'template','template1'),'target_provider',l.config->>'targetProvider',
   'skin_code',coalesce(l.config#>>array['templateConfigs',l.config->>'template','multiSkinCode'],l.config->>'multiSkinCode'),
   'advisors',coalesce((select jsonb_agg(jsonb_build_object('id',a.atrio_id,'slug',a.slug) order by a.atrio_id)
    from public.landings_atrio_clients x join public.atrio_clients a on a.id=x.atrio_client_id
    where x.landing_id=l.id and x.user_id=l.user_id and a.user_id=l.user_id and a.workspace_currency=l.workspace_currency
     and a.atrio_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),'[]'::jsonb)) end)
 from app_private.entry_catalog_outbox q left join public.landings l on l.id=q.landing_id
 order by q.revision limit greatest(1,least(coalesce(p_limit,100),100));
$$;
revoke all on function public.read_entry_catalog_changes(integer) from public,anon,authenticated;
grant execute on function public.read_entry_catalog_changes(integer) to service_role;

create function public.ack_entry_catalog_changes(p_items jsonb) returns void
language plpgsql security invoker set search_path='' as $$
begin
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)>100 then raise exception 'Invalid catalog acknowledgement';end if;
 delete from app_private.entry_catalog_outbox q using jsonb_to_recordset(p_items) x(landing_id uuid,revision bigint)
 where q.landing_id=x.landing_id and q.revision=x.revision;
end $$;
revoke all on function public.ack_entry_catalog_changes(jsonb) from public,anon,authenticated;
grant execute on function public.ack_entry_catalog_changes(jsonb) to service_role;

-- Initial synchronization is configuration only; no player, message or conversion.
insert into app_private.entry_catalog_outbox(landing_id) select id from public.landings where config->>'template' in ('template7','template8','template9');

-- Purpose-specific dispatch key stays encrypted in Vault, outside SQL/job text.
create extension if not exists pg_net with schema extensions;
create function public.configure_entry_catalog_dispatch(p_secret text) returns void
language plpgsql security definer set search_path='' as $$
declare secret_id uuid;
begin
 if p_secret is null or length(p_secret)<32 or length(p_secret)>256 then raise exception 'Invalid catalog dispatch configuration';end if;
 select id into secret_id from vault.secrets where name='entry_catalog_dispatch_key';
 if secret_id is null then perform vault.create_secret(p_secret,'entry_catalog_dispatch_key');
 else perform vault.update_secret(secret_id,p_secret);end if;
end $$;
revoke all on function public.configure_entry_catalog_dispatch(text) from public,anon,authenticated;
grant execute on function public.configure_entry_catalog_dispatch(text) to service_role;
create function app_private.dispatch_entry_catalog_sync() returns bigint
language plpgsql security definer set search_path='' as $$
declare secret text; request_id bigint;
begin
 select decrypted_secret into secret from vault.decrypted_secrets where name='entry_catalog_dispatch_key';
 if secret is null then return null;end if;
 select net.http_post(url:='https://www.atrio.website/api/internal/entry-catalog/reconcile',
   body:='{}'::jsonb,headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||secret),timeout_milliseconds:=5000) into request_id;
 return request_id;
exception when others then
 -- Notification failure never rolls back a configuration edit. The durable
 -- outbox and the next cron execution recover the same revision.
 raise warning 'Entry catalog notification unavailable';return null;
end $$;
revoke all on function app_private.dispatch_entry_catalog_sync() from public,anon,authenticated;

create function app_private.notify_entry_catalog_change() returns trigger
language plpgsql security definer set search_path='' as $$
begin if exists(select 1 from app_private.entry_catalog_outbox)then perform app_private.dispatch_entry_catalog_sync();end if;return null;end $$;
revoke all on function app_private.notify_entry_catalog_change() from public,anon,authenticated;
create trigger entry_catalog_notify after insert or delete or update of config,landing_config,name,user_id,workspace_currency on public.landings
 for each statement execute function app_private.notify_entry_catalog_change();
create trigger entry_catalog_notify after insert or update or delete on public.landings_atrio_clients
 for each statement execute function app_private.notify_entry_catalog_change();
create trigger entry_catalog_notify after update of atrio_id,slug,user_id,workspace_currency or delete on public.atrio_clients
 for each statement execute function app_private.notify_entry_catalog_change();
