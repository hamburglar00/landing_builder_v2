create table if not exists public.atrio_clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  workspace_currency text not null default 'ARS'
    check (workspace_currency in ('ARS', 'PYG')),
  slug text not null,
  atrio_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint atrio_clients_slug_format_check
    check (slug = lower(btrim(slug)) and slug ~ '^[a-z0-9][a-z0-9_-]{0,80}$'),
  constraint atrio_clients_atrio_id_not_blank_check
    check (length(btrim(atrio_id)) > 0)
);

create unique index if not exists atrio_clients_user_workspace_slug_key
  on public.atrio_clients (user_id, workspace_currency, slug);

create unique index if not exists atrio_clients_atrio_id_key
  on public.atrio_clients (atrio_id);

create index if not exists atrio_clients_user_workspace_idx
  on public.atrio_clients (user_id, workspace_currency, created_at desc);

create or replace function public.set_atrio_clients_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists atrio_clients_updated_at on public.atrio_clients;

create trigger atrio_clients_updated_at
before update on public.atrio_clients
for each row execute function public.set_atrio_clients_updated_at();

alter table public.atrio_clients enable row level security;

drop policy if exists atrio_clients_owner_manage on public.atrio_clients;
create policy atrio_clients_owner_manage
on public.atrio_clients
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists atrio_clients_admin_manage on public.atrio_clients;
create policy atrio_clients_admin_manage
on public.atrio_clients
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
  )
);

grant select, insert, update, delete on public.atrio_clients to authenticated;

comment on table public.atrio_clients is
  'Clientes configurados para destino CTA Atrio, separados por usuario y workspace.';

comment on column public.atrio_clients.slug is
  'Slug publico de Atrio. La URL final es https://www.atrio.website/{slug}.';

comment on column public.atrio_clients.atrio_id is
  'Identificador UUID del cliente en Atrio; cumple el rol de agency_id para este canal.';
