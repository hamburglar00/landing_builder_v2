-- Template 7 is an administrator-controlled client capability, separate from
-- conversions_config because clients may update their own conversion settings.
create table public.client_template_permissions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  template7_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.client_template_permissions enable row level security;
revoke all on public.client_template_permissions from public, anon, authenticated;
grant select on public.client_template_permissions to authenticated;
grant select, insert, update, delete on public.client_template_permissions to service_role;

create policy "Clients read own template permissions"
on public.client_template_permissions
for select to authenticated
using ((select auth.uid()) = user_id);

-- Only this existing client starts with Template 7 enabled. The checkbox can
-- subsequently turn it off without a migration rerun resetting the choice.
insert into public.client_template_permissions (user_id, template7_enabled)
select id, true
from public.profiles
where role = 'client' and lower(btrim(nombre)) = 'goldencajeros'
on conflict (user_id) do nothing;

-- Restrictive policies are combined with the existing owner/admin policies.
-- Check both stored template fields so a crafted landing_config cannot bypass
-- the editor. Disabling access does not delete or unpublish existing landings.
create policy "Template 7 permission on landing insert"
on public.landings as restrictive
for insert to authenticated
with check (
  (
    coalesce(config ->> 'template', '') <> 'template7'
    and coalesce(landing_config #>> '{layout,template}', '') <> '7'
  )
  or exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  )
  or exists (
    select 1 from public.client_template_permissions permission
    where permission.user_id = landings.user_id
      and permission.template7_enabled
  )
);

create policy "Template 7 permission on landing update"
on public.landings as restrictive
for update to authenticated
using (true)
with check (
  (
    coalesce(config ->> 'template', '') <> 'template7'
    and coalesce(landing_config #>> '{layout,template}', '') <> '7'
  )
  or exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  )
  or exists (
    select 1 from public.client_template_permissions permission
    where permission.user_id = landings.user_id
      and permission.template7_enabled
  )
);
