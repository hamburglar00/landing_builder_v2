-- Asegura que la columna config de public.landings nunca sea NULL.
-- La configuración de tipografía y posición del CTA se maneja como JSON
-- dentro de config (LandingThemeConfig) desde el frontend.
-- No se necesitan cambios de esquema adicionales; este paso solo
-- normaliza datos existentes para evitar nulls.

update public.landings
set config = '{}'::jsonb
where config is null;

