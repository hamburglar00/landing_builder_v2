alter table public.conversions_config
  add column if not exists show_promotions boolean not null default false;

comment on column public.conversions_config.show_promotions is
  'Si true, muestra y permite usar la seccion Promociones en la UI del cliente.';

-- Clientes existentes: mantener Promociones activa para no cambiarles la UI actual.
insert into public.conversions_config (user_id, show_promotions)
select p.id, true
from public.profiles p
left join public.conversions_config cc on cc.user_id = p.id
where p.role = 'client'
  and cc.user_id is null
on conflict (user_id) do nothing;

update public.conversions_config cc
set show_promotions = true
from public.profiles p
where p.id = cc.user_id
  and p.role = 'client';
