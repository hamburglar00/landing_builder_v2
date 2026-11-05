-- Only the trusted server can reserve identities or record delegated sessions.
create table public.pbadmin_accounts (
  owner_id bigint primary key check (owner_id > 0),
  account_id uuid not null unique default gen_random_uuid(),
  legacy boolean not null default false,
  ready boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.pbadmin_people (
  owner_id bigint not null references public.pbadmin_accounts(owner_id),
  user_id bigint not null unique check (user_id > 0),
  advisor_id uuid not null unique default gen_random_uuid(),
  ready boolean not null default false,
  primary key (owner_id,user_id)
);
create table public.pbadmin_sessions (
  session_id uuid primary key,
  profile_id uuid not null references auth.users(id) on delete cascade,
  owner_id bigint not null references public.pbadmin_accounts(owner_id),
  user_id bigint not null check (user_id > 0),
  role integer not null check (role in (0,3)),
  revoked boolean not null default false,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index pbadmin_sessions_actor on public.pbadmin_sessions(owner_id,user_id);
alter table public.pbadmin_accounts enable row level security;
alter table public.pbadmin_people enable row level security;
alter table public.pbadmin_sessions enable row level security;
revoke all on public.pbadmin_accounts, public.pbadmin_people, public.pbadmin_sessions from public, anon, authenticated;
grant select,insert,update,delete on public.pbadmin_accounts, public.pbadmin_people, public.pbadmin_sessions to service_role;

create function public.reserve_pbadmin_account(p_owner bigint,p_existing uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.pbadmin_accounts;
begin
  if p_owner is null or p_owner < 1 then raise exception 'Invalid owner'; end if;
  insert into public.pbadmin_accounts(owner_id,account_id,legacy)
    values(p_owner,coalesce(p_existing,gen_random_uuid()),p_existing is not null)
    on conflict(owner_id) do nothing;
  select * into r from public.pbadmin_accounts where owner_id=p_owner;
  if p_existing is not null and r.account_id<>p_existing then raise exception 'Account conflict'; end if;
  return to_jsonb(r);
end;
$$;
revoke all on function public.reserve_pbadmin_account(bigint,uuid) from public,anon,authenticated;
grant execute on function public.reserve_pbadmin_account(bigint,uuid) to service_role;

create function public.pbadmin_session_allowed()
returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when coalesce((select auth.jwt()->>'is_anonymous'),'false') = 'true' then true
    when exists(select 1 from public.pbadmin_sessions s where s.session_id=(select nullif(auth.jwt()->>'session_id','')::uuid))
    then exists(select 1 from public.pbadmin_sessions s where s.session_id=(select nullif(auth.jwt()->>'session_id','')::uuid) and s.profile_id=(select auth.uid()) and not s.revoked and s.expires_at>now())
    else coalesce((select auth.jwt()->'app_metadata'->>'pbadmin_managed'),'false') <> 'true'
  end;
$$;
revoke all on function public.pbadmin_session_allowed() from public,anon;
grant execute on function public.pbadmin_session_allowed() to authenticated,service_role;
-- Restrictive policies intersect existing tenant policies; never broaden access.
do $$ declare t record; begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r' and c.relrowsecurity and c.relname not in ('pbadmin_accounts','pbadmin_people','pbadmin_sessions')
  loop
    execute format('create policy pbadmin_session_guard on public.%I as restrictive for all to authenticated using ((select public.pbadmin_session_allowed())) with check ((select public.pbadmin_session_allowed()))',t.relname);
  end loop;
end $$;

-- Protect RPCs implemented as SECURITY DEFINER as well as table reads. Keep the
-- existing tenant policies; this only rejects revoked/expired delegated sessions.
create function public.pbadmin_check_session()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.jwt()->>'role') = 'authenticated' and not public.pbadmin_session_allowed() then
    raise insufficient_privilege using message = 'PBAdmin session expired or revoked';
  end if;
end;
$$;
revoke all on function public.pbadmin_check_session() from public;
grant execute on function public.pbadmin_check_session() to anon,authenticated,service_role;
do $$ declare previous text; begin
  if exists(select 1 from pg_roles where rolname='authenticator') then
    -- Check global, database and role/database settings before installing the hook.
    for previous in
      select split_part(c,'=',2) from pg_db_role_setting s cross join lateral unnest(s.setconfig) c
        where s.setrole in (0,(select oid from pg_roles where rolname='authenticator'))
          and s.setdatabase in (0,(select oid from pg_database where datname=current_database()))
          and c like 'pgrst.db_pre_request=%'
    loop
      if coalesce(previous,'') not in ('','public.pbadmin_check_session') then
        raise exception 'Existing PostgREST hook requires explicit composition before enabling PBAdmin';
      end if;
    end loop;
    execute format('alter role authenticator in database %I set pgrst.db_pre_request = %L',current_database(),'public.pbadmin_check_session');
  end if;
  if to_regclass('storage.objects') is not null then
    execute 'create policy pbadmin_session_guard on storage.objects as restrictive for all to authenticated using ((select public.pbadmin_session_allowed())) with check ((select public.pbadmin_session_allowed()))';
  end if;
end $$;
notify pgrst,'reload config';
notify pgrst,'reload schema';
