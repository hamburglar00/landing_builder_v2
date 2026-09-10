create table if not exists public.auth_signup_approvals (
  email text primary key,
  user_id uuid not null unique,
  requested_by uuid references auth.users(id) on delete set null,
  role text not null default 'client' check (role in ('admin', 'client')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '5 minutes')
);

comment on table public.auth_signup_approvals is
  'Aprobaciones temporales para permitir altas de Auth iniciadas por create-client.';

alter table public.auth_signup_approvals enable row level security;

revoke all on public.auth_signup_approvals from public, anon, authenticated;
grant select, insert, update, delete on public.auth_signup_approvals to service_role;

create or replace function public.prevent_unapproved_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce((new.raw_app_meta_data ->> 'panelbot_admin_created')::boolean, false) is true then
    return new;
  end if;

  if new.email is not null and exists (
    select 1
    from public.auth_signup_approvals asa
    where asa.email = lower(new.email)
      and asa.user_id = new.id
      and asa.expires_at > now()
  ) then
    return new;
  end if;

  raise exception 'Public signups are disabled. Users must be created by PanelBot Admin.'
    using errcode = '28000';
end;
$$;

revoke all on function public.prevent_unapproved_auth_user() from public;
revoke all on function public.prevent_unapproved_auth_user() from anon;
revoke all on function public.prevent_unapproved_auth_user() from authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_role text;
begin
  select asa.role
    into profile_role
  from public.auth_signup_approvals asa
  where asa.email = lower(new.email)
    and asa.user_id = new.id
    and asa.expires_at > now()
  limit 1;

  if profile_role is null and coalesce((new.raw_app_meta_data ->> 'panelbot_admin_created')::boolean, false) is true then
    profile_role := coalesce(nullif(new.raw_app_meta_data ->> 'panelbot_role', ''), 'client');
  end if;

  if profile_role is null then
    return new;
  end if;

  if profile_role not in ('admin', 'client') then
    profile_role := 'client';
  end if;

  insert into public.profiles (id, role)
  values (new.id, profile_role)
  on conflict (id) do update
    set role = excluded.role;

  delete from public.auth_signup_approvals
  where email = lower(new.email);

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon;
revoke all on function public.handle_new_user() from authenticated;

notify pgrst, 'reload schema';
