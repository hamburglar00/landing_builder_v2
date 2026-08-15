alter table public.conversion_logs
  add column if not exists workspace_currency text not null default 'ARS';

alter table public.conversion_logs
  drop constraint if exists conversion_logs_workspace_currency_check;

alter table public.conversion_logs
  add constraint conversion_logs_workspace_currency_check
  check (workspace_currency in ('ARS', 'PYG'));

create index if not exists conversion_logs_user_workspace_created_idx
  on public.conversion_logs (user_id, workspace_currency, created_at desc);

update public.conversion_logs l
set workspace_currency = c.currency
from public.conversions c
where c.id = l.conversion_id
  and c.currency in ('ARS', 'PYG')
  and l.workspace_currency <> c.currency;

create or replace function public.set_conversion_log_workspace_currency()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  conversion_workspace text;
begin
  if new.conversion_id is not null then
    select c.currency
      into conversion_workspace
    from public.conversions c
    where c.id = new.conversion_id;

    if conversion_workspace in ('ARS', 'PYG') then
      new.workspace_currency = conversion_workspace;
      return new;
    end if;
  end if;

  new.workspace_currency = case
    when upper(coalesce(nullif(btrim(new.workspace_currency), ''), '')) in ('ARS', 'PYG')
      then upper(btrim(new.workspace_currency))
    else 'ARS'
  end;

  return new;
end;
$$;

drop trigger if exists trg_conversion_logs_workspace_currency on public.conversion_logs;
create trigger trg_conversion_logs_workspace_currency
before insert or update of conversion_id, workspace_currency on public.conversion_logs
for each row
execute function public.set_conversion_log_workspace_currency();

comment on column public.conversion_logs.workspace_currency is
  'Workspace operativo del log. Se usa para separar Logs de Conversiones por ARS/PYG.';
