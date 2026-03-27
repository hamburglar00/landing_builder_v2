alter table public.landings
  add column if not exists landing_type text not null default 'internal';

alter table public.landings
  add column if not exists external_domain text not null default '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'landings_landing_type_check'
  ) then
    alter table public.landings
      add constraint landings_landing_type_check
      check (landing_type in ('internal', 'external'));
  end if;
end $$;

