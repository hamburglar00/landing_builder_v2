alter table public.gerencia_phones
  add column if not exists source_available boolean;

update public.gerencia_phones gp
set source_available = case
  when coalesce(g.source_type, 'pbadmin') = 'manual' then true
  when gp.status = 'active' then true
  else false
end
from public.gerencias g
where g.id = gp.gerencia_id
  and gp.source_available is null;

update public.gerencia_phones
set source_available = true
where source_available is null;

alter table public.gerencia_phones
  alter column source_available set default true,
  alter column source_available set not null;

comment on column public.gerencia_phones.source_available is
  'Indica si el telefono esta disponible en la fuente actual: API PBadmin para gerencias PBadmin, o carga manual para gerencias manuales. status sigue representando si el cliente lo usa para redireccion.';

create index if not exists gerencia_phones_gerencia_source_available_idx
  on public.gerencia_phones (gerencia_id, source_available);
