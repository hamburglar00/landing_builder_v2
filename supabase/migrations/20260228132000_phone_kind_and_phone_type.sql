-- Tipo de teléfono preferido por landing (carga vs ads)
alter table public.landings
add column if not exists phone_kind text not null default 'carga'
  check (phone_kind in ('carga', 'ads'));

comment on column public.landings.phone_kind is
  'Tipo de teléfono preferido para esta landing: normal o ads.';

-- Tipo de teléfono por registro en gerencia_phones (carga vs ads)
alter table public.gerencia_phones
add column if not exists kind text not null default 'carga'
  check (kind in ('carga', 'ads'));

comment on column public.gerencia_phones.kind is
  'Tipo de teléfono: normal o ads, según lo que devuelva la API externa.';

