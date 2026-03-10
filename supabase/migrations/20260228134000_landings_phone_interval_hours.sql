-- Intervalo horario (formato 24h) para controlar cuándo una landing puede
-- mostrar teléfonos. Se almacena como hora de inicio y fin (0-23).
-- Si ambos son NULL, no se aplica intervalo.

alter table public.landings
add column if not exists phone_interval_start_hour integer
  check (
    phone_interval_start_hour is null
    or (phone_interval_start_hour >= 0 and phone_interval_start_hour <= 23)
  );

alter table public.landings
add column if not exists phone_interval_end_hour integer
  check (
    phone_interval_end_hour is null
    or (phone_interval_end_hour >= 0 and phone_interval_end_hour <= 23)
  );

comment on column public.landings.phone_interval_start_hour is
  'Hora de inicio (0-23) del intervalo horario en el que esta landing puede mostrar teléfonos. NULL = sin intervalo.';

comment on column public.landings.phone_interval_end_hour is
  'Hora de fin (0-23) del intervalo horario en el que esta landing puede mostrar teléfonos. NULL = sin intervalo.';

