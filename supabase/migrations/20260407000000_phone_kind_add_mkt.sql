-- Permite el tipo de teléfono 'mkt' (marketing) además de 'carga' y 'ads'.
-- La API externa envía load.whatsapp (carga), ads.whatsapp (ads), mkt.whatsapp (mkt).

alter table public.landings
  drop constraint if exists landings_phone_kind_check;

alter table public.landings
  add constraint landings_phone_kind_check check (phone_kind in ('carga', 'ads', 'mkt'));

comment on column public.landings.phone_kind is
  'Tipo de teléfono preferido para esta landing: carga, ads o mkt.';

alter table public.gerencia_phones
  drop constraint if exists gerencia_phones_kind_check;

alter table public.gerencia_phones
  add constraint gerencia_phones_kind_check check (kind in ('carga', 'ads', 'mkt'));

comment on column public.gerencia_phones.kind is
  'Tipo de teléfono: carga, ads o mkt, según lo que devuelva la API externa (load/ads/mkt).';

alter table public.landings_gerencias
  drop constraint if exists landings_gerencias_phone_kind_check;

alter table public.landings_gerencias
  add constraint landings_gerencias_phone_kind_check check (phone_kind in ('carga', 'ads', 'mkt'));

comment on column public.landings_gerencias.phone_kind is
  'Tipo de teléfono preferido para esta gerencia en esta landing: carga, ads o mkt.';
