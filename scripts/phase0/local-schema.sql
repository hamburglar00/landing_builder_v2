-- Synthetic, minimal dependencies for audience contract tests ONLY.
-- This is NOT a migration and does not validate the complete production schema.
create schema if not exists auth;
create schema if not exists extensions;
create schema if not exists private;
do $$ begin
  if not exists (select from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
end $$;
create table auth.users(id uuid primary key, raw_app_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),
    nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid
$$;
grant usage on schema auth, public, extensions to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
create table public.conversions (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id),
  created_at timestamptz default now(), valor numeric, purchase_event_time bigint,
  estado text, currency text, phone text, email text, fn text, ln text, ct text, st text, zip text, country text,
  form_phone text, form_email text, form_fn text, form_ln text, geo_city text, geo_region text, geo_country text,
  purchase_event_id text, purchase_transaction_id text, purchase_coelsa_id text, purchase_type text,
  purchase_atrio_id text, purchase_atrio_players_id text, atrio_id text, atrio_players_id text,
  external_id text, source_platform text, test_event_code text, observaciones text
);
alter table public.conversions enable row level security;
create policy fixture_owner on public.conversions for select to authenticated using (user_id=(select auth.uid()));
grant select on public.conversions to authenticated;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
alter database phase0 set search_path=public,extensions;
