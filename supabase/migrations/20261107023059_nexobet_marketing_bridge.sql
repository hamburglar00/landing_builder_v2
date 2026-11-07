-- Private product integration. No existing client, template or subscription is changed.
create table public.nexobet_builder_nonces (
  nonce uuid primary key, expires_at timestamptz not null
);
create index nexobet_builder_nonce_expiry on public.nexobet_builder_nonces(expires_at);
create table public.nexobet_builder_accounts (
  account_id uuid primary key, owner_id bigint not null unique,
  user_id uuid not null unique references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);
create table public.nexobet_builder_landings (
  landing_id uuid primary key references public.landings(id) on delete cascade,
  account_id uuid not null references public.nexobet_builder_accounts(account_id) on delete restrict,
  state text not null default 'pending' check(state in ('pending','ready')),
  created_at timestamptz not null default now()
);
create index nexobet_builder_landing_account on public.nexobet_builder_landings(account_id);
alter table public.nexobet_builder_nonces enable row level security;
alter table public.nexobet_builder_accounts enable row level security;
alter table public.nexobet_builder_landings enable row level security;
revoke all on public.nexobet_builder_nonces,public.nexobet_builder_accounts,public.nexobet_builder_landings from anon,authenticated;
grant all on public.nexobet_builder_nonces,public.nexobet_builder_accounts,public.nexobet_builder_landings to service_role;
create policy nexobet_nonce_service on public.nexobet_builder_nonces to service_role using(true) with check(true);
create policy nexobet_account_service on public.nexobet_builder_accounts to service_role using(true) with check(true);
create policy nexobet_landing_service on public.nexobet_builder_landings to service_role using(true) with check(true);

create function public.nexobet_bind_builder(account uuid, owner bigint, client uuid) returns void
language plpgsql security invoker set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(account::text,0));
  if not exists(select 1 from public.pbadmin_accounts a join auth.users u on u.id=a.account_id
    where a.owner_id=owner and a.account_id=client and a.ready and not a.legacy
      and u.raw_app_meta_data->>'pbadmin_owner_id'=owner::text and u.raw_app_meta_data->>'pbadmin_kind'='builder')
    then raise exception 'Invalid NexoBet binding'; end if;
  if exists(select 1 from public.nexobet_builder_accounts a where a.account_id=account) then
    if not exists(select 1 from public.nexobet_builder_accounts a where a.account_id=account and a.user_id=client and a.owner_id=owner)
      then raise exception 'Conflicting NexoBet binding'; end if;
    return;
  end if;
  insert into public.nexobet_builder_accounts(account_id,owner_id,user_id) values(account,owner,client);
  -- NexoBet has a one-time implementation payment, never a 30-day Builder trial.
  -- Only the newly bound, managed product account receives this entitlement.
  update public.client_subscriptions set expires_at=null where user_id=client and status='active';
end $$;

create function public.nexobet_save_landing(account uuid, client uuid, landing uuid, advisor uuid, payload jsonb) returns void
language plpgsql security invoker set search_path='' as $$
begin
  perform 1 from public.nexobet_builder_accounts a where a.account_id=account and a.user_id=client for update;
  if not found or public.is_client_access_blocked(client) then raise exception 'Account unavailable'; end if;
  if not exists(select 1 from public.atrio_clients a where a.id=advisor and a.user_id=client and a.workspace_currency='ARS')
    then raise exception 'Advisor unavailable'; end if;
  if payload->'config'->>'template' is distinct from 'template9' or payload->'config'->>'ctaDestination' is distinct from 'atrio' then raise exception 'Invalid template'; end if;
  if exists(select 1 from public.landings l where l.id=landing) and not exists(
    select 1 from public.nexobet_builder_landings n join public.landings l on l.id=n.landing_id
      where n.landing_id=landing and n.account_id=account and l.user_id=client) then raise exception 'Landing unavailable'; end if;
  insert into public.landings(id,user_id,workspace_currency,landing_type,publish_target,name,comment,pixel_id,post_url,config,landing_config)
    values(landing,client,'ARS','internal','constructor',payload->>'name',payload->>'comment',payload->>'pixel_id',payload->>'post_url',payload->'config',payload->'landing_config')
    on conflict(id) do update set comment=excluded.comment,pixel_id=excluded.pixel_id,post_url=excluded.post_url,
      config=excluded.config,landing_config=excluded.landing_config,updated_at=now();
  insert into public.nexobet_builder_landings(landing_id,account_id) values(landing,account)
    on conflict(landing_id) do update set state='pending';
  insert into public.landings_atrio_clients(landing_id,atrio_client_id,user_id,weight) values(landing,advisor,client,1)
    on conflict(landing_id,atrio_client_id) do update set weight=1;
end $$;

create function public.nexobet_marketing_stats(client uuid, days integer default 30) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare since_time bigint; until_time bigint;
begin
  if days not between 1 and 90 or not exists(select 1 from public.nexobet_builder_accounts a where a.user_id=client)
    then raise exception 'Invalid statistics scope'; end if;
  since_time:=extract(epoch from ((date_trunc('day',now() at time zone 'America/Argentina/Buenos_Aires')-make_interval(days=>days-1)) at time zone 'America/Argentina/Buenos_Aires'))::bigint;
  until_time:=extract(epoch from now())::bigint;
  return jsonb_build_object(
    'leads',(select count(*) from public.conversions c where c.user_id=client and c.currency='ARS' and c.lead_event_time between since_time and until_time),
    'registrations',(select count(*) from public.conversions c where c.user_id=client and c.currency='ARS' and c.registration_event_time between since_time and until_time),
    'withPurchase',(select count(*) from public.conversions c where c.user_id=client and c.currency='ARS' and c.purchase_event_time between since_time and until_time));
end $$;
revoke all on function public.nexobet_bind_builder(uuid,bigint,uuid),public.nexobet_save_landing(uuid,uuid,uuid,uuid,jsonb),public.nexobet_marketing_stats(uuid,integer) from public,anon,authenticated;
grant execute on function public.nexobet_bind_builder(uuid,bigint,uuid),public.nexobet_save_landing(uuid,uuid,uuid,uuid,jsonb),public.nexobet_marketing_stats(uuid,integer) to service_role;
