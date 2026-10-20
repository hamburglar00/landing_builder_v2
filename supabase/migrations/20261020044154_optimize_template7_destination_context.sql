-- Read the public landing's trusted selection scope in one database request.
-- No account, conversation, assignment, rate limit, or counter is written here.
create or replace function public.resolve_template7_destination_context(
  p_landing_id uuid,
  p_landing_slug text
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_landing public.landings%rowtype;
  v_landing_json jsonb;
  v_blocked boolean;
  v_advisors jsonb;
begin
  if p_landing_id is null
     or p_landing_slug is null
     or p_landing_slug !~ '^[a-zA-Z0-9][a-zA-Z0-9_-]{0,159}$' then
    return jsonb_build_object('landing', null, 'blocked', true, 'advisors', '[]'::jsonb);
  end if;

  select l.* into v_landing
  from public.landings as l
  where l.id = p_landing_id and l.name = p_landing_slug;

  if not found then
    return jsonb_build_object('landing', null, 'blocked', true, 'advisors', '[]'::jsonb);
  end if;

  v_landing_json := jsonb_build_object(
    'id', v_landing.id,
    'name', v_landing.name,
    'user_id', v_landing.user_id,
    'workspace_currency', v_landing.workspace_currency,
    'config', v_landing.config
  );

  -- The HTTP handler keeps its exact template/provider validation and errors.
  -- Invalid templates never need an advisor-directory read.
  if v_landing.config ->> 'template' is distinct from 'template7'
     or v_landing.config ->> 'ctaDestination' is distinct from 'atrio' then
    return jsonb_build_object('landing', v_landing_json, 'blocked', true, 'advisors', '[]'::jsonb);
  end if;

  -- Preserve the existing subscription guard, including fail-closed NULL.
  v_blocked := public.is_client_access_blocked(v_landing.user_id) is distinct from false;
  if v_blocked then
    return jsonb_build_object('landing', v_landing_json, 'blocked', true, 'advisors', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id,
    'atrio_id', a.atrio_id,
    'slug', a.slug,
    'user_id', a.user_id,
    'workspace_currency', a.workspace_currency
  ) order by a.id), '[]'::jsonb)
  into v_advisors
  from public.atrio_clients as a
  where a.user_id = v_landing.user_id
    and a.workspace_currency = v_landing.workspace_currency;

  return jsonb_build_object('landing', v_landing_json, 'blocked', false, 'advisors', v_advisors);
end;
$$;

revoke all on function public.resolve_template7_destination_context(uuid, text)
  from public, anon, authenticated;
grant execute on function public.resolve_template7_destination_context(uuid, text)
  to service_role;

comment on function public.resolve_template7_destination_context(uuid, text) is
  'Internal read-only Template 7 context: exact landing, subscription status and owner/workspace Atrio advisors in one request. No account or assignment creation.';
