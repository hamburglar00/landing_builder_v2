-- A directory projection, never an authorization/routing source. Reconciliation
-- copies connection metadata only; operational metrics are read for one page.
alter table public.atrio_clients add column bot_directory jsonb
 check (bot_directory is null or (jsonb_typeof(bot_directory)='array' and jsonb_array_length(bot_directory)<=1000));

create function public.cache_atrio_bot_directory(p_advisors jsonb) returns void
language plpgsql security invoker set search_path='' as $$
begin
 if jsonb_typeof(p_advisors)<>'array' or jsonb_array_length(p_advisors)>500 then raise exception 'Invalid directory';end if;
 update public.atrio_clients c set bot_directory=x.connections
 from jsonb_to_recordset(p_advisors) x(id text,connections jsonb)
 where c.atrio_id=x.id and jsonb_typeof(x.connections)='array';
end $$;
revoke all on function public.cache_atrio_bot_directory(jsonb) from public,anon,authenticated;
grant execute on function public.cache_atrio_bot_directory(jsonb) to service_role;

create index if not exists gerencias_workspace_name_id_idx on public.gerencias(workspace_currency,lower(nombre),id);
create index if not exists atrio_clients_workspace_owner_idx on public.atrio_clients(workspace_currency,user_id);
create index if not exists gerencia_phones_group_status_idx on public.gerencia_phones(gerencia_id,status);

-- All table access runs under the caller's RLS. Only the selected 50 groups
-- carry phones, metrics and advisor detail across the database boundary.
create function public.read_bots_directory_page(
 p_workspace text,p_page integer default 1,p_search text default '',
 p_channel text default 'all',p_active boolean default false,p_include_atrio boolean default true
) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or p_workspace not in ('ARS','PYG') or p_page<1 or p_page>100000
   or p_channel not in ('all','whatsapp','atrio') or length(p_search)>200 then raise exception 'Invalid directory page';end if;
 with g as materialized (
  select * from public.gerencias where workspace_currency=p_workspace
 ), c as materialized (
  select * from public.atrio_clients where workspace_currency=p_workspace and p_include_atrio
 ), entries as materialized (
  select c.id as client_id,c.user_id,
   coalesce(nullif(e.connection->>'agency_id',''),nullif(e.inventory->>'agency_id','')) as agency,
   coalesce(nullif(e.connection->>'agency_name',''),nullif(e.inventory->>'agency_name',''),c.display_name,c.slug) as group_name,
   coalesce((e.connection->>'active')::boolean,(e.inventory->>'active')::boolean,false) as active,
   jsonb_build_object('client',to_jsonb(c)-'bot_directory','connection',e.connection,'inventory',e.inventory,'name',coalesce(c.display_name,c.slug)) as entry
  from c cross join lateral (
   select conn as connection,null::jsonb as inventory from jsonb_array_elements(coalesce(c.bot_directory,'[]')) conn
   union all
   select null,inv from jsonb_array_elements(coalesce(c.pbadmin_bots,'[]')) inv
    where inv->>'advisor_id'=c.atrio_id and not exists(select 1 from jsonb_array_elements(coalesce(c.bot_directory,'[]')) conn where conn->>'manager_id'=inv->>'manager_id')
   union all
   select null,null where coalesce(jsonb_array_length(c.bot_directory),0)=0
    and not exists(select 1 from jsonb_array_elements(coalesce(c.pbadmin_bots,'[]')) inv where inv->>'advisor_id'=c.atrio_id)
  ) e
 ), keyed as materialized (
  select e.*,g.id as real_id,
   case when g.id is not null then 'g:'||g.id else e.user_id||':'||coalesce(e.agency,'advisor:'||(e.entry#>>'{client,atrio_id}')) end as key
  from entries e left join g on g.user_id=e.user_id and g.source_type<>'manual' and g.gerencia_id::text=e.agency
 ), atrio_groups as materialized (
  select key,min(real_id) as real_id,min(group_name) as nombre,bool_or(active) as active,jsonb_agg(entry order by client_id,entry#>>'{connection,manager_id}') as bots
  from keyed group by key
 ), groups as materialized (
  select 'g:'||g.id as key,g.id,true as whatsapp,coalesce(a.active,false) or exists(select 1 from public.gerencia_phones p where p.gerencia_id=g.id and p.status='active' and p.source_available is distinct from false) as active,
   coalesce(a.active,false) as atrio_active,
   exists(select 1 from public.gerencia_phones p where p.gerencia_id=g.id and p.status='active' and p.source_available is distinct from false) as whatsapp_active,
   g.nombre,to_jsonb(g)||jsonb_build_object('atrioBots',coalesce(a.bots,'[]')) as row
  from g left join atrio_groups a on a.real_id=g.id
  union all
  select a.key,null,false,a.active,a.active,false,a.nombre,
   jsonb_build_object('id',-row_number()over(order by a.key),'uiKey',a.key,'nombre',a.nombre,'virtual',true,'source_type','pbadmin',
    'user_id',split_part(a.key,':',1),'workspace_currency',p_workspace,'gerencia_id',case when split_part(a.key,':',2)<>'advisor' then split_part(a.key,':',2)::bigint else null end,'atrioBots',a.bots)
  from atrio_groups a where a.real_id is null
 ), filtered as materialized (
  select * from groups x where (p_channel<>'whatsapp' or whatsapp) and (p_channel<>'atrio' or jsonb_array_length(row->'atrioBots')>0)
   and (not p_active or case p_channel when 'whatsapp' then whatsapp_active when 'atrio' then atrio_active else active end)
   and (p_search='' or strpos(lower(concat_ws(' ',x.nombre,x.id,x.row->>'gerencia_id',
      (select string_agg(concat_ws(' ',b->>'name','Bot '||(b->>'manager_id'),b->>'phone'),' ') from jsonb_array_elements(coalesce(x.row->'pbadmin_bots','[]')) b),
      (select string_agg(concat_ws(' ',e->>'name',e#>>'{client,slug}','Bot '||coalesce(e#>>'{connection,manager_id}',e#>>'{inventory,manager_id}'),e#>>'{inventory,name}',e#>>'{connection,target_provider}'),' ') from jsonb_array_elements(x.row->'atrioBots')e)
     )),lower(btrim(p_search)))>0
    or (regexp_replace(p_search,'[^0-9]','','g')<>'' and exists(select 1 from public.gerencia_phones p where p.gerencia_id=x.id and strpos(regexp_replace(p.phone,'[^0-9]','','g'),regexp_replace(p_search,'[^0-9]','','g'))>0)))
 ), summary as (
  select count(*) as total from filtered
 ), page as materialized (
  select * from filtered order by lower(nombre),key limit 50 offset (least(p_page,greatest(1,ceil((select total from summary)/50.0)::int))-1)*50
 ), phones as materialized (
  select p.* from public.gerencia_phones p where p.gerencia_id in(select id from page where whatsapp)
 )
 select jsonb_build_object(
  'groups',coalesce((select jsonb_agg(row order by lower(nombre),key) from page),'[]'),
  'phones',coalesce((select jsonb_agg(to_jsonb(p) order by gerencia_id,id) from phones p),'[]'),
  'metrics',coalesce((select jsonb_agg(to_jsonb(m)) from public.phone_metrics m where m.gerencia_phone_id in(select id from phones)),'[]'),
  'total',(select total from summary),'page',least(p_page,greatest(1,ceil((select total from summary)/50.0)::int)),
  'counts',(select jsonb_build_object('all',count(*),'whatsapp',count(*)filter(where whatsapp),'atrio',count(*)filter(where jsonb_array_length(row->'atrioBots')>0)) from groups),
  'activeCount',(select count(*) from groups where case p_channel when 'whatsapp' then whatsapp_active when 'atrio' then atrio_active else active end),
  'activePhones',(select count(*) from public.gerencia_phones p join g on g.id=p.gerencia_id where p.status='active' and coalesce(p.assignment_role,'acquisition')='acquisition'),
  'inactivePhones',(select count(*) from public.gerencia_phones p join g on g.id=p.gerencia_id where p.status<>'active'),
  'hasPbadmin',exists(select 1 from g where source_type<>'manual'),
  'projectionPending',(select count(*) from c where bot_directory is null)
 ) into result;
 return result;
end $$;
revoke all on function public.read_bots_directory_page(text,integer,text,text,boolean,boolean) from public,anon;
grant execute on function public.read_bots_directory_page(text,integer,text,text,boolean,boolean) to authenticated;

create function public.delete_inactive_workspace_phones(p_workspace text) returns integer
language plpgsql security invoker set search_path='' as $$
declare affected integer;
begin
 if auth.uid() is null or p_workspace not in('ARS','PYG') then raise exception 'Invalid workspace';end if;
 delete from public.gerencia_phones where status<>'active' and gerencia_id in(select id from public.gerencias where workspace_currency=p_workspace);
 get diagnostics affected=row_count;return affected;
end $$;
revoke all on function public.delete_inactive_workspace_phones(text) from public,anon;
grant execute on function public.delete_inactive_workspace_phones(text) to authenticated;

-- Preserve the existing per-account setting and midnight Buenos Aires schedule.
-- The transaction resets WhatsApp and enqueues one durable job per advisor/date.
create schema if not exists app_private;
create table app_private.bot_daily_resets(
 advisor_id uuid not null,reset_date date not null,reset_at timestamptz not null,
 completed_at timestamptz,primary key(advisor_id,reset_date)
);
alter table app_private.bot_daily_resets enable row level security;
revoke all on app_private.bot_daily_resets from public,anon,authenticated;
grant usage on schema app_private to service_role;
grant select,update on app_private.bot_daily_resets to service_role;
create or replace function public.cron_reset_phone_operational_daily() returns void
language plpgsql security definer set search_path='' as $$
declare today date:=(now() at time zone 'America/Argentina/Buenos_Aires')::date;
 reset_at timestamptz:=date_trunc('day',now() at time zone 'America/Argentina/Buenos_Aires') at time zone 'America/Argentina/Buenos_Aires';
 owners uuid[];
begin
 with reset_users as (
  update public.conversions_config set phone_auto_reset_last_date=today,updated_at=now()
  where phone_auto_reset_daily and phone_auto_reset_last_date is distinct from today returning user_id
 ) select array_agg(user_id) into owners from reset_users;
 with reset_phones as (
  update public.gerencia_phones p set usage_count=0,messages_reset_at=reset_at,assignment_counter_reset_at=reset_at
  where p.gerencia_id in(select id from public.gerencias where user_id=any(owners)) returning p.id
 ) update public.phone_assignment_scope_metrics set usage_count=0,updated_at=now() where phone_id in(select id from reset_phones);
 insert into app_private.bot_daily_resets(advisor_id,reset_date,reset_at)
 select distinct atrio_id::uuid,today,reset_at from public.atrio_clients where user_id=any(owners)
  and atrio_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
 on conflict do nothing;
end $$;
revoke all on function public.cron_reset_phone_operational_daily() from public,anon,authenticated;

create function public.read_bot_daily_resets() returns setof app_private.bot_daily_resets
language sql stable security invoker set search_path='' as $$
 select * from app_private.bot_daily_resets where completed_at is null order by reset_date,advisor_id limit 100;
$$;
create function public.ack_bot_daily_resets(p_items jsonb) returns void
language sql security invoker set search_path='' as $$
 update app_private.bot_daily_resets j set completed_at=now() from jsonb_to_recordset(p_items) x(advisor_id uuid,reset_date date)
 where j.advisor_id=x.advisor_id and j.reset_date=x.reset_date and j.completed_at is null;
$$;
revoke all on function public.read_bot_daily_resets(),public.ack_bot_daily_resets(jsonb) from public,anon,authenticated;
grant execute on function public.read_bot_daily_resets(),public.ack_bot_daily_resets(jsonb) to service_role;

create function public.dispatch_bot_daily_resets() returns void
language plpgsql security definer set search_path='' as $$
declare base_url text;secret text;
begin
 if not exists(select 1 from app_private.bot_daily_resets where completed_at is null) then return;end if;
 select value into base_url from public.cron_config where key='sync_phones_url';
 select value into secret from public.cron_config where key='sync_phones_cron_secret';
 if base_url is null or secret is null then return;end if;
 perform net.http_post(url:=replace(base_url,'/functions/v1/sync-phones','/functions/v1/reset-bots-daily'),
  body:=jsonb_build_object('cron_secret',secret),headers:='{"Content-Type":"application/json"}'::jsonb,timeout_milliseconds:=30000);
end $$;
revoke all on function public.dispatch_bot_daily_resets() from public,anon,authenticated;
select cron.schedule('dispatch-bot-daily-resets','* * * * *','select public.dispatch_bot_daily_resets();');
notify pgrst,'reload schema';
