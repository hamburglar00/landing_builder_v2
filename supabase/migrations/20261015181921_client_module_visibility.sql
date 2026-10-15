-- Administrator-owned presentation controls. Clients can only read their row.
-- Keep these separate from conversions_config, which clients may update.
create table public.client_module_permissions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  show_followups boolean not null default true,
  show_whatsapp_api boolean not null default true,
  show_atrio boolean not null default true,
  show_kommo boolean not null default true,
  show_chatrace boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.client_module_permissions enable row level security;
revoke all on public.client_module_permissions from public, anon, authenticated;
grant select on public.client_module_permissions to authenticated;
grant select, insert, update, delete on public.client_module_permissions to service_role;

create policy "Clients read own module permissions"
on public.client_module_permissions
for select to authenticated
using ((select auth.uid()) = user_id);

comment on table public.client_module_permissions is
  'Admin-controlled dashboard visibility. Hiding a module does not stop its integrations or background jobs. Missing rows retain legacy visibility.';

notify pgrst, 'reload schema';
