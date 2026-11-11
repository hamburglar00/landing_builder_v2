-- Combine only the dependent owner and subscription checks into one service
-- call. Keep selection, reservations and constructor cache in their existing
-- functions and order. This function is internal to the landing-phone Edge
-- Function; no browser role may execute it through the Data API.
create or replace function public.landing_phone_preflight(
  p_landing_name text,
  p_source text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner_user_id uuid;
  v_publish_target text;
begin
  if p_source = 'chatrace' then
    select p.id into v_owner_user_id
    from public.profiles p
    where p.nombre = pg_catalog.btrim(p_landing_name)
    limit 1;
  else
    select l.user_id, l.publish_target
      into v_owner_user_id, v_publish_target
    from public.landings l
    where l.name = pg_catalog.btrim(p_landing_name)
    limit 1;
  end if;

  if v_owner_user_id is null then
    return pg_catalog.jsonb_build_object('status', 'not_found');
  end if;

  if public.is_client_access_blocked(v_owner_user_id) is true then
    return pg_catalog.jsonb_build_object('status', 'blocked');
  end if;

  return pg_catalog.jsonb_build_object(
    'status', 'ok',
    'ownerUserId', v_owner_user_id,
    'publishTarget', coalesce(v_publish_target, 'classic')
  );
end;
$$;

revoke all on function public.landing_phone_preflight(text, text)
  from public, anon, authenticated;
grant execute on function public.landing_phone_preflight(text, text)
  to service_role;

comment on function public.landing_phone_preflight(text, text) is
  'Service-only owner and plan check for landing-phone. Does not select or reserve a phone.';
