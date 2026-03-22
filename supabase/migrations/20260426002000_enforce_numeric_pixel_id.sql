-- Normaliza y valida pixel_id para evitar valores inválidos (espacios/letras).

update public.conversions_config
set pixel_id = regexp_replace(coalesce(pixel_id, ''), '\D', '', 'g')
where pixel_id ~ '[^0-9]';

update public.landings
set pixel_id = regexp_replace(coalesce(pixel_id, ''), '\D', '', 'g')
where pixel_id ~ '[^0-9]';

alter table public.conversions_config
  drop constraint if exists conversions_config_pixel_id_numeric;

alter table public.conversions_config
  add constraint conversions_config_pixel_id_numeric
  check (pixel_id ~ '^[0-9]*$');

alter table public.landings
  drop constraint if exists landings_pixel_id_numeric;

alter table public.landings
  add constraint landings_pixel_id_numeric
  check (pixel_id ~ '^[0-9]*$');
