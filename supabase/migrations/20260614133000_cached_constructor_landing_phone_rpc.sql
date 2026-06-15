create or replace function public.get_cached_constructor_landing_phone(p_landing_name text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select
    c.payload
      || jsonb_build_object(
        'cacheRefreshedAt', c.refreshed_at,
        'cacheSource', 'landing_phone_cache'
      )
  from public.landing_phone_cache c
  join public.landings l on l.id = c.landing_id
  where c.landing_name = trim(p_landing_name)
    and c.status = 'ok'
    and c.refreshed_at >= now() - interval '90 seconds'
    and coalesce(c.payload ->> 'phone', '') <> ''
    and coalesce(l.landing_type, 'internal') = 'internal'
    and coalesce(l.publish_target, 'classic') = 'constructor'
  limit 1;
$$;

revoke all on function public.get_cached_constructor_landing_phone(text) from public;
grant execute on function public.get_cached_constructor_landing_phone(text) to anon, authenticated, service_role;

comment on function public.get_cached_constructor_landing_phone(text) is
  'Devuelve el telefono candidato cacheado para landings publicadas desde el constructor, solo si el cache esta fresco.';
