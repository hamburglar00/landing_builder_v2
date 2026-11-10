-- Display ordering is applied before selecting 50 groups. No data or RLS changes.
-- Keep the previous RPC compatible with already-open versions of the panel.
create function public.read_bots_directory_page_sorted(
 p_workspace text,p_page integer default 1,p_search text default '',
 p_channel text default 'all',p_active boolean default false,p_include_atrio boolean default true,
 p_sort text default 'name',p_direction text default 'asc'
) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or p_workspace not in ('ARS','PYG') or p_page<1 or p_page>100000
   or p_channel not in ('all','whatsapp','atrio') or length(p_search)>200
   or p_sort is null or p_sort not in ('name','id') or p_direction is null or p_direction not in ('asc','desc') then raise exception 'Invalid directory page';end if;
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
 ), ordered as (
  select f.*,row_number()over(order by
   case when p_sort='name' and p_direction='asc' then lower(nombre) end asc nulls last,
   case when p_sort='name' and p_direction='desc' then lower(nombre) end desc nulls last,
   case when p_sort='id' and p_direction='asc' then coalesce((row->>'gerencia_id')::bigint,id) end asc nulls last,
   case when p_sort='id' and p_direction='desc' then coalesce((row->>'gerencia_id')::bigint,id) end desc nulls last,
   lower(nombre),key) as sort_position from filtered f
 ), page as materialized (
  select * from ordered order by sort_position limit 50 offset (least(p_page,greatest(1,ceil((select total from summary)/50.0)::int))-1)*50
 ), phones as materialized (
  select p.* from public.gerencia_phones p where p.gerencia_id in(select id from page where whatsapp)
 )
 select jsonb_build_object(
  'groups',coalesce((select jsonb_agg(row order by sort_position) from page),'[]'),
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
revoke all on function public.read_bots_directory_page_sorted(text,integer,text,text,boolean,boolean,text,text) from public,anon;
grant execute on function public.read_bots_directory_page_sorted(text,integer,text,text,boolean,boolean,text,text) to authenticated,service_role;

create or replace function public.read_bots_directory_page(
 p_workspace text,p_page integer default 1,p_search text default '',
 p_channel text default 'all',p_active boolean default false,p_include_atrio boolean default true
) returns jsonb language sql stable security invoker set search_path='' as $$
 select public.read_bots_directory_page_sorted(p_workspace,p_page,p_search,p_channel,p_active,p_include_atrio,'name','asc');
$$;
revoke all on function public.read_bots_directory_page(text,integer,text,text,boolean,boolean) from public,anon;
grant execute on function public.read_bots_directory_page(text,integer,text,text,boolean,boolean) to authenticated,service_role;
