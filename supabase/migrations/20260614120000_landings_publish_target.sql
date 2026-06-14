alter table public.landings
  add column if not exists publish_target text not null default 'classic';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'landings_publish_target_check'
  ) then
    alter table public.landings
      add constraint landings_publish_target_check
      check (publish_target in ('classic', 'constructor'));
  end if;
end $$;

comment on column public.landings.publish_target is
  'Motor de publicacion para landings creadas en el constructor: classic usa landing.panelbotadmin.com; constructor usa /l en el proyecto del constructor.';
