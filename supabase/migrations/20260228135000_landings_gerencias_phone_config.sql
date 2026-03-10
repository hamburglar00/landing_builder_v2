-- Configuración telefónica por asignación landing-gerencia.
-- Cada relación landing_gerencias tiene su propio modo, tipo e intervalo horario.

alter table public.landings_gerencias
add column if not exists phone_mode text not null default 'random'
  check (phone_mode in ('random', 'fair'));

alter table public.landings_gerencias
add column if not exists phone_kind text not null default 'carga'
  check (phone_kind in ('carga', 'ads'));

alter table public.landings_gerencias
add column if not exists interval_start_hour integer
  check (
    interval_start_hour is null
    or (interval_start_hour >= 0 and interval_start_hour <= 23)
  );

alter table public.landings_gerencias
add column if not exists interval_end_hour integer
  check (
    interval_end_hour is null
    or (interval_end_hour >= 0 and interval_end_hour <= 23)
  );

comment on column public.landings_gerencias.phone_mode is
  'Modo de selección de teléfono para esta gerencia en esta landing: random (aleatorio) o fair (equitativo).';

comment on column public.landings_gerencias.phone_kind is
  'Tipo de teléfono preferido para esta gerencia en esta landing: carga o ads.';

comment on column public.landings_gerencias.interval_start_hour is
  'Hora de inicio (0-23) del intervalo horario para esta gerencia en esta landing. NULL = sin intervalo.';

comment on column public.landings_gerencias.interval_end_hour is
  'Hora de fin (0-23) del intervalo horario para esta gerencia en esta landing. NULL = sin intervalo.';

