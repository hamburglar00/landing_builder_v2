-- Gateway is an explicit third public delivery motor. Existing rows retain their saved motor.
alter table public.landings drop constraint if exists landings_publish_target_check;
alter table public.landings add constraint landings_publish_target_check
  check (publish_target in ('classic', 'constructor', 'gateway'));

-- RLS continues to own authorization. This constraint also covers direct client writes,
-- not just the editor UI. Gateway cannot publish external, WhatsApp or T8 landings.
alter table public.landings add constraint landings_gateway_publication_check check (
  publish_target <> 'gateway' or (
    coalesce(landing_type, '') = 'internal'
    and lower(name) <> 'nexobet'
    and coalesce(config->>'template', '') in ('template7', 'template9')
    and coalesce(config->>'ctaDestination', '') = 'atrio'
    and coalesce(config->>'targetProvider', 'rey_de_ases') in ('rey_de_ases', 'ases_del_norte', 'ganamos_net', 'multi_skin')
  )
);
comment on column public.landings.publish_target is
  'Public delivery motor: classic, constructor or gateway. Gateway serves T7/T9 Atrio at the configured gateway /l/{slug}; editor and data ownership do not migrate.';
