alter table public.settings
  add column if not exists public_landing_runtime text not null default 'legacy',
  add column if not exists public_landing_legacy_base_url text not null default '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'settings_public_landing_runtime_check'
  ) then
    alter table public.settings
      add constraint settings_public_landing_runtime_check
      check (public_landing_runtime in ('legacy', 'constructor'));
  end if;
end $$;

comment on column public.settings.public_landing_runtime is
  'Modo global para landing.panelbotadmin.com: legacy usa el proyecto viejo; constructor usa la landing servida por el constructor.';

comment on column public.settings.public_landing_legacy_base_url is
  'URL tecnica del proyecto viejo de landing publica en Vercel, usada como fallback/proxy cuando public_landing_runtime = legacy.';

create or replace function public.get_public_landing_routing()
returns table (
  public_landing_runtime text,
  public_landing_legacy_base_url text
)
language sql
security definer
set search_path = public
as $$
  select
    coalesce(nullif(s.public_landing_runtime, ''), 'legacy') as public_landing_runtime,
    coalesce(s.public_landing_legacy_base_url, '') as public_landing_legacy_base_url
  from public.settings s
  where s.id = 1
  limit 1;
$$;

revoke all on function public.get_public_landing_routing() from public;
grant execute on function public.get_public_landing_routing() to anon, authenticated;

create or replace function public.verify_revalidate_secret(p_secret text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.settings s
    where s.id = 1
      and s.revalidate_secret <> ''
      and s.revalidate_secret = coalesce(p_secret, '')
  );
$$;

revoke all on function public.verify_revalidate_secret(text) from public;
grant execute on function public.verify_revalidate_secret(text) to anon, authenticated;
