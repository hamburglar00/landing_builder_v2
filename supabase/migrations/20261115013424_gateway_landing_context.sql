-- One database round trip for the fresh publication/owner read used by the
-- authenticated gateway bridge. Existing subscription authorization is reused.
create or replace function public.gateway_landing_context(p_slug text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'id', l.id, 'user_id', l.user_id, 'name', l.name,
    'landing_type', l.landing_type, 'publish_target', l.publish_target,
    'config', l.config, 'landing_config', l.landing_config, 'pixel_id', l.pixel_id
  )
  from public.landings l
  where l.name = p_slug
    and l.publish_target = 'gateway'
    and public.is_client_access_blocked(l.user_id) is false
  limit 1
$$;
revoke all on function public.gateway_landing_context(text) from public, anon, authenticated;
grant execute on function public.gateway_landing_context(text) to service_role;
comment on function public.gateway_landing_context(text) is
  'Private gateway publication lookup; caller must verify gateway proof and exact host/provider/skin. No identity or financial writes.';
