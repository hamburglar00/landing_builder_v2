create table if not exists public.gerencia_work_groups (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gerencia_work_groups_name_not_empty check (length(trim(name)) > 0),
  constraint gerencia_work_groups_user_name_unique unique (user_id, name)
);

create table if not exists public.gerencia_work_group_members (
  id bigserial primary key,
  group_id bigint not null references public.gerencia_work_groups(id) on delete cascade,
  gerencia_id integer not null references public.gerencias(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint gerencia_work_group_members_unique unique (group_id, gerencia_id)
);

alter table public.gerencia_work_groups enable row level security;
alter table public.gerencia_work_group_members enable row level security;

create index if not exists gerencia_work_groups_user_idx
  on public.gerencia_work_groups(user_id, name);

create index if not exists gerencia_work_group_members_group_idx
  on public.gerencia_work_group_members(group_id);

create index if not exists gerencia_work_group_members_gerencia_idx
  on public.gerencia_work_group_members(gerencia_id);

create or replace function public.set_gerencia_work_groups_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_gerencia_work_groups_updated_at on public.gerencia_work_groups;
create trigger trg_gerencia_work_groups_updated_at
before update on public.gerencia_work_groups
for each row
execute function public.set_gerencia_work_groups_updated_at();

drop policy if exists "Users read own gerencia work groups" on public.gerencia_work_groups;
create policy "Users read own gerencia work groups"
  on public.gerencia_work_groups for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "Users manage own gerencia work groups" on public.gerencia_work_groups;
create policy "Users manage own gerencia work groups"
  on public.gerencia_work_groups for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users read own gerencia work group members" on public.gerencia_work_group_members;
create policy "Users read own gerencia work group members"
  on public.gerencia_work_group_members for select
  using (
    exists (
      select 1
      from public.gerencia_work_groups wg
      where wg.id = group_id
        and (
          wg.user_id = auth.uid()
          or exists (
            select 1 from public.profiles p
            where p.id = auth.uid() and p.role = 'admin'
          )
        )
    )
  );

drop policy if exists "Users manage own gerencia work group members" on public.gerencia_work_group_members;
create policy "Users manage own gerencia work group members"
  on public.gerencia_work_group_members for all
  using (
    exists (
      select 1
      from public.gerencia_work_groups wg
      where wg.id = group_id
        and wg.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.gerencia_work_groups wg
      join public.gerencias g on g.id = gerencia_id
      where wg.id = group_id
        and wg.user_id = auth.uid()
        and g.user_id = auth.uid()
    )
  );
