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
  ), reset_phones as materialized (
    update public.gerencia_phones gp
       set usage_count = 0,
           messages_reset_at = v_reset_at
     where gp.gerencia_id in (select id from reset_gerencias)
     returning gp.id
  )
  update public.phone_assignment_scope_metrics sm
     set usage_count = 0,
         updated_at = now()
   where sm.phone_id in (select id from reset_phones);
end;
$$;

comment on function public.cron_reset_phone_operational_daily() is
  'Cron dedicado: reinicia Contador global, Contador por scope y Mensajes operativos una vez por dia por cliente, si phone_auto_reset_daily esta activo.';
