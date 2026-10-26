alter table public.conversions_config
  add column capi_workspace_settings jsonb not null default '{}'::jsonb
  constraint conversions_config_workspace_capi_settings_valid check (
    jsonb_typeof(capi_workspace_settings) = 'object'
    and capi_workspace_settings - array['ARS', 'PYG'] = '{}'::jsonb
    and (not capi_workspace_settings ? 'ARS' or jsonb_typeof(capi_workspace_settings->'ARS') = 'boolean')
    and (not capi_workspace_settings ? 'PYG' or jsonb_typeof(capi_workspace_settings->'PYG') = 'boolean')
  );

comment on column public.conversions_config.capi_workspace_settings is
  'CAPI enabled per workspace. Missing keys preserve enabled behavior; browser Pixel and internal conversions are independent.';

-- Atomically edit one workspace, preserving concurrent edits to the other.
-- SECURITY INVOKER retains the existing owner/admin table policies.
create function public.set_workspace_capi_enabled(p_user_id uuid, p_currency text, p_enabled boolean)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare result jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_user_id is null or p_currency is null or p_currency not in ('ARS','PYG') or p_enabled is null then
    raise exception 'Invalid workspace settings' using errcode = '22023';
  end if;
  insert into public.conversions_config(user_id,capi_workspace_settings)
  values(p_user_id,jsonb_build_object(p_currency,p_enabled))
  on conflict(user_id) do update set
    capi_workspace_settings = jsonb_set(public.conversions_config.capi_workspace_settings,array[p_currency],to_jsonb(p_enabled),true),
    updated_at = now()
  returning capi_workspace_settings into result;
  return result;
end;
$$;
revoke all on function public.set_workspace_capi_enabled(uuid,text,boolean) from public,anon;
grant execute on function public.set_workspace_capi_enabled(uuid,text,boolean) to authenticated;
