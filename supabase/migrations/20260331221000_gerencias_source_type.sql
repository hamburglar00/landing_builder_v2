alter table public.gerencias
  add column if not exists source_type text not null default 'pbadmin'
  check (source_type in ('pbadmin', 'manual'));

comment on column public.gerencias.source_type is
  'Origen de teléfonos de la gerencia: pbadmin (sync por API externa) o manual (carga desde UI Telefonos).';

update public.gerencias
set source_type = 'manual'
where source_type is null
  and (gerencia_id is null or gerencia_id <= 0);
