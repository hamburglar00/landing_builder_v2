-- Intervalo de tiempo (minutos) en el que la gerencia tiene habilitado mostrar sus números.
-- 0 = no se aplica intervalo.
alter table public.landings
add column if not exists phone_interval_minutes integer not null default 0;

comment on column public.landings.phone_interval_minutes is
  'Si > 0, intervalo en minutos en el que cada gerencia tiene habilitado mostrar sus números (rotación por tiempo).';
