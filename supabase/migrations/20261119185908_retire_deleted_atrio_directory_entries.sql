-- A retirement from Atrio is definitive for this identity. Preserve its row,
-- landing associations and historical metrics; exclude it from future routing.
alter table public.atrio_clients add column directory_retired_at timestamptz;

create function public.retire_atrio_directory_advisors(p_ids text[])
returns void language sql security invoker set search_path='' as $$
  update public.atrio_clients
     set directory_retired_at=clock_timestamp(), bot_directory='[]'::jsonb,
         pbadmin_bots='[]'::jsonb
   where atrio_id=any(p_ids) and directory_retired_at is null;
$$;
revoke all on function public.retire_atrio_directory_advisors(text[]) from public,anon,authenticated;
grant execute on function public.retire_atrio_directory_advisors(text[]) to service_role;

-- A snapshot started before deletion can arrive late; it cannot restore a
-- retired identity's bots. Recreating an advisor uses a different Atrio UUID.
create function public.guard_retired_atrio_directory() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if old.directory_retired_at is not null and new.atrio_id=old.atrio_id then
    new.directory_retired_at:=old.directory_retired_at;
    new.bot_directory:='[]'::jsonb;
    new.pbadmin_bots:='[]'::jsonb;
  end if;
  return new;
end $$;
revoke all on function public.guard_retired_atrio_directory() from public,anon,authenticated;
create trigger guard_retired_atrio_directory before update on public.atrio_clients
for each row execute function public.guard_retired_atrio_directory();

-- Keep the installed template, subscription, rate-limit and workspace rules.
do $$
declare fn record; original text; updated text;
begin
  for fn in
    select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public' and p.proname in ('resolve_template7_destination_context',
        'resolve_template7_start_context','resolve_template8_start_context','get_atrio_for_landing')
  loop
    original:=pg_get_functiondef(fn.oid);
    if fn.proname='get_atrio_for_landing' then
      updated:=replace(original,'ac.workspace_currency = v_workspace',
        'ac.workspace_currency = v_workspace and ac.directory_retired_at is null');
      if updated=original then raise exception 'Unexpected legacy directory selector'; end if;
      updated:=replace(updated,'get_atrio_for_landing(p_landing_name text)',
        'get_atrio_for_landing(p_landing_name text, p_allowed_ids text[])');
      updated:=replace(updated,'ac.directory_retired_at is null',
        'ac.directory_retired_at is null and (p_allowed_ids is null or ac.atrio_id=any(p_allowed_ids))');
      execute updated;
      execute 'revoke all on function public.get_atrio_for_landing(text,text[]) from public,anon,authenticated';
      execute 'grant execute on function public.get_atrio_for_landing(text,text[]) to service_role';
      execute 'create or replace function public.get_atrio_for_landing(p_landing_name text)
        returns jsonb language sql security invoker set search_path='''' as
        ''select public.get_atrio_for_landing(p_landing_name,null::text[])''';
      continue;
    else
      updated:=replace(original,'a.workspace_currency = v_landing.workspace_currency',
        'a.workspace_currency = v_landing.workspace_currency and a.directory_retired_at is null');
    end if;
    if original=updated then raise exception 'Unexpected directory filter in %',fn.proname; end if;
    if fn.proname='resolve_template7_destination_context' then
      original:=updated;
      updated:=replace(original,'''advisors'', v_advisors)',
        '''advisors'', v_advisors) || case when v_advisors=''[]''::jsonb and exists
          (select 1 from public.atrio_clients a where a.user_id=v_landing.user_id
           and a.workspace_currency=v_landing.workspace_currency and a.directory_retired_at is not null)
         then jsonb_build_object(''retired_only'',true) else ''{}''::jsonb end');
      if original=updated then raise exception 'Unexpected directory response'; end if;
    end if;
    execute updated;
  end loop;
end $$;
-- A fresh result from Atrio can narrow the legacy selector before the webhook
-- reaches Builder. Reuse its original subscription and ownership checks.
do $$
declare original text; updated text;
begin
  if to_regprocedure('public.resolve_landing_atrio_context(text)') is not null then
    original:=pg_get_functiondef('public.resolve_landing_atrio_context(text)'::regprocedure);
    updated:=replace(original,'public.get_atrio_for_landing(btrim(p_landing_name))',
      'public.get_atrio_for_landing(btrim(p_landing_name),p_allowed_ids)');
    if updated=original then raise exception 'Unexpected legacy access guard'; end if;
    execute replace(updated,'resolve_landing_atrio_context(p_landing_name text)',
      'resolve_landing_atrio_context(p_landing_name text, p_allowed_ids text[])');
    revoke all on function public.resolve_landing_atrio_context(text,text[]) from public,anon,authenticated;
    grant execute on function public.resolve_landing_atrio_context(text,text[]) to service_role;
  end if;
end $$;
notify pgrst,'reload schema';
