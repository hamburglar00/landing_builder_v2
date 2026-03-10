-- Tracking por landing: campos específicos para integración externa.
-- post_url: URL a la que se envían los datos de la landing (POST).
-- landing_tag: etiqueta de la landing para tracking/segmentación externa.

alter table public.landings
add column if not exists post_url text default '' not null;

comment on column public.landings.post_url is 'URL destino para POST de eventos de la landing.';

alter table public.landings
add column if not exists landing_tag text default '' not null;

comment on column public.landings.landing_tag is 'Etiqueta de tracking de la landing para sistemas externos.';

