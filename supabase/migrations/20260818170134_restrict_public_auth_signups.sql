-- Block public Auth signups. Client users must be created from the admin panel,
-- which marks them with trusted app_metadata before Supabase Auth inserts them.

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

  raise exception 'Public signups are disabled. Users must be created by PanelBot Admin.'
    using errcode = '28000';
end;
$$;

revoke all on function public.prevent_unapproved_auth_user() from public;
revoke all on function public.prevent_unapproved_auth_user() from anon;
revoke all on function public.prevent_unapproved_auth_user() from authenticated;

drop trigger if exists prevent_public_auth_signup on auth.users;

create trigger prevent_public_auth_signup
before insert on auth.users
for each row
execute function public.prevent_unapproved_auth_user();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_role text;
begin
  if coalesce((new.raw_app_meta_data ->> 'panelbot_admin_created')::boolean, false) is not true then
    return new;
  end if;

  profile_role := coalesce(nullif(new.raw_app_meta_data ->> 'panelbot_role', ''), 'client');
  if profile_role not in ('admin', 'client') then
    profile_role := 'client';
  end if;

  insert into public.profiles (id, role)
  values (new.id, profile_role)
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon;
revoke all on function public.handle_new_user() from authenticated;
