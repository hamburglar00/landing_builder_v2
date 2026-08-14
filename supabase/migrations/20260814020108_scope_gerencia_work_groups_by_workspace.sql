alter table public.gerencia_work_groups
  add column if not exists workspace_currency text;

update public.gerencia_work_groups wg
set workspace_currency = coalesce(
  (
    select g.workspace_currency
    from public.gerencia_work_group_members wgm
    join public.gerencias g on g.id = wgm.gerencia_id
    where wgm.group_id = wg.id
    group by g.workspace_currency
    order by count(*) desc, g.workspace_currency asc
    limit 1
  ),
  'ARS'
)
where wg.workspace_currency is null;

alter table public.gerencia_work_groups
  alter column workspace_currency set default 'ARS',
  alter column workspace_currency set not null;

alter table public.gerencia_work_groups
  drop constraint if exists gerencia_work_groups_workspace_currency_check;

alter table public.gerencia_work_groups
  add constraint gerencia_work_groups_workspace_currency_check
  check (workspace_currency in ('ARS', 'PYG'));

alter table public.gerencia_work_groups
  drop constraint if exists gerencia_work_groups_user_name_unique;

alter table public.gerencia_work_groups
  add constraint gerencia_work_groups_user_workspace_name_unique
  unique (user_id, workspace_currency, name);

drop index if exists public.gerencia_work_groups_user_idx;

create index if not exists gerencia_work_groups_user_workspace_idx
  on public.gerencia_work_groups(user_id, workspace_currency, name);
