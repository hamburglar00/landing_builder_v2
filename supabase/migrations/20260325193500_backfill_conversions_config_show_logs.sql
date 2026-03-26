-- Backfill de configuracion para clientes ya creados:
-- 1) crear conversions_config faltante por cliente
-- 2) asegurar show_logs=true cuando este nulo

insert into public.conversions_config (user_id, show_logs)
select p.id, true
from public.profiles p
left join public.conversions_config cc on cc.user_id = p.id
where p.role = 'client'
  and cc.user_id is null;

update public.conversions_config
set show_logs = true
where show_logs is null;

