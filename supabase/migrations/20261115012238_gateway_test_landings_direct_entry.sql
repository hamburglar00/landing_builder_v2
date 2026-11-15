-- Approved test landings only. Presentation metadata; no engine, identity,
-- tracking, pool, account, wallet or financial changes.
-- Empty development databases are a no-op. Partial/changed fixtures abort.
do $$
declare
  item record;
  seen integer := 0;
  direct_policy constant jsonb := '{"mode":"direct","seconds":4}'::jsonb;
begin
  for item in
    select l.id, l.name, l.config, l.landing_config, l.publish_target
    from public.landings l
    where l.name in ('atriopili', 'asesdelnorte', 'diana')
    order by l.id
    for update
  loop
    seen := seen + 1;
    if item.publish_target is distinct from 'classic'
      or item.config->>'template' is distinct from 'template9'
      or jsonb_typeof(item.config) is distinct from 'object'
      or jsonb_typeof(item.landing_config) is distinct from 'object'
      or (item.config ? 'gatewayEntry' and item.config->'gatewayEntry' is distinct from direct_policy)
      or (item.landing_config ? 'gatewayEntry' and item.landing_config->'gatewayEntry' is distinct from direct_policy)
    then
      raise exception 'Test landing presentation changed; review before backfill';
    end if;

    update public.landings
    set config = jsonb_set(item.config, '{gatewayEntry}', direct_policy, true),
        landing_config = jsonb_set(item.landing_config, '{gatewayEntry}', direct_policy, true)
    where id = item.id
      and (config->'gatewayEntry' is distinct from direct_policy
        or landing_config->'gatewayEntry' is distinct from direct_policy);
  end loop;

  if seen not in (0, 3) then
    raise exception 'Expected either all three approved test landings or none';
  end if;
end $$;
