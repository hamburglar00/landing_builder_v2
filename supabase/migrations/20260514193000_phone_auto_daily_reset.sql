alter table public.conversions_config
  add column if not exists phone_auto_reset_daily boolean not null default false,
  add column if not exists phone_auto_reset_last_date date null;

comment on column public.conversions_config.phone_auto_reset_daily is
  'Si true, el cron diario reinicia usage_count y messages_reset_at de telefonos del cliente a las 00:00 America/Argentina/Buenos_Aires.';

comment on column public.conversions_config.phone_auto_reset_last_date is
  'Fecha local Argentina del ultimo reinicio automatico diario aplicado a telefonos del cliente.';

create or replace function public.cron_reset_phone_operational_daily()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_reset_at timestamptz := now();
begin
  with reset_users as materialized (
    update public.conversions_config cc
       set phone_auto_reset_last_date = v_today,
           updated_at = now()
     where cc.phone_auto_reset_daily = true
       and coalesce(cc.phone_auto_reset_last_date, date '1900-01-01') <> v_today
     returning cc.user_id
  ), reset_gerencias as materialized (
    select g.id
      from public.gerencias g
      join reset_users ru on ru.user_id = g.user_id
  )
  update public.gerencia_phones gp
     set usage_count = 0,
         messages_reset_at = v_reset_at
   where gp.gerencia_id in (select id from reset_gerencias);
end;
$$;

comment on function public.cron_reset_phone_operational_daily() is
  'Cron dedicado: reinicia Contador y Mensajes operativos una vez por dia por cliente, si phone_auto_reset_daily esta activo.';

do $$
begin
  perform cron.unschedule('reset-phone-operational-daily-argentina-midnight');
exception when others then
  null;
end $$;

select cron.schedule(
  'reset-phone-operational-daily-argentina-midnight',
  '0 3 * * *',
  $$select public.cron_reset_phone_operational_daily()$$
);