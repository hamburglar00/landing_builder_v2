create table if not exists public.landing_phone_cache (
  landing_id uuid primary key references public.landings(id) on delete cascade,
  landing_name text not null unique,
  status text not null default 'unknown',
  payload jsonb not null default '{}'::jsonb,
  refreshed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists landing_phone_cache_landing_name_idx
  on public.landing_phone_cache (landing_name);

alter table public.landing_phone_cache enable row level security;

comment on table public.landing_phone_cache is
  'Cache operativo del telefono candidato para landings publicadas desde el constructor.';

comment on column public.landing_phone_cache.payload is
  'Payload devuelto por get_phone_for_landing. No incrementa contadores; phone-click registra el click real.';

create or replace function public.refresh_constructor_landing_phone_cache()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  landing_row record;
  phone_payload jsonb;
  cache_status text;
  refreshed_count int := 0;
  skipped_count int := 0;
begin
  for landing_row in
    select id, name
    from public.landings
    where coalesce(landing_type, 'internal') = 'internal'
      and coalesce(publish_target, 'classic') = 'constructor'
  loop
    phone_payload := public.get_phone_for_landing(landing_row.name);
    cache_status := coalesce(phone_payload ->> '_status', 'ok');

    insert into public.landing_phone_cache (
      landing_id,
      landing_name,
      status,
      payload,
      refreshed_at,
      updated_at
    )
    values (
      landing_row.id,
      landing_row.name,
      cache_status,
      phone_payload,
      now(),
      now()
    )
    on conflict (landing_id) do update
      set landing_name = excluded.landing_name,
          status = excluded.status,
          payload = excluded.payload,
          refreshed_at = excluded.refreshed_at,
          updated_at = excluded.updated_at;

    if cache_status = 'ok' then
      refreshed_count := refreshed_count + 1;
    else
      skipped_count := skipped_count + 1;
    end if;
  end loop;

  delete from public.landing_phone_cache cache
  where not exists (
    select 1
    from public.landings landing
    where landing.id = cache.landing_id
      and coalesce(landing.landing_type, 'internal') = 'internal'
      and coalesce(landing.publish_target, 'classic') = 'constructor'
  );

  return jsonb_build_object(
    'ok', true,
    'refreshed', refreshed_count,
    'skipped', skipped_count
  );
end;
$$;

revoke all on function public.refresh_constructor_landing_phone_cache() from public;
grant execute on function public.refresh_constructor_landing_phone_cache() to service_role;

do $$
begin
  perform cron.unschedule('refresh-constructor-landing-phone-cache-every-minute');
exception when others then
  null;
end $$;

select cron.schedule(
  'refresh-constructor-landing-phone-cache-every-minute',
  '* * * * *',
  $$select public.refresh_constructor_landing_phone_cache()$$
);
