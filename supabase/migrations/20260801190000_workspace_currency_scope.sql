alter table public.landings
  add column if not exists workspace_currency text not null default 'ARS';

alter table public.gerencias
  add column if not exists workspace_currency text not null default 'ARS';

alter table public.promotions
  add column if not exists workspace_currency text not null default 'ARS';

update public.landings
set workspace_currency = 'ARS'
where workspace_currency is null or trim(workspace_currency) = '';

update public.gerencias
set workspace_currency = 'ARS'
where workspace_currency is null or trim(workspace_currency) = '';

update public.promotions
set workspace_currency = 'ARS'
where workspace_currency is null or trim(workspace_currency) = '';

do $$
begin
  alter table public.landings
    add constraint landings_workspace_currency_check
    check (workspace_currency in ('ARS', 'PYG'));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.gerencias
    add constraint gerencias_workspace_currency_check
    check (workspace_currency in ('ARS', 'PYG'));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.promotions
    add constraint promotions_workspace_currency_check
    check (workspace_currency in ('ARS', 'PYG'));
exception
  when duplicate_object then null;
end $$;

create index if not exists idx_landings_user_workspace_updated
  on public.landings (user_id, workspace_currency, updated_at desc);

create index if not exists idx_gerencias_user_workspace_nombre
  on public.gerencias (user_id, workspace_currency, nombre);

create index if not exists idx_promotions_user_workspace_created
  on public.promotions (user_id, workspace_currency, created_at desc);

create or replace function public.validate_landing_gerencia_workspace_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_workspace text;
  gerencia_workspace text;
  gerencia_label text;
begin
  select l.workspace_currency
    into target_workspace
  from public.landings l
  where l.id = new.landing_id;

  if target_workspace is null then
    raise exception 'Landing inexistente para asignacion de gerencia.'
      using errcode = '23503';
  end if;

  select
    g.workspace_currency,
    format(
      '%s (ID %s)',
      coalesce(nullif(trim(g.nombre), ''), format('Gerencia %s', coalesce(g.gerencia_id, g.id))),
      coalesce(g.gerencia_id, g.id)
    )
    into gerencia_workspace, gerencia_label
  from public.gerencias g
  where g.id = new.gerencia_id;

  if gerencia_workspace is null then
    raise exception 'Gerencia inexistente para asignacion a landing.'
      using errcode = '23503';
  end if;

  if gerencia_workspace <> target_workspace then
    raise exception
      'No se puede asignar % a una landing del workspace % porque esa gerencia pertenece al workspace %. Cree una gerencia separada para no mezclar monedas entre workspaces.',
      coalesce(gerencia_label, format('Gerencia %s', new.gerencia_id)),
      target_workspace,
      gerencia_workspace
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_landings_gerencias_market_guard on public.landings_gerencias;
drop trigger if exists trg_landings_gerencias_workspace_guard on public.landings_gerencias;
create trigger trg_landings_gerencias_workspace_guard
before insert or update of landing_id, gerencia_id on public.landings_gerencias
for each row
execute function public.validate_landing_gerencia_workspace_assignment();

create or replace function public.validate_landing_workspace_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  conflict record;
begin
  if old.workspace_currency = new.workspace_currency then
    return new;
  end if;

  select
    g.id as gerencia_id,
    coalesce(nullif(trim(g.nombre), ''), format('Gerencia %s', coalesce(g.gerencia_id, g.id))) as gerencia_name,
    coalesce(g.gerencia_id, g.id) as gerencia_external_id,
    g.workspace_currency as gerencia_workspace
  into conflict
  from public.landings_gerencias lg
  join public.gerencias g on g.id = lg.gerencia_id
  where lg.landing_id = new.id
    and g.workspace_currency <> new.workspace_currency
  limit 1;

  if found then
    raise exception
      'No se puede cambiar esta landing al workspace % porque la gerencia % (ID %) pertenece al workspace %. Cree una gerencia separada para no mezclar monedas entre workspaces.',
      new.workspace_currency,
      conflict.gerencia_name,
      conflict.gerencia_external_id,
      conflict.gerencia_workspace
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_landings_market_guard on public.landings;
drop trigger if exists trg_landings_workspace_guard on public.landings;
create trigger trg_landings_workspace_guard
before update of workspace_currency on public.landings
for each row
execute function public.validate_landing_workspace_update();

create or replace function public.validate_gerencia_workspace_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  conflict record;
begin
  if old.workspace_currency = new.workspace_currency then
    return new;
  end if;

  select
    l.id as landing_id,
    l.name as landing_name,
    l.workspace_currency as landing_workspace
  into conflict
  from public.landings_gerencias lg
  join public.landings l on l.id = lg.landing_id
  where lg.gerencia_id = new.id
    and l.workspace_currency <> new.workspace_currency
  limit 1;

  if found then
    raise exception
      'No se puede cambiar esta gerencia al workspace % porque ya esta asignada a la landing "%" del workspace %. Cree una gerencia separada para no mezclar monedas entre workspaces.',
      new.workspace_currency,
      conflict.landing_name,
      conflict.landing_workspace
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_gerencias_workspace_guard on public.gerencias;
create trigger trg_gerencias_workspace_guard
before update of workspace_currency on public.gerencias
for each row
execute function public.validate_gerencia_workspace_update();

comment on column public.landings.workspace_currency is
  'Workspace operativo del panel: separa landings ARS/PYG sin depender de la moneda del pixel.';

comment on column public.gerencias.workspace_currency is
  'Workspace operativo del panel: una gerencia y sus telefonos pertenecen a un unico workspace ARS/PYG.';

comment on column public.promotions.workspace_currency is
  'Workspace operativo del panel para listar promociones separadas por ARS/PYG.';
