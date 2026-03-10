-- El peso NO es una propiedad de la gerencia sino de la asignación a cada landing.
-- Una misma gerencia puede tener distinto peso en cada landing (tabla landings_gerencias).
alter table public.landings_gerencias
add column if not exists weight integer not null default 0;

comment on column public.landings_gerencias.weight is 'Peso de esta gerencia en esta landing (específico por landing, no general de la gerencia).';
