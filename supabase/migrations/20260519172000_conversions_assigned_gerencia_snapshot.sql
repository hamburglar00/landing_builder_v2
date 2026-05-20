alter table public.conversions
  add column if not exists assigned_gerencia_id integer,
  add column if not exists assigned_gerencia_external_id integer,
  add column if not exists assigned_gerencia_name text,
  add column if not exists assigned_gerencia_label text;

comment on column public.conversions.assigned_gerencia_id is
  'ID interno de la gerencia asociada al telefono_asignado al momento de procesar la conversion.';
comment on column public.conversions.assigned_gerencia_external_id is
  'ID externo/PBadmin de la gerencia asociada al telefono_asignado al momento de procesar la conversion.';
comment on column public.conversions.assigned_gerencia_name is
  'Nombre de la gerencia asociada al telefono_asignado al momento de procesar la conversion.';
comment on column public.conversions.assigned_gerencia_label is
  'Etiqueta historica de gerencia para filtros/reportes, formato Nombre (ID externo).';

create index if not exists conversions_user_assigned_gerencia_idx
  on public.conversions (user_id, assigned_gerencia_id);

create index if not exists conversions_assigned_gerencia_label_idx
  on public.conversions (assigned_gerencia_label);

-- Backfill conservador: solo completa filas donde el telefono_asignado
-- pertenece a una unica gerencia del cliente en el estado actual.
with phone_matches as (
  select
    c.id as conversion_id,
    g.id as gerencia_internal_id,
    g.gerencia_id as gerencia_external_id,
    coalesce(nullif(trim(g.nombre), ''), format('Gerencia %s', coalesce(g.gerencia_id, g.id))) as gerencia_name,
    count(*) over (
      partition by c.id
    ) as match_count
  from public.conversions c
  join public.gerencia_phones gp
    on regexp_replace(coalesce(gp.phone, ''), '\D', '', 'g') =
       regexp_replace(coalesce(c.telefono_asignado, ''), '\D', '', 'g')
  join public.gerencias g
    on g.id = gp.gerencia_id
   and g.user_id = c.user_id
  where c.assigned_gerencia_id is null
    and nullif(regexp_replace(coalesce(c.telefono_asignado, ''), '\D', '', 'g'), '') is not null
),
unique_matches as (
  select *
  from phone_matches
  where match_count = 1
)
update public.conversions c
set
  assigned_gerencia_id = u.gerencia_internal_id,
  assigned_gerencia_external_id = coalesce(u.gerencia_external_id, u.gerencia_internal_id),
  assigned_gerencia_name = u.gerencia_name,
  assigned_gerencia_label = format('%s (ID %s)', u.gerencia_name, coalesce(u.gerencia_external_id, u.gerencia_internal_id))
from unique_matches u
where c.id = u.conversion_id;
