create or replace function public.resolve_template7_start_context(
  p_landing_id uuid,
  p_landing_slug text,
  p_atrio_client_id uuid,
  p_advisor_id text,
  p_advisor_slug text,
  p_global_bucket_key text,
  p_start_bucket_key text,
  p_unbound_bucket_key text default null
)
returns table (
  status text,
  landing_id uuid,
  landing_name text,
  owner_user_id uuid,
  workspace_currency text,
  landing_config_raw jsonb,
  landing_config_published jsonb,
  target_provider text,
  atrio_client_id uuid,
  advisor_id text,
  advisor_slug text
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_landing public.landings%rowtype;
  v_advisor public.atrio_clients%rowtype;
  v_provider text;
begin
  if p_landing_slug is null or length(p_landing_slug) > 160
     or p_advisor_id is null or length(p_advisor_id) > 80
     or p_advisor_slug is null or length(p_advisor_slug) > 81 then
    raise exception 'invalid template 7 start context';
  end if;

  select l.* into v_landing
  from public.landings as l
  where l.id = p_landing_id
    and l.name = p_landing_slug;

  if not found
     or not (
       (v_landing.config ->> 'template' = 'template7'
        or v_landing.landing_config #>> '{layout,template}' = '7')
       and v_landing.config ->> 'ctaDestination' = 'atrio'
     ) then
    return query select
      'landing_not_found'::text, null::uuid, null::text, null::uuid,
      null::text, null::jsonb, null::jsonb, null::text, null::uuid,
      null::text, null::text;
    return;
  end if;

  v_provider := coalesce(v_landing.config ->> 'targetProvider', 'rey_de_ases');
  if v_provider not in ('rey_de_ases', 'multi_skin') then
    return query select
      'integration_pending'::text, v_landing.id, v_landing.name,
      v_landing.user_id, v_landing.workspace_currency, v_landing.config,
      v_landing.landing_config, null::text, null::uuid, null::text, null::text;
    return;
  end if;

  if public.is_client_access_blocked(v_landing.user_id) then
    return query select
      'landing_unavailable'::text, v_landing.id, v_landing.name,
      v_landing.user_id, v_landing.workspace_currency, v_landing.config,
      v_landing.landing_config, v_provider, null::uuid, null::text, null::text;
    return;
  end if;

  if not public.consume_template7_rate_limit(p_global_bucket_key, 120, 60) then
    return query select
      'rate_limited'::text, v_landing.id, v_landing.name,
      v_landing.user_id, v_landing.workspace_currency, v_landing.config,
      v_landing.landing_config, v_provider, null::uuid, null::text, null::text;
    return;
  end if;

  if p_unbound_bucket_key is not null
     and not public.consume_template7_rate_limit(p_unbound_bucket_key, 1, 45) then
    return query select
      'rate_limited'::text, v_landing.id, v_landing.name,
      v_landing.user_id, v_landing.workspace_currency, v_landing.config,
      v_landing.landing_config, v_provider, null::uuid, null::text, null::text;
    return;
  end if;

  if not public.consume_template7_rate_limit(p_start_bucket_key, 1, 45) then
    return query select
      'rate_limited'::text, v_landing.id, v_landing.name,
      v_landing.user_id, v_landing.workspace_currency, v_landing.config,
      v_landing.landing_config, v_provider, null::uuid, null::text, null::text;
    return;
  end if;

  select a.* into v_advisor
  from public.landings_atrio_clients as la
  join public.atrio_clients as a
    on a.id = la.atrio_client_id
  where la.landing_id = v_landing.id
    and la.atrio_client_id = p_atrio_client_id
    and la.user_id = v_landing.user_id
    and a.user_id = v_landing.user_id
    and a.workspace_currency = v_landing.workspace_currency
    and a.atrio_id = p_advisor_id
    and a.slug = p_advisor_slug;

  if not found then
    return query select
      'advisor_not_assigned'::text, v_landing.id, v_landing.name,
      v_landing.user_id, v_landing.workspace_currency, v_landing.config,
      v_landing.landing_config, v_provider, null::uuid, null::text, null::text;
    return;
  end if;

  return query select
    'ok'::text, v_landing.id, v_landing.name, v_landing.user_id,
    v_landing.workspace_currency, v_landing.config, v_landing.landing_config,
    v_provider, v_advisor.id, v_advisor.atrio_id, v_advisor.slug;
end;
$$;

revoke all on function public.resolve_template7_start_context(
  uuid, text, uuid, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.resolve_template7_start_context(
  uuid, text, uuid, text, text, text, text, text
) to service_role;

comment on function public.resolve_template7_start_context(
  uuid, text, uuid, text, text, text, text, text
) is 'Validates a Template 7 start, consumes its durable rate limits and resolves the assigned Atrio advisor in one transaction.';

-- End migration.
