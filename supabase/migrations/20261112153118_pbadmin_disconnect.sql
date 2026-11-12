-- Delegated access only: no Auth users, profiles, conversations or payments are deleted.
alter table public.pbadmin_accounts add column disconnected_at timestamptz;
alter table public.pbadmin_people add column disconnected_at timestamptz;
alter table public.pbadmin_accounts add column released_account_id uuid;
alter table public.pbadmin_people add column released_advisor_id uuid;

create function public.disconnect_pbadmin(p_owner bigint, p_account uuid, p_user bigint,
  p_scope text, p_advisor uuid default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare a public.pbadmin_accounts; p public.pbadmin_people;
begin
  if p_owner is null or p_owner < 1 or p_user is null or p_user < 1 or
     p_account is null or p_scope is null or p_scope not in ('personal','workspace') then
    raise exception 'Invalid disconnect';
  end if;
  select * into a from public.pbadmin_accounts where owner_id=p_owner for update;
  if not found then return jsonb_build_object('disconnected',true,'scope',p_scope); end if;
  if a.disconnected_at is not null and a.released_account_id=p_account then
    return jsonb_build_object('disconnected',true,'scope',p_scope);
  end if;
  if a.account_id<>p_account then raise exception 'Account changed'; end if;
  if p_scope='personal' then
    select * into p from public.pbadmin_people where owner_id=p_owner and user_id=p_user for update;
    if found and coalesce(p.released_advisor_id,p.advisor_id) is distinct from p_advisor then raise exception 'Advisor changed'; end if;
  end if;
  update public.pbadmin_sessions set revoked=true where owner_id=p_owner
    and (p_scope='workspace' or user_id=p_user);
  update public.pbadmin_people set ready=false,disconnected_at=now(),released_advisor_id=advisor_id,advisor_id=gen_random_uuid()
    where owner_id=p_owner and disconnected_at is null and (p_scope='workspace' or user_id=p_user);
  if p_scope='workspace' then
    update public.pbadmin_accounts set ready=false,disconnected_at=now(),released_account_id=account_id,account_id=gen_random_uuid()
      where owner_id=p_owner;
  end if;
  return jsonb_build_object('disconnected',true,'scope',p_scope);
end;
$$;
revoke all on function public.disconnect_pbadmin(bigint,uuid,bigint,text,uuid) from public,anon,authenticated;
grant execute on function public.disconnect_pbadmin(bigint,uuid,bigint,text,uuid) to service_role;

-- Only an explicit new connection can reuse a released reservation. Opening never does.
create or replace function public.reserve_pbadmin_account(p_owner bigint,p_existing uuid default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare r public.pbadmin_accounts;
begin
  if p_owner is null or p_owner < 1 then raise exception 'Invalid owner'; end if;
  insert into public.pbadmin_accounts(owner_id,account_id,legacy)
    values(p_owner,coalesce(p_existing,gen_random_uuid()),p_existing is not null) on conflict(owner_id) do nothing;
  select * into r from public.pbadmin_accounts where owner_id=p_owner for update;
  if r.disconnected_at is not null then
    update public.pbadmin_accounts set account_id=coalesce(p_existing,case when not r.legacy then r.released_account_id else gen_random_uuid() end),
      legacy=(p_existing is not null),ready=false,disconnected_at=null,released_account_id=null where owner_id=p_owner returning * into r;
  end if;
  if p_existing is not null and r.account_id<>p_existing then raise exception 'Account conflict'; end if;
  return to_jsonb(r);
end;
$$;
revoke all on function public.reserve_pbadmin_account(bigint,uuid) from public,anon,authenticated;
grant execute on function public.reserve_pbadmin_account(bigint,uuid) to service_role;
